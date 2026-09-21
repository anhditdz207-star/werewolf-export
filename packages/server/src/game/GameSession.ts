import { EventEmitter } from 'events';
import { GamePhase, NightActionConfirmedPayload, NightSubPhase, RoleName, ServerEvents, VotingSubPhase } from '@werewolf/shared';
import { Room } from '../rooms/Room';
import { GameStateMachine } from './fsm/GameStateMachine';
import { isWolfTeam } from './engine/NightResolver';
import type { NightResolutionResult } from './engine/NightResolver';
import { TIMING } from '../config/timing';

/**
 * GameSession wraps one Room + its GameStateMachine and is the piece
 * that actually makes the game "run itself": starting countdowns,
 * auto-advancing night sub-phases once the required actor(s) have
 * submitted, and looping NIGHT <-> DAY until a winner is decided.
 *
 * It knows NOTHING about Socket.IO. It communicates outward purely by
 * emitting events:
 *   - 'stateChanged'            -> socket layer should broadcast sanitized state to the room
 *   - 'privateEvent' (playerId, eventName, payload) -> socket layer sends to that player's socket only
 *   - 'broadcastEvent' (eventName, payload)         -> socket layer sends to everyone in the room
 *
 * This separation is what makes it possible to unit-test the entire
 * game loop (as we did for GameStateMachine) without ever starting an
 * HTTP or WebSocket server.
 */
export class GameSession extends EventEmitter {
  private fsm: GameStateMachine;
  private discussionTimer: ReturnType<typeof setTimeout> | null = null;
  private votingTimer: ReturnType<typeof setTimeout> | null = null;
  private thiefTimer: ReturnType<typeof setTimeout> | null = null;
  private maidTimer: ReturnType<typeof setTimeout> | null = null;
  private mayorElectionTimer: ReturnType<typeof setTimeout> | null = null;
  private chiefSuccessionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHunterIds: string[] = [];
  private pendingNightResult: NightResolutionResult | null = null;
  /** This night's confirmed actions so far — see ServerEvents.NIGHT_ACTION_LOG. */
  private nightEffectLog: NightActionConfirmedPayload[] = [];

  constructor(private room: Room) {
    super();
    this.fsm = new GameStateMachine(room);
  }

  get roomId(): string {
    return this.room.roomId;
  }

  // ==================== Lobby -> first night ====================

  handleStartGame(requestingPlayerId: string): void {
    this.fsm.startGame(requestingPlayerId);
    this.emitStateChanged();
    this.emitPrivateRoleAssignments();

    const state = this.room.getState();
    if (state.thiefSpareRoles) {
      const thief = state.players.find((p) => p.role === RoleName.THIEF);
      if (thief) {
        this.emit('privateEvent', thief.id, ServerEvents.THIEF_CARDS, {
          options: state.thiefSpareRoles,
        });
      }
      this.thiefTimer = setTimeout(() => this.resolveThief(null), TIMING.ROLE_REVEAL_DELAY_MS);
    } else {
      setTimeout(() => this.beginFirstNight(), TIMING.ROLE_REVEAL_DELAY_MS);
    }
  }

  handleThiefChoice(playerId: string, chosenRole: RoleName | null): void {
    const thief = this.room.getState().players.find((p) => p.id === playerId);
    if (!thief || thief.role !== RoleName.THIEF) {
      throw new Error('Bạn không phải Ăn Trộm.');
    }
    if (this.thiefTimer) clearTimeout(this.thiefTimer);
    this.resolveThief(chosenRole);
  }

  private resolveThief(chosenRole: RoleName | null): void {
    const outcome = this.fsm.resolveThief(chosenRole);
    if (outcome) {
      const players = this.room.getState().players;
      const teammateIds = isWolfTeam(outcome.newRole)
        ? players.filter((p) => isWolfTeam(p.role) && p.id !== outcome.playerId).map((p) => p.id)
        : undefined;
      this.emit('privateEvent', outcome.playerId, ServerEvents.ROLE_ASSIGNED, {
        role: outcome.newRole,
        teammateIds,
      });
    }
    this.emitStateChanged();
    this.beginFirstNight();
  }

  private emitPrivateRoleAssignments(): void {
    const players = this.room.getState().players;
    for (const player of players) {
      if (!player.role) continue;
      const teammateIds = isWolfTeam(player.role)
        ? players.filter((p) => isWolfTeam(p.role) && p.id !== player.id).map((p) => p.id)
        : undefined;
      this.emit('privateEvent', player.id, ServerEvents.ROLE_ASSIGNED, {
        role: player.role,
        teammateIds,
      });
    }
  }

  /** Twin Sisters / Three Brothers automatically learn each other's identity. */
  private emitFirstNightAllyReveals(): void {
    const players = this.room.getState().players;
    for (const role of [RoleName.TWIN_SISTERS, RoleName.THREE_BROTHERS]) {
      const members = players.filter((p) => p.role === role);
      if (members.length < 2) continue;
      const ids = members.map((p) => p.id);
      for (const member of members) {
        this.emit('privateEvent', member.id, ServerEvents.ALLY_REVEALED, {
          role,
          allyIds: ids.filter((id) => id !== member.id),
        });
      }
    }
  }

  /** Broadcasts a fresh role/teammates reveal to any player who just flipped teams. */
  private emitWildChildTurned(ids: string[]): void {
    if (ids.length === 0) return;
    const players = this.room.getState().players;
    for (const id of ids) {
      const teammateIds = players.filter((p) => isWolfTeam(p.role) && p.id !== id).map((p) => p.id);
      this.emit('privateEvent', id, ServerEvents.ROLE_ASSIGNED, {
        role: RoleName.WEREWOLF,
        teammateIds,
      });
    }
  }

  private beginFirstNight(): void {
    this.nightEffectLog = [];
    this.fsm.beginFirstNight();
    this.emitStateChanged();
    this.emitFirstNightAllyReveals();
    this.promptCurrentNightActors();
  }

  // ==================== Night flow ====================

  private promptCurrentNightActors(): void {
    const state = this.room.getState();
    if (state.phase !== GamePhase.NIGHT || !state.nightSubPhase) return;

    if (state.nightSubPhase === NightSubPhase.RESOLVING) {
      this.resolveNightAndContinue();
      return;
    }

    const actorIds = this.fsm.getCurrentNightActorIds();
    if (actorIds.length === 0) {
      // Defensive fallback: NightOrder should already skip sub-phases with
      // no eligible actor, but if it ever happens, don't stall the game.
      this.advanceNightSubPhase();
      return;
    }

    const eligibleTargetIds = this.fsm.getEligibleTargets(state.nightSubPhase);
    for (const actorId of actorIds) {
      this.emit('privateEvent', actorId, ServerEvents.NIGHT_PROMPT, {
        subPhase: state.nightSubPhase,
        eligibleTargetIds,
        timeoutSeconds: TIMING.NIGHT_ACTION_TIMEOUT_SECONDS,
      });
    }
  }

  /**
   * Called by the socket handler right after any successful night-action
   * submission. For this MVP, one valid submission from the required
   * role is treated as that sub-phase's final decision (werewolves
   * coordinate their single choice via their own chat, outside this
   * state machine) — so we advance immediately rather than waiting for
   * every eligible actor individually.
   *
   * `targetIds` (when the action has a visible target and a matching
   * RoleActionEffect exists client-side — see NightActionPanel) is
   * privately relayed to two groups, and nobody else:
   *  - other actors of this same sub-phase who didn't submit (in
   *    practice only the rest of the werewolf pack, since every other
   *    role is a party of one), so they see what the pack decided.
   *  - every currently dead player, so ghosts can watch the night
   *    unfold — same "dead players see everything" spectator rule as
   *    StateSanitizer already applies to roles.
   * Living non-teammates never receive this.
   */
  onNightActionSubmitted(targetIds: string[] = []): void {
    const state = this.room.getState();
    const finishedSubPhase = state.nightSubPhase;
    if (finishedSubPhase && targetIds.length > 0) {
      const entry: NightActionConfirmedPayload = { subPhase: finishedSubPhase, targetIds };
      this.nightEffectLog.push(entry);
      const actorIds = this.fsm.getCurrentNightActorIds();
      const deadIds = state.players.filter((p) => !p.isAlive).map((p) => p.id);
      const recipients = new Set([...actorIds, ...deadIds]);
      for (const recipientId of recipients) {
        this.emit('privateEvent', recipientId, ServerEvents.NIGHT_ACTION_CONFIRMED, entry);
      }
    }
    this.advanceNightSubPhase();
  }

  /** This night's log so far — see ServerEvents.NIGHT_ACTION_LOG. */
  getNightEffectLog(): NightActionConfirmedPayload[] {
    return this.nightEffectLog;
  }

  /** Called by the socket handler if a night-action timer expires with no submission. */
  onNightActionTimeout(): void {
    this.advanceNightSubPhase();
  }

  private advanceNightSubPhase(): void {
    this.fsm.advanceNightSubPhase();
    this.emitStateChanged();
    this.promptCurrentNightActors();
  }

  private resolveNightAndContinue(): void {
    const result = this.fsm.resolveNight();

    if (result.seerResult) {
      const seer = this.room.getState().players.find((p) => p.role === RoleName.SEER);
      if (seer) {
        this.emit('privateEvent', seer.id, ServerEvents.SEER_RESULT, result.seerResult);
      }
    }

    if (result.convertedPlayerId) {
      const players = this.room.getState().players;
      const teammateIds = players
        .filter((p) => p.role === RoleName.WEREWOLF && p.id !== result.convertedPlayerId)
        .map((p) => p.id);
      this.emit('privateEvent', result.convertedPlayerId, ServerEvents.ROLE_ASSIGNED, {
        role: RoleName.WEREWOLF,
        teammateIds,
      });
    }

    if (result.littleGirlResult) {
      const littleGirl = this.room.getState().players.find((p) => p.role === RoleName.LITTLE_GIRL);
      if (littleGirl) {
        this.emit(
          'privateEvent',
          littleGirl.id,
          ServerEvents.LITTLE_GIRL_RESULT,
          result.littleGirlResult,
        );
      }
    }

    if (result.foxResult) {
      const fox = this.room.getState().players.find((p) => p.role === RoleName.FOX);
      if (fox) {
        this.emit('privateEvent', fox.id, ServerEvents.FOX_RESULT, result.foxResult);
      }
    }

    if (result.bearGrowl) {
      this.emit('broadcastEvent', ServerEvents.BEAR_GROWL, {});
    }

    if (result.cultNewMemberId) {
      const players = this.room.getState().players;
      const leader = players.find((p) => p.role === RoleName.CULT_LEADER);
      if (leader) {
        this.emit('privateEvent', result.cultNewMemberId, ServerEvents.CULT_UPDATE, {
          leaderId: leader.id,
          memberIds: players.filter((p) => p.isCultMember).map((p) => p.id),
        });
      }
    }

    // Everything from here on (DAY_REVEAL, the general state broadcast,
    // Chief succession, Hunter's revenge shot) waits until the Maid has
    // had her chance to swap into one of tonight's victims — otherwise
    // players would see a death announced and then quietly reversed.
    this.maybePromptMaidNightSwap(result);
  }

  /**
   * If a living Maid is around and at least one player died tonight,
   * privately offers her the choice to swap into one of them (see
   * GameStateMachine.applyMaidNightSwap) before the night's outcome is
   * revealed to everyone else. Otherwise proceeds immediately.
   */
  private maybePromptMaidNightSwap(result: NightResolutionResult): void {
    const players = this.room.getState().players;
    const maid = players.find((p) => p.role === RoleName.MAID && p.isAlive);

    if (maid && result.deathDetails.length > 0) {
      const candidates = result.deathDetails.map((d) => ({
        playerId: d.playerId,
        role: players.find((p) => p.id === d.playerId)!.role as RoleName,
      }));
      this.pendingNightResult = result;
      this.emit('privateEvent', maid.id, ServerEvents.MAID_NIGHT_PROMPT, { candidates });
      this.maidTimer = setTimeout(
        () => this.finalizeNightAfterMaid(null),
        TIMING.MAID_DECISION_TIMEOUT_MS,
      );
      return;
    }

    this.pendingNightResult = result;
    this.finalizeNightAfterMaid(null);
  }

  /** Called from the socket handler once the Maid answers (or the decision timer lapses). */
  handleMaidNightSwap(playerId: string, chosenVictimId: string | null): void {
    const maid = this.room.getState().players.find((p) => p.id === playerId);
    if (!maid || maid.role !== RoleName.MAID) {
      throw new Error('Bạn không phải Hầu Gái.');
    }
    if (this.maidTimer) clearTimeout(this.maidTimer);
    this.finalizeNightAfterMaid(chosenVictimId);
  }

  private finalizeNightAfterMaid(chosenVictimId: string | null): void {
    let result = this.pendingNightResult;
    if (!result) return; // already finalized — ignore a late/duplicate call
    this.pendingNightResult = null;

    if (chosenVictimId) {
      const maid = this.room.getState().players.find((p) => p.role === RoleName.MAID && p.isAlive);
      if (maid) {
        const swapped = this.fsm.applyMaidNightSwap(maid.id, chosenVictimId, result);
        result = { ...result, ...swapped };
      }
    }

    this.emitWildChildTurned(result.wildChildTurnedIds);
    this.emit('broadcastEvent', ServerEvents.DAY_REVEAL, {
      dayCount: this.room.getState().dayCount,
      deaths: result.deathDetails,
    });
    this.emitStateChanged();
    this.maybePromptChiefSuccession();

    if (result.hunterPendingShotIds.length > 0) {
      this.promptHunters(result.hunterPendingShotIds);
    } else {
      this.afterDeathsSettled();
    }
  }

  // ==================== Hunter retaliation ====================

  private promptHunters(hunterIds: string[]): void {
    this.pendingHunterIds = [...hunterIds];
    const eligibleTargetIds = this.room.getAlivePlayers().map((p) => p.id);
    for (const hunterId of hunterIds) {
      this.emit('privateEvent', hunterId, ServerEvents.HUNTER_PROMPT, {
        eligibleTargetIds,
        timeoutSeconds: TIMING.HUNTER_SHOT_TIMEOUT_SECONDS,
      });
    }
  }

  handleHunterShot(hunterId: string, targetId: string): void {
    if (!this.pendingHunterIds.includes(hunterId)) {
      throw new Error('Không phải lượt bắn của bạn.');
    }
    const outcome = this.fsm.applyHunterShot(hunterId, targetId);
    this.emitWildChildTurned(outcome.wildChildTurnedIds);
    this.pendingHunterIds = this.pendingHunterIds.filter((id) => id !== hunterId);
    this.emitStateChanged();
    this.maybePromptChiefSuccession();

    if (this.pendingHunterIds.length === 0) {
      this.afterDeathsSettled();
    }
  }

  /** Called after any death-causing event (night, vote, Hunter shot) has fully settled. */
  private afterDeathsSettled(): void {
    const winner = this.fsm.checkWinAndMaybeEndGame();
    if (winner) {
      this.emitGameOver(winner);
      return;
    }

    const state = this.room.getState();
    if (state.phase === GamePhase.VOTING) {
      this.nightEffectLog = [];
      this.fsm.goToNextNight();
      this.emitStateChanged();
      this.promptCurrentNightActors();
    } else if (state.phase === GamePhase.DAY_REVEAL) {
      const hasChief = state.players.some((p) => p.isVillageChief);
      if (state.config.electMayor && state.dayCount === 1 && !hasChief) {
        setTimeout(() => this.handleStartMayorElection(), TIMING.DAY_REVEAL_DISPLAY_MS);
      } else {
        setTimeout(() => this.handleStartDiscussion(), TIMING.DAY_REVEAL_DISPLAY_MS);
      }
    }
  }

  private emitGameOver(
    winningTeam: 'VILLAGER' | 'WEREWOLF' | 'WHITE_WOLF' | 'ANGEL' | 'FLUTIST' | 'CULT_LEADER',
  ): void {
    this.clearTimers();
    this.emit('broadcastEvent', ServerEvents.GAME_OVER, {
      winningTeam,
      allPlayers: this.room.getState().players,
    });
    this.emitStateChanged();
  }

  // ==================== Night action entry points ====================
  // Each simply delegates to the FSM (which validates + throws
  // GameLogicError on invalid input) then advances the sub-phase.

  handleWerewolfTarget(playerId: string, targetId: string): void {
    this.fsm.submitWerewolfTarget(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  handleWerewolfBonusTarget(playerId: string, targetId: string): void {
    this.fsm.submitWerewolfBonusTarget(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  handleFatherWolfDecision(playerId: string, convert: boolean): void {
    this.fsm.submitFatherWolfDecision(playerId, convert);
    this.onNightActionSubmitted();
  }

  handleWhiteWolfTarget(playerId: string, targetId: string): void {
    this.fsm.submitWhiteWolfTarget(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  handleLittleGirlPeek(playerId: string, peek: boolean): void {
    this.fsm.submitLittleGirlPeek(playerId, peek);
    this.onNightActionSubmitted();
  }

  handleFoxTarget(playerId: string, targetId: string): void {
    this.fsm.submitFoxTarget(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  handleFlutistTargets(playerId: string, targetIds: string[]): void {
    this.fsm.submitFlutistTargets(playerId, targetIds);
    this.onNightActionSubmitted(targetIds);
  }

  handleCultLeaderTarget(playerId: string, targetId: string): void {
    this.fsm.submitCultLeaderTarget(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  handleGuardTarget(playerId: string, targetId: string): void {
    this.fsm.submitGuardTarget(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  handleSeerTarget(playerId: string, targetId: string): void {
    this.fsm.submitSeerTarget(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  handleWitchAction(playerId: string, action: 'heal' | 'poison' | 'skip', targetId?: string): void {
    this.fsm.submitWitchAction(playerId, action, targetId);
    this.onNightActionSubmitted(action === 'poison' && targetId ? [targetId] : []);
  }

  handleCupidTargets(playerId: string, targetId1: string, targetId2: string): void {
    this.fsm.submitCupidTargets(playerId, targetId1, targetId2);
    this.onNightActionSubmitted([targetId1, targetId2]);
  }

  handleWildChildIdol(playerId: string, targetId: string): void {
    this.fsm.submitWildChildIdol(playerId, targetId);
    this.onNightActionSubmitted([targetId]);
  }

  // ==================== Village Chief election & succession ====================

  private handleStartMayorElection(): void {
    this.fsm.enterMayorElection();
    this.emitStateChanged();
    const durationMs = this.room.getState().config.votingDurationSeconds * 1000;
    this.mayorElectionTimer = setTimeout(() => this.handleResolveMayorElection(), durationMs);
  }

  handleMayorVoteCast(voterId: string, targetId: string): void {
    this.fsm.castMayorVote(voterId, targetId);
    this.emit('broadcastEvent', ServerEvents.VOTE_TALLY, { tally: this.fsm.getVoteTally() });
  }

  private handleResolveMayorElection(): void {
    if (this.mayorElectionTimer) clearTimeout(this.mayorElectionTimer);
    const { electedPlayerId } = this.fsm.resolveMayorElection();
    if (electedPlayerId) {
      this.emit('broadcastEvent', ServerEvents.MAYOR_ELECTED, { playerId: electedPlayerId });
    }
    this.handleStartDiscussion();
  }

  /** Non-blocking: fires a short private prompt if the player(s) who just
   * died included the Village Chief. Does not pause the game loop — if
   * the chief doesn't answer in time, the title simply goes vacant. */
  private maybePromptChiefSuccession(): void {
    const pending = this.fsm.getPendingChiefSuccession();
    if (!pending) return;
    const eligibleTargetIds = this.room.getAlivePlayers().map((p) => p.id);
    if (eligibleTargetIds.length === 0) {
      this.fsm.clearPendingChiefSuccession();
      return;
    }
    this.emit('privateEvent', pending.chiefId, ServerEvents.CHIEF_SUCCESSOR_PROMPT, {
      eligibleTargetIds,
      timeoutSeconds: TIMING.CHIEF_SUCCESSOR_TIMEOUT_SECONDS,
    });
    this.chiefSuccessionTimer = setTimeout(() => {
      this.fsm.clearPendingChiefSuccession();
      this.emitStateChanged();
    }, TIMING.CHIEF_SUCCESSOR_TIMEOUT_SECONDS * 1000);
  }

  handleChiefChooseSuccessor(chiefId: string, successorId: string): void {
    if (this.chiefSuccessionTimer) clearTimeout(this.chiefSuccessionTimer);
    this.fsm.chooseChiefSuccessor(chiefId, successorId);
    this.emit('broadcastEvent', ServerEvents.MAYOR_ELECTED, { playerId: successorId });
    this.emitStateChanged();
  }

  // ==================== Day flow ====================

  private handleStartDiscussion(): void {
    this.fsm.startDiscussion();
    this.emitStateChanged();
    const durationMs = this.room.getState().config.discussionDurationSeconds * 1000;
    this.discussionTimer = setTimeout(() => this.handleStartVoting(), durationMs);
  }

  private handleStartVoting(): void {
    if (this.discussionTimer) clearTimeout(this.discussionTimer);
    this.fsm.startVoting();
    this.emitStateChanged();
    this.scheduleVoteResolution();
  }

  private scheduleVoteResolution(): void {
    const durationMs = this.room.getState().config.votingDurationSeconds * 1000;
    this.votingTimer = setTimeout(() => this.handleResolveVoting(), durationMs);
  }

  handleVoteCast(voterId: string, targetId: string): void {
    this.fsm.submitVote(voterId, targetId);
    this.emit('broadcastEvent', ServerEvents.VOTE_TALLY, { tally: this.fsm.getVoteTally() });
  }

  handleJudgeRevote(playerId: string): void {
    this.fsm.requestJudgeRevote(playerId);
    if (this.votingTimer) clearTimeout(this.votingTimer);
    this.emit('broadcastEvent', ServerEvents.VOTE_TALLY, { tally: this.fsm.getVoteTally() });
    this.emitStateChanged();
    this.scheduleVoteResolution();
  }

  private handleResolveVoting(): void {
    if (this.votingTimer) clearTimeout(this.votingTimer);
    const preview = this.fsm.peekVoteElimination();

    if (preview.eliminatedPlayerId && !preview.needsRevote) {
      const victimId = preview.eliminatedPlayerId;
      const maid = this.room
        .getState()
        .players.find((p) => p.role === RoleName.MAID && p.isAlive && p.id !== victimId);
      if (maid) {
        this.emit('privateEvent', maid.id, ServerEvents.MAID_PROMPT, { victimId });
        this.maidTimer = setTimeout(
          () => this.finalizeVoting(false),
          TIMING.MAID_DECISION_TIMEOUT_MS,
        );
        return;
      }
    }
    this.finalizeVoting(false);
  }

  handleMaidSwap(playerId: string, swap: boolean): void {
    const maid = this.room.getState().players.find((p) => p.id === playerId);
    if (!maid || maid.role !== RoleName.MAID) {
      throw new Error('Bạn không phải Hầu Gái.');
    }
    if (this.maidTimer) clearTimeout(this.maidTimer);
    this.finalizeVoting(swap);
  }

  private finalizeVoting(maidSwap: boolean): void {
    const outcome = this.fsm.resolveVoting(maidSwap);
    const wasRevote = this.room.getState().votingSubPhase === VotingSubPhase.REVOTE;

    if (outcome.revealedIdiotId) {
      this.emit('broadcastEvent', ServerEvents.ROLE_REVEALED, {
        playerId: outcome.revealedIdiotId,
        role: RoleName.IDIOT,
      });
    }
    this.emitWildChildTurned(outcome.wildChildTurnedIds);

    this.emit('broadcastEvent', ServerEvents.VOTE_RESULT, {
      eliminatedPlayerId: outcome.eliminatedPlayerId,
      wasRevote,
    });
    this.emitStateChanged();
    this.maybePromptChiefSuccession();

    if (outcome.needsRevote) {
      this.scheduleVoteResolution();
      return;
    }

    if (outcome.hunterPendingShotIds.length > 0) {
      this.promptHunters(outcome.hunterPendingShotIds);
    } else {
      this.afterDeathsSettled();
    }
  }

  // ==================== Chat ====================

  handleChatMessage(playerId: string, nickname: string, text: string): void {
    this.emit('broadcastEvent', ServerEvents.CHAT_MESSAGE, {
      playerId,
      nickname,
      text,
      timestamp: Date.now(),
    });
  }

  // ==================== Cleanup ====================

  clearTimers(): void {
    if (this.discussionTimer) clearTimeout(this.discussionTimer);
    if (this.votingTimer) clearTimeout(this.votingTimer);
    if (this.mayorElectionTimer) clearTimeout(this.mayorElectionTimer);
    if (this.chiefSuccessionTimer) clearTimeout(this.chiefSuccessionTimer);
  }

  private emitStateChanged(): void {
    this.emit('stateChanged');
  }
}
