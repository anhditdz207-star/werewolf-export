import {
  DeathCause,
  GamePhase,
  GameState,
  NightSubPhase,
  Player,
  RoleName,
  VotingSubPhase,
} from '@werewolf/shared';
import { validateRoomConfig } from '../../config/roleRules';
import { Room } from '../../rooms/Room';
import { GameLogicError } from '../GameLogicError';
import { assignRoles, createRoleState } from '../engine/RoleAssigner';
import { applyDeaths } from '../engine/DeathResolver';
import {
  createEmptyNightDraft,
  isWolfTeam,
  NightActionsDraft,
  NightResolutionResult,
  resolveNight as resolveNightPure,
} from '../engine/NightResolver';
import { resolveVotes, VoteResolutionResult } from '../engine/VoteResolver';
import { checkWinCondition, WinResult } from '../engine/WinConditionChecker';
import { getApplicableNightSubPhases, getNextNightSubPhase } from './NightOrder';

export interface VoteRoundOutcome extends VoteResolutionResult {
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
  hunterPendingShotIds: string[];
  /** Set when the vote's target was an un-revealed Idiot — they survive,
   * but their role is now public and they can no longer vote. */
  revealedIdiotId: string | null;
  wildChildTurnedIds: string[];
}

export interface HunterShotOutcome {
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
  wildChildTurnedIds: string[];
}

/**
 * GameStateMachine — owns the phase-transition logic for exactly one
 * room. One instance is created per active game (see GameSession in the
 * socket layer). It reads/writes the Room's GameState directly but has
 * NO knowledge of Socket.IO, timers, or broadcasting — callers (socket
 * event handlers) decide when to call each method and what to do with
 * the results (e.g. emit events, start a countdown).
 *
 * Two pieces of state live outside the shared GameState on purpose,
 * because they're either transient or privacy-sensitive and shouldn't be
 * broadcast to all clients before resolution:
 *   - `nightDraft` — in-progress night action choices (would leak, e.g.,
 *     the Seer's target, if broadcast)
 *   - `votes` / `tiedCandidateIds` — kept here so a live tally can be
 *     computed on demand without exposing raw ballots in GameState
 */
export class GameStateMachine {
  private nightDraft: NightActionsDraft = createEmptyNightDraft();
  private applicableNightSubPhases: NightSubPhase[] = [];
  private votes: Record<string, string> = {};
  private tiedCandidateIds: string[] | null = null;
  /** Set when the current Village Chief just died and needs to pick a
   * successor before the title goes vacant (see chooseChiefSuccessor). */
  private pendingChiefSuccession: { chiefId: string } | null = null;

  constructor(private room: Room) {}

  private get state(): GameState {
    return this.room._internalStateForFsm();
  }

  // ==================== WAITING -> ROLE_ASSIGN -> NIGHT ====================

  startGame(requestingPlayerId: string): void {
    const state = this.state;
    if (state.phase !== GamePhase.WAITING) {
      throw new GameLogicError('Ván đấu đã bắt đầu rồi.', 'ALREADY_STARTED');
    }
    if (state.hostPlayerId !== requestingPlayerId) {
      throw new GameLogicError('Chỉ chủ phòng mới được bắt đầu ván đấu.', 'NOT_HOST');
    }
    const validation = validateRoomConfig(state.config.roleCounts, state.players.length);
    if (!validation.isValid) {
      throw new GameLogicError(validation.errors.join(' '), 'INVALID_CONFIG');
    }

    const assignment = assignRoles(state.players, state.config);
    state.players = assignment.players;
    state.thiefSpareRoles = assignment.thiefSpareRoles;
    state.phase = GamePhase.ROLE_ASSIGN;
    state.phaseEndsAt = null;
  }

  /**
   * Resolves the Thief's pre-night card choice. Callable at most once
   * (state.thiefSpareRoles is cleared afterward as the "already resolved"
   * sentinel). `chosenRole` must be one of the 2 offered spares, or null
   * to keep the original Thief role.
   *
   * Simplification note: the source rules say the Thief is FORCED to
   * swap if neither spare card is a Werewolf-team role. We always allow
   * a free choice instead (including keeping Thief) for simplicity —
   * enforcing the conditional-forced-swap rule would require exposing
   * werewolf-composition info to the client in a special-cased way that
   * doesn't fit the existing "eligible targets" pattern.
   *
   * Returns the Thief's new role if it changed, or null if unchanged /
   * no Thief in this game.
   */
  resolveThief(chosenRole: RoleName | null): { playerId: string; newRole: RoleName } | null {
    const state = this.state;
    if (!state.thiefSpareRoles) return null;
    const thief = state.players.find((p) => p.role === RoleName.THIEF);
    const spares = state.thiefSpareRoles;
    state.thiefSpareRoles = null; // mark resolved regardless of outcome

    if (!thief || chosenRole === null) return null;
    if (chosenRole !== spares[0] && chosenRole !== spares[1]) {
      throw new GameLogicError('Lá bài không hợp lệ.', 'INVALID_TARGET');
    }
    Object.assign(thief, { role: chosenRole, ...createRoleState(chosenRole) });
    return { playerId: thief.id, newRole: chosenRole };
  }

  /** Called once clients have acknowledged their role reveal (e.g. after a fixed UI delay). */
  beginFirstNight(): void {
    const state = this.state;
    if (state.phase !== GamePhase.ROLE_ASSIGN) {
      throw new GameLogicError('Ván đấu chưa sẵn sàng để vào đêm đầu tiên.', 'WRONG_PHASE');
    }
    state.dayCount = 1;
    this.enterNightPhase();
  }

  private enterNightPhase(): void {
    const state = this.state;
    state.phase = GamePhase.NIGHT;
    state.votingSubPhase = null;
    state.phaseEndsAt = null; // per-role countdown lives in NightPromptPayload instead
    this.nightDraft = createEmptyNightDraft();
    this.applicableNightSubPhases = getApplicableNightSubPhases(
      state.players,
      state.dayCount,
      state.villagerActiveSkillsDisabled,
    );
    state.nightSubPhase = this.applicableNightSubPhases[0] ?? NightSubPhase.RESOLVING;
  }

  // ==================== NIGHT sub-phase actions ====================

  /** Ids of players who should currently be prompted to act. */
  getCurrentNightActorIds(): string[] {
    const state = this.state;
    if (state.phase !== GamePhase.NIGHT || !state.nightSubPhase) return [];

    if (state.nightSubPhase === NightSubPhase.WEREWOLF_BONUS) {
      return state.players.filter((p) => p.isAlive && isWolfTeam(p.role)).map((p) => p.id);
    }

    const role = this.roleForSubPhase(state.nightSubPhase);
    if (!role) return [];
    return state.players.filter((p) => p.isAlive && p.role === role).map((p) => p.id);
  }

  /** Valid targets a player may currently choose from. */
  getEligibleTargets(subPhase: NightSubPhase): string[] {
    const alivePlayers = this.state.players.filter((p) => p.isAlive);
    if (subPhase === NightSubPhase.WEREWOLF || subPhase === NightSubPhase.WEREWOLF_BONUS) {
      // Werewolves cannot target each other, and the bonus victim must be
      // distinct from whoever the pack already chose as primary victim.
      return alivePlayers
        .filter((p) => !isWolfTeam(p.role) && p.id !== this.nightDraft.wolfTargetId)
        .map((p) => p.id);
    }
    if (subPhase === NightSubPhase.WHITE_WOLF) {
      const white = alivePlayers.find((p) => p.role === RoleName.WHITE_WOLF);
      return alivePlayers
        .filter((p) => isWolfTeam(p.role) && p.id !== white?.id)
        .map((p) => p.id);
    }
    if (subPhase === NightSubPhase.LITTLE_GIRL_PEEK) {
      return [];
    }
    if (subPhase === NightSubPhase.CULT_LEADER) {
      return alivePlayers.filter((p) => !p.isCultMember).map((p) => p.id);
    }
    return alivePlayers.map((p) => p.id);
  }

  private roleForSubPhase(subPhase: NightSubPhase): RoleName | null {
    switch (subPhase) {
      case NightSubPhase.CUPID:
        return RoleName.CUPID;
      case NightSubPhase.WEREWOLF:
        return RoleName.WEREWOLF;
      case NightSubPhase.FATHER_WOLF_DECISION:
        return RoleName.FATHER_WOLF;
      case NightSubPhase.WHITE_WOLF:
        return RoleName.WHITE_WOLF;
      case NightSubPhase.LITTLE_GIRL_PEEK:
        return RoleName.LITTLE_GIRL;
      case NightSubPhase.FOX:
        return RoleName.FOX;
      case NightSubPhase.FLUTIST:
        return RoleName.FLUTIST;
      case NightSubPhase.CULT_LEADER:
        return RoleName.CULT_LEADER;
      case NightSubPhase.GUARD:
        return RoleName.GUARD;
      case NightSubPhase.WITCH:
        return RoleName.WITCH;
      case NightSubPhase.SEER:
        return RoleName.SEER;
      default:
        return null;
    }
  }

  private assertNightSubPhase(playerId: string, expected: NightSubPhase): Player {
    const state = this.state;
    if (state.phase !== GamePhase.NIGHT || state.nightSubPhase !== expected) {
      throw new GameLogicError('Chưa đến lượt của vai trò này.', 'WRONG_SUBPHASE');
    }
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) {
      throw new GameLogicError('Người chơi không hợp lệ hoặc đã chết.', 'INVALID_PLAYER');
    }
    return player;
  }

  private assertAliveTarget(targetId: string): Player {
    const target = this.state.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) {
      throw new GameLogicError('Mục tiêu không hợp lệ hoặc đã chết.', 'INVALID_TARGET');
    }
    return target;
  }

  submitWerewolfTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.WEREWOLF);
    if (!isWolfTeam(player.role)) {
      throw new GameLogicError('Bạn không phải Ma Sói.', 'WRONG_ROLE');
    }
    const target = this.assertAliveTarget(targetId);
    if (isWolfTeam(target.role)) {
      throw new GameLogicError('Không thể chọn đồng đội Sói làm mục tiêu.', 'INVALID_TARGET');
    }
    // Any wolf may (re-)submit; last submission before the sub-phase
    // advances is the pack's final decision (consensus is coordinated via
    // the werewolves' own chat, outside this state machine).
    this.nightDraft.wolfTargetId = targetId;
  }

  submitWerewolfBonusTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.WEREWOLF_BONUS);
    if (!isWolfTeam(player.role)) {
      throw new GameLogicError('Bạn không phải Ma Sói.', 'WRONG_ROLE');
    }
    const target = this.assertAliveTarget(targetId);
    if (isWolfTeam(target.role)) {
      throw new GameLogicError('Không thể chọn đồng đội Sói làm mục tiêu.', 'INVALID_TARGET');
    }
    if (targetId === this.nightDraft.wolfTargetId) {
      throw new GameLogicError(
        'Nạn nhân thứ hai phải khác nạn nhân đã chọn.',
        'INVALID_TARGET',
      );
    }
    this.nightDraft.wolfBonusTargetId = targetId;
  }

  submitFatherWolfDecision(playerId: string, convert: boolean): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.FATHER_WOLF_DECISION);
    if (player.role !== RoleName.FATHER_WOLF) {
      throw new GameLogicError('Bạn không phải Sói Cha.', 'WRONG_ROLE');
    }
    if (!player.fatherWolfState || player.fatherWolfState.hasUsedConversion) {
      throw new GameLogicError('Bạn đã dùng khả năng này rồi.', 'ALREADY_USED');
    }
    this.nightDraft.fatherWolfConvert = convert;
  }

  submitWhiteWolfTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.WHITE_WOLF);
    if (player.role !== RoleName.WHITE_WOLF) {
      throw new GameLogicError('Bạn không phải Sói Trắng.', 'WRONG_ROLE');
    }
    if (targetId === playerId) {
      throw new GameLogicError('Không thể tự chọn chính mình.', 'INVALID_TARGET');
    }
    const target = this.assertAliveTarget(targetId);
    if (!isWolfTeam(target.role)) {
      throw new GameLogicError('Chỉ có thể chọn một Sói khác.', 'INVALID_TARGET');
    }
    this.nightDraft.whiteWolfTargetId = targetId;
  }

  submitLittleGirlPeek(playerId: string, peek: boolean): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.LITTLE_GIRL_PEEK);
    if (player.role !== RoleName.LITTLE_GIRL) {
      throw new GameLogicError('Bạn không phải Cô Bé.', 'WRONG_ROLE');
    }
    this.nightDraft.littleGirlPeeking = peek;
  }

  submitFoxTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.FOX);
    if (player.role !== RoleName.FOX) {
      throw new GameLogicError('Bạn không phải Cáo.', 'WRONG_ROLE');
    }
    if (player.foxState?.hasLostAbility) {
      throw new GameLogicError('Bạn đã mất kỹ năng soi.', 'ALREADY_USED');
    }
    this.assertAliveTarget(targetId);
    this.nightDraft.foxTargetId = targetId;
  }

  submitFlutistTargets(playerId: string, targetIds: string[]): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.FLUTIST);
    if (player.role !== RoleName.FLUTIST) {
      throw new GameLogicError('Bạn không phải Người Thổi Sáo.', 'WRONG_ROLE');
    }
    if (targetIds.length === 0 || targetIds.length > 2) {
      throw new GameLogicError('Chỉ được chọn tối đa 2 người mỗi đêm.', 'INVALID_TARGET');
    }
    if (new Set(targetIds).size !== targetIds.length) {
      throw new GameLogicError('Không thể chọn trùng một người.', 'INVALID_TARGET');
    }
    targetIds.forEach((id) => this.assertAliveTarget(id));
    this.nightDraft.flutistTargetIds = targetIds;
  }

  submitCultLeaderTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.CULT_LEADER);
    if (player.role !== RoleName.CULT_LEADER) {
      throw new GameLogicError('Bạn không phải Giáo Chủ.', 'WRONG_ROLE');
    }
    const target = this.assertAliveTarget(targetId);
    if (target.isCultMember) {
      throw new GameLogicError('Người này đã thuộc giáo phái rồi.', 'INVALID_TARGET');
    }
    this.nightDraft.cultLeaderTargetId = targetId;
  }

  submitGuardTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.GUARD);
    if (player.role !== RoleName.GUARD) {
      throw new GameLogicError('Bạn không phải Bảo vệ.', 'WRONG_ROLE');
    }
    this.assertAliveTarget(targetId);
    if (player.guardState && player.guardState.lastProtectedPlayerId === targetId) {
      throw new GameLogicError(
        'Không thể bảo vệ cùng một người hai đêm liên tiếp.',
        'REPEAT_TARGET',
      );
    }
    this.nightDraft.guardTargetId = targetId;
  }

  submitSeerTarget(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.SEER);
    if (player.role !== RoleName.SEER) {
      throw new GameLogicError('Bạn không phải Tiên tri.', 'WRONG_ROLE');
    }
    this.assertAliveTarget(targetId);
    this.nightDraft.seerTargetId = targetId;
  }

  submitWitchAction(
    playerId: string,
    action: 'heal' | 'poison' | 'skip',
    targetId?: string,
  ): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.WITCH);
    if (player.role !== RoleName.WITCH || !player.witchState) {
      throw new GameLogicError('Bạn không phải Phù thủy.', 'WRONG_ROLE');
    }

    if (action === 'heal') {
      if (!player.witchState.hasHealPotion) {
        throw new GameLogicError('Bạn đã dùng hết thuốc cứu.', 'NO_POTION');
      }
      if (!this.nightDraft.wolfTargetId) {
        throw new GameLogicError('Không có ai bị Sói cắn đêm nay để cứu.', 'NO_VICTIM');
      }
      // Assumption: heal can only target the werewolves' chosen victim
      // (the witch doesn't get to freely heal anyone else).
      if (targetId && targetId !== this.nightDraft.wolfTargetId) {
        throw new GameLogicError(
          'Chỉ có thể cứu người bị Sói cắn đêm nay.',
          'INVALID_HEAL_TARGET',
        );
      }
      this.nightDraft.witchAction = { type: 'heal', targetId: this.nightDraft.wolfTargetId };
    } else if (action === 'poison') {
      if (!player.witchState.hasPoisonPotion) {
        throw new GameLogicError('Bạn đã dùng hết thuốc độc.', 'NO_POTION');
      }
      if (!targetId) {
        throw new GameLogicError('Cần chọn một mục tiêu để đầu độc.', 'MISSING_TARGET');
      }
      this.assertAliveTarget(targetId);
      this.nightDraft.witchAction = { type: 'poison', targetId };
    } else {
      this.nightDraft.witchAction = { type: 'skip', targetId: null };
    }
  }

  submitCupidTargets(playerId: string, targetId1: string, targetId2: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.CUPID);
    if (player.role !== RoleName.CUPID) {
      throw new GameLogicError('Bạn không phải Cupid.', 'WRONG_ROLE');
    }
    if (targetId1 === targetId2) {
      throw new GameLogicError('Phải chọn hai người khác nhau.', 'INVALID_TARGETS');
    }
    this.assertAliveTarget(targetId1);
    this.assertAliveTarget(targetId2);
    this.nightDraft.cupidTargetIds = [targetId1, targetId2];
  }

  /** Wild Child's first-night idol pick — persisted immediately on the player. */
  submitWildChildIdol(playerId: string, targetId: string): void {
    const player = this.assertNightSubPhase(playerId, NightSubPhase.WILD_CHILD_IDOL);
    if (player.role !== RoleName.WILD_CHILD) {
      throw new GameLogicError('Bạn không phải Kẻ Hoang Dã.', 'WRONG_ROLE');
    }
    if (targetId === playerId) {
      throw new GameLogicError('Không thể chọn chính mình làm thần tượng.', 'INVALID_TARGET');
    }
    this.assertAliveTarget(targetId);
    player.wildChildState = { idolPlayerId: targetId };
  }

  /** Moves to the next applicable night sub-phase. Returns the new sub-phase. */
  advanceNightSubPhase(): NightSubPhase {
    const state = this.state;
    if (state.phase !== GamePhase.NIGHT || !state.nightSubPhase) {
      throw new GameLogicError('Không ở trong pha Đêm.', 'WRONG_PHASE');
    }
    const next = getNextNightSubPhase(state.nightSubPhase, this.applicableNightSubPhases);
    state.nightSubPhase = next;
    return next;
  }

  isReadyToResolveNight(): boolean {
    return this.state.nightSubPhase === NightSubPhase.RESOLVING;
  }

  /** Resolves the night, applies results to state, and transitions to DAY_REVEAL. */
  resolveNight(): NightResolutionResult {
    const state = this.state;
    if (state.nightSubPhase !== NightSubPhase.RESOLVING) {
      throw new GameLogicError('Chưa sẵn sàng để xử lý kết quả đêm.', 'NOT_READY');
    }
    const result = resolveNightPure(state.players, this.nightDraft, state.dayCount);
    state.players = result.updatedPlayers;
    if (result.villagerSkillsShouldBeDisabled) {
      state.villagerActiveSkillsDisabled = true;
    }
    state.history.nights.push({
      dayNumber: state.dayCount,
      killedPlayerIds: result.killedPlayerIds,
      deathDetails: result.deathDetails.map((d) => ({ playerId: d.playerId, cause: d.cause })),
    });
    state.phase = GamePhase.DAY_REVEAL;
    state.phaseEndsAt = null;
    state.nightSubPhase = null;
    this.detectChiefDeath(result.killedPlayerIds);
    return result;
  }

  // ==================== Hunter retaliation ====================

  /**
   * Called whenever a Hunter has just died (from night resolution, a
   * vote, or — in principle — another Hunter's shot) and chooses their
   * target. Callers must always follow this with checkWinAndMaybeEndGame().
   */
  applyHunterShot(hunterId: string, targetId: string): HunterShotOutcome {
    const state = this.state;
    const hunter = state.players.find((p) => p.id === hunterId);
    if (!hunter || hunter.role !== RoleName.HUNTER || hunter.isAlive) {
      throw new GameLogicError('Chỉ Thợ săn vừa chết mới được bắn trả đũa.', 'INVALID_HUNTER');
    }
    const target = this.assertAliveTarget(targetId);
    if (target.id === hunterId) {
      throw new GameLogicError('Không thể tự bắn chính mình.', 'INVALID_TARGET');
    }
    const deaths = new Map<string, DeathCause>([[targetId, DeathCause.HUNTER_SHOT]]);
    const applied = applyDeaths(state.players, deaths, state.dayCount);
    state.players = applied.updatedPlayers;
    this.detectChiefDeath(applied.deathDetails.map((d) => d.playerId));
    return { deathDetails: applied.deathDetails, wildChildTurnedIds: applied.wildChildTurnedIds };
  }

  // ==================== DAY_REVEAL -> DISCUSSION -> VOTING ====================

  startDiscussion(): void {
    const state = this.state;
    if (state.phase !== GamePhase.DAY_REVEAL && state.phase !== GamePhase.MAYOR_ELECTION) {
      throw new GameLogicError('Sai giai đoạn.', 'WRONG_PHASE');
    }
    state.phase = GamePhase.DISCUSSION;
    state.phaseEndsAt = Date.now() + state.config.discussionDurationSeconds * 1000;
  }

  startVoting(): void {
    const state = this.state;
    if (state.phase !== GamePhase.DISCUSSION) {
      throw new GameLogicError('Sai giai đoạn.', 'WRONG_PHASE');
    }
    state.phase = GamePhase.VOTING;
    state.votingSubPhase = VotingSubPhase.FIRST_VOTE;
    state.phaseEndsAt = Date.now() + state.config.votingDurationSeconds * 1000;
    this.votes = {};
    this.tiedCandidateIds = null;
  }

  submitVote(voterId: string, targetId: string): void {
    const state = this.state;
    if (state.phase !== GamePhase.VOTING) {
      throw new GameLogicError('Không ở trong pha bỏ phiếu.', 'WRONG_PHASE');
    }
    const voter = state.players.find((p) => p.id === voterId);
    if (!voter || !voter.isAlive) {
      throw new GameLogicError('Chỉ người chơi còn sống mới được bỏ phiếu.', 'INVALID_VOTER');
    }
    if (voter.role === RoleName.IDIOT && voter.idiotState?.isRevealed) {
      throw new GameLogicError('Thằng Ngốc đã mất quyền bỏ phiếu treo cổ.', 'NO_VOTE_RIGHT');
    }
    this.assertAliveTarget(targetId);
    if (voterId === targetId) {
      throw new GameLogicError('Không thể tự bỏ phiếu cho chính mình.', 'SELF_VOTE');
    }
    if (this.tiedCandidateIds && !this.tiedCandidateIds.includes(targetId)) {
      throw new GameLogicError(
        'Vòng bầu lại chỉ được chọn trong số người bị hòa phiếu.',
        'INVALID_REVOTE_TARGET',
      );
    }
    this.votes[voterId] = targetId;
  }

  /** Village Chief's ballot counts double; everyone else counts once. */
  private getVoteWeights(): Record<string, number> {
    const weights: Record<string, number> = {};
    for (const p of this.state.players) {
      if (p.isVillageChief) weights[p.id] = 2;
    }
    return weights;
  }

  /** Live tally, safe to broadcast periodically while voting is in progress. */
  getVoteTally(): Record<string, number> {
    const weights = this.getVoteWeights();
    const tally: Record<string, number> = {};
    for (const [voterId, targetId] of Object.entries(this.votes)) {
      tally[targetId] = (tally[targetId] ?? 0) + (weights[voterId] ?? 1);
    }
    return tally;
  }

  /**
   * Corrupt Judge's one-time power: wipes all ballots cast so far today
   * and restarts voting from a clean FIRST_VOTE round, same day (no
   * revote-tie restriction carries over).
   */
  requestJudgeRevote(playerId: string): void {
    const state = this.state;
    if (state.phase !== GamePhase.VOTING) {
      throw new GameLogicError('Không ở trong pha bỏ phiếu.', 'WRONG_PHASE');
    }
    const judge = state.players.find((p) => p.id === playerId);
    if (!judge || !judge.isAlive || judge.role !== RoleName.CORRUPT_JUDGE) {
      throw new GameLogicError('Bạn không phải Thẩm Phán Hoen Ố.', 'WRONG_ROLE');
    }
    if (!judge.corruptJudgeState || judge.corruptJudgeState.hasUsedRevote) {
      throw new GameLogicError('Bạn đã dùng quyền này rồi.', 'ALREADY_USED');
    }
    judge.corruptJudgeState = { hasUsedRevote: true };
    state.votingSubPhase = VotingSubPhase.FIRST_VOTE;
    this.votes = {};
    this.tiedCandidateIds = null;
  }

  /**
   * Pure preview of what resolveVoting() would currently produce, WITHOUT
   * mutating any state. Lets the caller decide whether to hold a short
   * "does the Maid want to swap?" window before actually committing the
   * elimination. Safe to call repeatedly; votes aren't consumed.
   */
  peekVoteElimination(): VoteResolutionResult {
    const state = this.state;
    if (state.phase !== GamePhase.VOTING || !state.votingSubPhase) {
      throw new GameLogicError('Không ở trong pha bỏ phiếu.', 'WRONG_PHASE');
    }
    const aliveIds = state.players.filter((p) => p.isAlive).map((p) => p.id);
    let result = resolveVotes(this.votes, aliveIds, state.votingSubPhase, this.getVoteWeights());
    if (result.tiedPlayerIds.length >= 2) {
      const scapegoat = state.players.find((p) => p.role === RoleName.SCAPEGOAT && p.isAlive);
      if (scapegoat) {
        result = { ...result, eliminatedPlayerId: scapegoat.id, needsRevote: false };
      }
    }
    return result;
  }

  /**
   * Resolves the current voting round. On a tie in FIRST_VOTE, switches
   * to REVOTE (restricted to tied candidates) and returns needsRevote:
   * true — caller should re-open voting UI rather than proceed. On a
   * resolved elimination (or a REVOTE that ties again, per project
   * rules), applies the result and returns the outcome for broadcasting.
   *
   * `maidSwap`: true if a living Maid opted to take the victim's place
   * (see GameSession, which offers this choice using peekVoteElimination()
   * before ever calling resolveVoting()).
   */
  resolveVoting(maidSwap = false): VoteRoundOutcome {
    const state = this.state;
    if (state.phase !== GamePhase.VOTING || !state.votingSubPhase) {
      throw new GameLogicError('Không ở trong pha bỏ phiếu.', 'WRONG_PHASE');
    }
    const aliveIds = state.players.filter((p) => p.isAlive).map((p) => p.id);
    let result = resolveVotes(this.votes, aliveIds, state.votingSubPhase, this.getVoteWeights());

    // Scapegoat dies in place of the room whenever the vote ties (2+ people
    // tied for the most votes) — replaces the normal revote/no-elimination
    // tie handling entirely, as long as one is alive to take the fall.
    if (result.tiedPlayerIds.length >= 2) {
      const scapegoat = state.players.find((p) => p.role === RoleName.SCAPEGOAT && p.isAlive);
      if (scapegoat) {
        result = { ...result, eliminatedPlayerId: scapegoat.id, needsRevote: false };
      }
    }

    if (result.needsRevote) {
      state.votingSubPhase = VotingSubPhase.REVOTE;
      state.phaseEndsAt = Date.now() + state.config.votingDurationSeconds * 1000;
      this.tiedCandidateIds = result.tiedPlayerIds;
      this.votes = {};
      return { ...result, deathDetails: [], hunterPendingShotIds: [], revealedIdiotId: null, wildChildTurnedIds: [] };
    }

    let deathDetails: Array<{ playerId: string; cause: DeathCause }> = [];
    let hunterPendingShotIds: string[] = [];
    let wildChildTurnedIds: string[] = [];
    let revealedIdiotId: string | null = null;
    if (result.eliminatedPlayerId) {
      const target = state.players.find((p) => p.id === result.eliminatedPlayerId);
      const maid = maidSwap
        ? state.players.find((p) => p.role === RoleName.MAID && p.isAlive && p.id !== target?.id)
        : undefined;

      if (target && maid) {
        // Maid takes the victim's place: roles (and their state) swap, so
        // the ORIGINAL target survives — now wearing the Maid's old role —
        // while the Maid herself faces whatever fate the target's old role
        // would have faced (see `executedPlayer` below). This is what lets
        // her "lấy luôn chức năng của người đó" (fully inherit their
        // function), including a role like Idiot whose function IS
        // surviving the vote.
        const targetOldRole = target.role as RoleName;
        const maidOldRole = maid.role as RoleName;
        Object.assign(target, { role: maidOldRole, ...createRoleState(maidOldRole) });
        Object.assign(maid, { role: targetOldRole, ...createRoleState(targetOldRole) });
      }

      // Whoever is actually facing the noose right now — the original
      // target, or the Maid once she's swapped into that role above.
      const executedPlayer = maid ?? target;

      if (
        executedPlayer &&
        executedPlayer.role === RoleName.IDIOT &&
        executedPlayer.idiotState &&
        !executedPlayer.idiotState.isRevealed
      ) {
        // Spared once: publicly revealed, loses voting rights forever, stays
        // alive. Applies equally to the original Idiot and to a Maid who
        // just swapped into the Idiot's role — either way, this IS the
        // Idiot's function, so it must trigger for both.
        executedPlayer.idiotState = { isRevealed: true };
        revealedIdiotId = executedPlayer.id;
        result = { ...result, eliminatedPlayerId: null };
      } else if (executedPlayer) {
        // Routed through applyDeaths so Hunter/Elder/Wild-Child interactions
        // still work correctly for whichever role is actually dying here.
        const deaths = new Map<string, DeathCause>([[executedPlayer.id, DeathCause.VOTED_OUT]]);
        const applied = applyDeaths(state.players, deaths, state.dayCount);
        state.players = applied.updatedPlayers;
        deathDetails = applied.deathDetails;
        hunterPendingShotIds = applied.hunterPendingShotIds;
        wildChildTurnedIds = applied.wildChildTurnedIds;
        if (applied.villagerSkillsShouldBeDisabled) {
          state.villagerActiveSkillsDisabled = true;
        }
        // Report the player who ACTUALLY died — after a Maid swap this is
        // no longer the originally-voted target (who survives, wearing the
        // Maid's old role), so broadcasting the stale target id would tell
        // clients the wrong person was eliminated.
        result = { ...result, eliminatedPlayerId: executedPlayer.id };
      }
    }

    state.history.votes.push({
      round: state.votingSubPhase,
      votes: { ...this.votes },
      eliminatedPlayerId: result.eliminatedPlayerId,
    });
    this.detectChiefDeath(deathDetails.map((d) => d.playerId));

    return { ...result, deathDetails, hunterPendingShotIds, revealedIdiotId, wildChildTurnedIds };
  }

  /**
   * Night-death counterpart to the Maid's day-vote swap: called once,
   * right after resolveNight(), whenever a living Maid chose to swap
   * into one of that night's actual victims (see chosenVictimId). The
   * chosen victim survives — now wearing the Maid's old role — while the
   * Maid dies in their place, wearing the victim's old role and death
   * cause. Routed through the same applyDeaths used everywhere else so
   * Hunter/Elder/Wild-Child bookkeeping stays correct for whichever role
   * the Maid just inherited.
   *
   * `previous` is the NightResolutionResult (or the already-narrowed
   * fields from it) from the resolveNight() call this is correcting.
   * Returns the corrected deathDetails/hunterPendingShotIds/wildChildTurnedIds
   * — the caller should use these in place of the originals from here on.
   *
   * No-ops (returns `previous` unchanged) if the choice doesn't check
   * out: maid not found/not alive/not actually Maid, or chosenVictimId
   * wasn't really among tonight's deaths.
   *
   * Also retroactively undoes two cascades from the original (pre-swap)
   * death, now that it turned out not to be permanent: a Cupid-linked
   * lover who died of heartbreak earlier in the same resolveNight() call
   * is revived alongside the victim, and a pending Village Chief
   * succession request queued for a revived Chief is cancelled (they
   * keep the title uninterrupted). Night history logging still reflects
   * the original pre-swap outcome — a cosmetic "director's cut" gap in
   * the historical log, not a live-gameplay one.
   */
  applyMaidNightSwap(
    maidId: string,
    chosenVictimId: string,
    previous: {
      deathDetails: Array<{ playerId: string; cause: DeathCause }>;
      hunterPendingShotIds: string[];
      wildChildTurnedIds: string[];
    },
  ): {
    deathDetails: Array<{ playerId: string; cause: DeathCause }>;
    hunterPendingShotIds: string[];
    wildChildTurnedIds: string[];
  } {
    const state = this.state;
    const maid = state.players.find((p) => p.id === maidId);
    const victim = state.players.find((p) => p.id === chosenVictimId);
    const victimDeathEntry = previous.deathDetails.find((d) => d.playerId === chosenVictimId);

    if (!maid || maid.role !== RoleName.MAID || !maid.isAlive || !victim || !victimDeathEntry) {
      return previous;
    }

    const victimOldRole = victim.role as RoleName;
    const maidOldRole = maid.role as RoleName;
    let revivedIds = [chosenVictimId];

    // The chosen victim survives, now wearing the Maid's old role.
    Object.assign(victim, {
      isAlive: true,
      deathCause: null,
      diedOnDay: null,
      role: maidOldRole,
      ...createRoleState(maidOldRole),
    });

    // If the victim's death had already cascaded into their Cupid-linked
    // lover dying of heartbreak earlier in this same resolveNight() call,
    // undoing the original death should undo that cascade too — the
    // lover keeps their own role, they just stop being dead.
    if (victim.loverId) {
      const loverDeathEntry = previous.deathDetails.find(
        (d) => d.playerId === victim.loverId && d.cause === DeathCause.LOVER_HEARTBREAK,
      );
      const lover = state.players.find((p) => p.id === victim.loverId);
      if (loverDeathEntry && lover) {
        Object.assign(lover, { isAlive: true, deathCause: null, diedOnDay: null });
        revivedIds = [...revivedIds, lover.id];
      }
    }

    // The Maid dies in their place, inheriting the victim's old role and
    // exact death cause (wolf bite, poison, etc.).
    Object.assign(maid, { role: victimOldRole, ...createRoleState(victimOldRole) });
    const deaths = new Map<string, DeathCause>([[maid.id, victimDeathEntry.cause]]);
    const applied = applyDeaths(state.players, deaths, state.dayCount);
    state.players = applied.updatedPlayers;
    if (applied.villagerSkillsShouldBeDisabled) {
      state.villagerActiveSkillsDisabled = true;
    }

    // A revived Village Chief keeps the title uninterrupted: cancel any
    // successor pick that was queued while they were (temporarily) dead.
    if (this.pendingChiefSuccession && revivedIds.includes(this.pendingChiefSuccession.chiefId)) {
      this.pendingChiefSuccession = null;
    }

    return {
      deathDetails: [
        ...previous.deathDetails.filter((d) => !revivedIds.includes(d.playerId)),
        ...applied.deathDetails,
      ],
      hunterPendingShotIds: [
        ...previous.hunterPendingShotIds.filter((id) => !revivedIds.includes(id)),
        ...applied.hunterPendingShotIds,
      ],
      wildChildTurnedIds: [
        ...previous.wildChildTurnedIds.filter((id) => !revivedIds.includes(id)),
        ...applied.wildChildTurnedIds,
      ],
    };
  }

  // ==================== Village Chief (public elected title) ====================
  // Not a hidden role card — anyone (Villager, Werewolf, any special role)
  // can hold it. Elected once on day 1 discussion (if config.electMayor),
  // gives the holder a double-weighted vote, and passes to a successor of
  // the holder's choosing if they die (see detectChiefDeath below).

  enterMayorElection(): void {
    const state = this.state;
    state.phase = GamePhase.MAYOR_ELECTION;
    state.phaseEndsAt = Date.now() + state.config.votingDurationSeconds * 1000;
    this.votes = {};
  }

  castMayorVote(voterId: string, targetId: string): void {
    const state = this.state;
    if (state.phase !== GamePhase.MAYOR_ELECTION) {
      throw new GameLogicError('Không ở trong pha bầu Trưởng Làng.', 'WRONG_PHASE');
    }
    const voter = state.players.find((p) => p.id === voterId);
    if (!voter || !voter.isAlive) {
      throw new GameLogicError('Chỉ người chơi còn sống mới được bầu.', 'INVALID_VOTER');
    }
    this.assertAliveTarget(targetId);
    this.votes[voterId] = targetId;
  }

  /** Tallies the election (simple majority; ties broken at random — this
   * is a one-shot vote, not subject to the execution-vote revote rule)
   * and crowns the winner. Leaves `phase` unchanged; the caller (game
   * loop) moves on to DISCUSSION same as after DAY_REVEAL. */
  resolveMayorElection(): { electedPlayerId: string | null } {
    const state = this.state;
    if (state.phase !== GamePhase.MAYOR_ELECTION) {
      throw new GameLogicError('Không ở trong pha bầu Trưởng Làng.', 'WRONG_PHASE');
    }
    const aliveIds = state.players.filter((p) => p.isAlive).map((p) => p.id);
    const result = resolveVotes(this.votes, aliveIds, VotingSubPhase.FIRST_VOTE);
    const candidates = result.eliminatedPlayerId ? [result.eliminatedPlayerId] : result.tiedPlayerIds;
    const winnerId = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    if (winnerId) {
      const winner = state.players.find((p) => p.id === winnerId);
      if (winner) winner.isVillageChief = true;
    }
    this.votes = {};
    return { electedPlayerId: winnerId };
  }

  /** Called after any death-causing event settles — flags the dead
   * player's successor choice as pending if they held the title. */
  private detectChiefDeath(deadPlayerIds: string[]): void {
    const chief = this.state.players.find((p) => deadPlayerIds.includes(p.id) && p.isVillageChief);
    if (chief) this.pendingChiefSuccession = { chiefId: chief.id };
  }

  getPendingChiefSuccession(): { chiefId: string } | null {
    return this.pendingChiefSuccession;
  }

  /** The dying/dead Chief hands the title to a living player of their choice. */
  chooseChiefSuccessor(chiefId: string, successorId: string): void {
    if (!this.pendingChiefSuccession || this.pendingChiefSuccession.chiefId !== chiefId) {
      throw new GameLogicError('Bạn không có quyền chọn người kế nhiệm lúc này.', 'WRONG_PHASE');
    }
    const successor = this.state.players.find((p) => p.id === successorId && p.isAlive);
    if (!successor) {
      throw new GameLogicError('Người kế nhiệm không hợp lệ.', 'INVALID_TARGET');
    }
    const chief = this.state.players.find((p) => p.id === chiefId);
    if (chief) chief.isVillageChief = false;
    successor.isVillageChief = true;
    this.pendingChiefSuccession = null;
  }

  /** No successor chosen in time — the title goes vacant. */
  clearPendingChiefSuccession(): void {
    const pending = this.pendingChiefSuccession;
    if (!pending) return;
    const chief = this.state.players.find((p) => p.id === pending.chiefId);
    if (chief) chief.isVillageChief = false;
    this.pendingChiefSuccession = null;
  }

  // ==================== Win condition & loop ====================

  /** Call after any death-causing event settles (night, vote, Hunter shot). */
  checkWinAndMaybeEndGame(): WinResult {
    const state = this.state;
    const winner = checkWinCondition(state.players);
    if (winner) {
      state.winningTeam = winner;
      state.phase = GamePhase.GAME_OVER;
      state.phaseEndsAt = null;
    }
    return winner;
  }

  /** Call when voting resolved with no winner yet — loops back to NIGHT. */
  goToNextNight(): void {
    this.state.dayCount += 1;
    this.enterNightPhase();
  }

  getState(): Readonly<GameState> {
    return this.state;
  }
}
