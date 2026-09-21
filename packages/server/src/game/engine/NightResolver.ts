import { DeathCause, Player, RoleName } from '@werewolf/shared';
import { applyDeaths } from './DeathResolver';

/** All roles that belong to the werewolf team. */
export const WOLF_TEAM_ROLES: RoleName[] = [
  RoleName.WEREWOLF,
  RoleName.WOLF_CUB,
  RoleName.FATHER_WOLF,
  RoleName.ALPHA_WOLF,
  RoleName.WHITE_WOLF,
];

export function isWolfTeam(role: RoleName | null): boolean {
  return role !== null && WOLF_TEAM_ROLES.includes(role);
}

/** True on the night right after the Wolf Cub died (bites go 1 -> 2 that night). */
export function wolfCubBonusActive(players: Player[], dayCount: number): boolean {
  return players.some(
    (p) => p.role === RoleName.WOLF_CUB && !p.isAlive && p.diedOnDay === dayCount - 1,
  );
}

/**
 * True while the Alpha Wolf is alive and no other wolf-team member has ever
 * died. Lost permanently (for the rest of the game) the instant any other
 * wolf dies, regardless of cause.
 */
export function alphaBonusActive(players: Player[]): boolean {
  const alpha = players.find((p) => p.role === RoleName.ALPHA_WOLF);
  if (!alpha || !alpha.isAlive) return false;
  return !players.some((p) => isWolfTeam(p.role) && p.id !== alpha.id && !p.isAlive);
}

/** Whether the pack gets to choose a 2nd, separate victim tonight. */
export function wolfBonusBiteActive(players: Player[], dayCount: number): boolean {
  return wolfCubBonusActive(players, dayCount) || alphaBonusActive(players);
}

/** Whether the Father Wolf may still use their one-time conversion. */
export function fatherWolfDecisionAvailable(players: Player[]): boolean {
  const father = players.find((p) => p.role === RoleName.FATHER_WOLF);
  return !!father && father.isAlive && !!father.fatherWolfState && !father.fatherWolfState.hasUsedConversion;
}

/** Whether the White Wolf's solo kill is off cooldown tonight (once per 2 nights). */
export function whiteWolfActionAvailable(players: Player[], dayCount: number): boolean {
  const white = players.find((p) => p.role === RoleName.WHITE_WOLF);
  if (!white || !white.isAlive || !white.whiteWolfState) return false;
  const last = white.whiteWolfState.lastActionDayCount;
  return last === null || dayCount - last >= 2;
}

/** Chance the Little Girl gets caught peeking, and bitten instead of the pack's victim. */
export const LITTLE_GIRL_DETECTION_CHANCE = 0.2;

/**
 * Returns the 2 players seated immediately left/right of `playerId` in the
 * room's seating order (players array, treated as a round table). Order
 * within the roster never changes, so this reflects a fixed seating chart
 * regardless of who is alive or dead.
 */
export function getCircularNeighbors(players: Player[], playerId: string): [Player, Player] | null {
  const idx = players.findIndex((p) => p.id === playerId);
  if (idx === -1 || players.length < 2) return null;
  const prev = players[(idx - 1 + players.length) % players.length];
  const next = players[(idx + 1) % players.length];
  return [prev, next];
}

/**
 * If the Rusty Knight was bitten to death by wolves last night, the wolf
 * seated to their left (previous in the roster, "bàn tròn") dies tonight
 * from rusty-sword poisoning — an independent death, not one of tonight's
 * pack bites. Returns null if no such kill is pending.
 */
export function rustyKnightPoisonTargetId(players: Player[], dayCount: number): string | null {
  const knight = players.find(
    (p) =>
      p.role === RoleName.RUSTY_KNIGHT &&
      !p.isAlive &&
      p.diedOnDay === dayCount - 1 &&
      (p.deathCause === DeathCause.WEREWOLF || p.deathCause === DeathCause.WHITE_WOLF),
  );
  if (!knight) return null;
  const neighbors = getCircularNeighbors(players, knight.id);
  if (!neighbors) return null;
  const left = neighbors[0];
  return left.isAlive && isWolfTeam(left.role) ? left.id : null;
}

/**
 * Draft of everything each role decided during the NIGHT phase, collected
 * by GameStateMachine as sub-phases progress. `null` fields mean that
 * role either isn't in the game, has no living player, or chose to skip.
 */
export interface NightActionsDraft {
  wolfTargetId: string | null;
  /** 2nd pack victim, only meaningful when wolfBonusBiteActive() was true. */
  wolfBonusTargetId: string | null;
  /** Father Wolf's choice for whether to convert the pack's victim tonight. */
  fatherWolfConvert: boolean;
  /** White Wolf's solo kill target (must be a fellow wolf), if used tonight. */
  whiteWolfTargetId: string | null;
  /** Little Girl's opt-in choice to peek while the wolves confer. */
  littleGirlPeeking: boolean;
  /** Fox's chosen center-of-scan target. */
  foxTargetId: string | null;
  /** Flutist's hypnosis picks tonight (0-2 ids). */
  flutistTargetIds: string[];
  /** Cult Leader's recruitment pick tonight, if any. */
  cultLeaderTargetId: string | null;
  seerTargetId: string | null;
  guardTargetId: string | null;
  witchAction: { type: 'heal' | 'poison' | 'skip'; targetId: string | null };
  /** Only ever set on day 1 (Cupid's only night of action). */
  cupidTargetIds: [string, string] | null;
}

export function createEmptyNightDraft(): NightActionsDraft {
  return {
    wolfTargetId: null,
    wolfBonusTargetId: null,
    fatherWolfConvert: false,
    whiteWolfTargetId: null,
    littleGirlPeeking: false,
    foxTargetId: null,
    flutistTargetIds: [],
    cultLeaderTargetId: null,
    seerTargetId: null,
    guardTargetId: null,
    witchAction: { type: 'skip', targetId: null },
    cupidTargetIds: null,
  };
}

export interface NightResolutionResult {
  updatedPlayers: Player[];
  killedPlayerIds: string[];
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
  seerResult: { targetId: string; isWerewolf: boolean } | null;
  hunterPendingShotIds: string[];
  /** Set when Father Wolf converted the pack's victim into a Werewolf tonight. */
  convertedPlayerId: string | null;
  /** Private result for the Little Girl, if she peeked tonight. */
  littleGirlResult: { werewolfIds: string[] } | null;
  /** Private result for the Fox, if she scouted tonight. */
  foxResult: { targetId: string; hasWolf: boolean } | null;
  /** True if the Bear Tamer is alive and seated next to a living wolf this morning. */
  bearGrowl: boolean;
  /** Propagated from applyDeaths — Elder died from a non-wolf cause tonight. */
  villagerSkillsShouldBeDisabled: boolean;
  /** Wild Children who flipped to Werewolf tonight (their idol died). */
  wildChildTurnedIds: string[];
  /** Newly-recruited cult member tonight, if any. */
  cultNewMemberId: string | null;
}

/**
 * Resolves one night. Does not mutate its inputs — returns new Player
 * objects. Rule assumptions encoded here:
 *
 *  - Witch's heal only saves the werewolves' chosen PRIMARY victim (the
 *    witch never sees/chooses any other target for the heal potion).
 *    Self-heal IS allowed if the witch herself is that victim.
 *  - Witch may use at most one potion per night (heal OR poison, not
 *    both) — enforced by the `witchAction` shape (a single `type`).
 *  - Guard's protection applies to whichever pack victim (primary or
 *    bonus) matches their chosen target.
 *  - Poison always kills, regardless of Guard protection (Guard only
 *    protects against the werewolves' attack).
 *  - Father Wolf's conversion, if used, takes priority over the primary
 *    victim dying: the victim survives (regardless of guard/witch) and
 *    switches to the WEREWOLF role instead.
 *  - White Wolf's solo kill bypasses Guard/Witch (a separate, unguarded
 *    attack) and always kills a fellow wolf outright.
 *  - Cupid lover cascade and Hunter detection are delegated to
 *    DeathResolver.applyDeaths so that logic isn't duplicated with
 *    vote-elimination and Hunter's own shot.
 */
export function resolveNight(
  players: Player[],
  draft: NightActionsDraft,
  dayCount: number,
): NightResolutionResult {
  // Work on copies so this function has zero side effects on its inputs.
  let working: Player[] = players.map((p) => ({ ...p }));
  const byId = new Map(working.map((p) => [p.id, p]));

  // 1. Cupid pairing (first night only).
  if (dayCount === 1 && draft.cupidTargetIds) {
    const [id1, id2] = draft.cupidTargetIds;
    const p1 = byId.get(id1);
    const p2 = byId.get(id2);
    if (p1 && p2) {
      p1.loverId = id2;
      p2.loverId = id1;
    }
  }

  const initialDeaths = new Map<string, DeathCause>();
  let convertedPlayerId: string | null = null;

  // Rusty Knight's delayed retaliation — independent of tonight's pack bite.
  const rustyTargetId = rustyKnightPoisonTargetId(working, dayCount);
  if (rustyTargetId) {
    initialDeaths.set(rustyTargetId, DeathCause.RUSTY_KNIGHT_POISON);
  }

  // 2. Father Wolf conversion — decided before the primary victim's fate,
  // since it pre-empts the kill entirely.
  const wolfVictim = draft.wolfTargetId ? byId.get(draft.wolfTargetId) : undefined;
  const fatherWolf = working.find((p) => p.role === RoleName.FATHER_WOLF);
  const converting =
    draft.fatherWolfConvert &&
    !!wolfVictim &&
    !!fatherWolf &&
    !!fatherWolf.fatherWolfState &&
    !fatherWolf.fatherWolfState.hasUsedConversion;

  if (fatherWolf && draft.fatherWolfConvert && fatherWolf.fatherWolfState) {
    // Consumes the one-time ability whenever Father Wolf commits to using
    // it tonight, even in the edge case the pack had no victim to convert.
    fatherWolf.fatherWolfState = { hasUsedConversion: true };
  }

  if (converting && wolfVictim) {
    const victim = byId.get(wolfVictim.id)!;
    victim.role = RoleName.WEREWOLF;
    victim.witchState = null;
    victim.guardState = null;
    victim.fatherWolfState = null;
    victim.whiteWolfState = null;
    convertedPlayerId = victim.id;
  }

  // 3. Werewolf attack(s), subject to Guard protection and Witch heal.
  // Only the PRIMARY victim can be healed by the Witch (existing rule);
  // Guard's single chosen target can match either the primary or the
  // bonus victim.
  if (!converting && wolfVictim) {
    const savedByGuard = draft.guardTargetId === wolfVictim.id;
    const savedByWitch =
      draft.witchAction.type === 'heal' && draft.witchAction.targetId === wolfVictim.id;
    if (!savedByGuard && !savedByWitch) {
      initialDeaths.set(wolfVictim.id, DeathCause.WEREWOLF);
    }
  }

  const bonusVictim = draft.wolfBonusTargetId ? byId.get(draft.wolfBonusTargetId) : undefined;
  if (bonusVictim) {
    const savedByGuard = draft.guardTargetId === bonusVictim.id;
    if (!savedByGuard) {
      initialDeaths.set(bonusVictim.id, DeathCause.WEREWOLF);
    }
  }

  // 4. White Wolf's solo kill — unconditional, bypasses Guard/Witch.
  const whiteWolf = working.find((p) => p.role === RoleName.WHITE_WOLF);
  if (draft.whiteWolfTargetId && whiteWolf && whiteWolf.whiteWolfState) {
    initialDeaths.set(draft.whiteWolfTargetId, DeathCause.WHITE_WOLF);
    whiteWolf.whiteWolfState = { lastActionDayCount: dayCount };
  }

  // 5. Little Girl's peek — reveals all werewolves' identities to her, with
  // a risk of being detected and bitten INSTEAD of the pack's real victim
  // (the original victim is spared in that case).
  let littleGirlResult: NightResolutionResult['littleGirlResult'] = null;
  const littleGirl = working.find((p) => p.role === RoleName.LITTLE_GIRL);
  if (draft.littleGirlPeeking && littleGirl && littleGirl.isAlive) {
    littleGirlResult = { werewolfIds: working.filter((p) => isWolfTeam(p.role)).map((p) => p.id) };
    if (Math.random() < LITTLE_GIRL_DETECTION_CHANCE) {
      if (wolfVictim) initialDeaths.delete(wolfVictim.id);
      initialDeaths.set(littleGirl.id, DeathCause.WEREWOLF);
    }
  }

  // 6. Witch poison — unconditional, overrides werewolf cause if same target.
  if (draft.witchAction.type === 'poison' && draft.witchAction.targetId) {
    initialDeaths.set(draft.witchAction.targetId, DeathCause.WITCH_POISON);
  }

  // 7. Persist Guard's target for the "no repeat target" rule next night.
  const guardPlayer = working.find((p) => p.role === RoleName.GUARD);
  if (guardPlayer && guardPlayer.guardState) {
    guardPlayer.guardState = { lastProtectedPlayerId: draft.guardTargetId };
  }

  // 8. Consume Witch's potion if she acted (even if the heal "missed").
  const witchPlayer = working.find((p) => p.role === RoleName.WITCH);
  if (witchPlayer && witchPlayer.witchState) {
    if (draft.witchAction.type === 'heal') {
      witchPlayer.witchState = { ...witchPlayer.witchState, hasHealPotion: false };
    } else if (draft.witchAction.type === 'poison') {
      witchPlayer.witchState = { ...witchPlayer.witchState, hasPoisonPotion: false };
    }
  }

  // 9. Apply deaths (handles lover cascade + Hunter detection centrally).
  const { updatedPlayers, deathDetails, hunterPendingShotIds, villagerSkillsShouldBeDisabled, wildChildTurnedIds } =
    applyDeaths(working, initialDeaths, dayCount);
  working = updatedPlayers;

  // 10. Seer's private result (computed regardless of who died tonight).
  let seerResult: NightResolutionResult['seerResult'] = null;
  if (draft.seerTargetId) {
    const target = working.find((p) => p.id === draft.seerTargetId);
    if (target) {
      seerResult = { targetId: target.id, isWerewolf: target.role === RoleName.WEREWOLF };
    }
  }

  // 11. Fox's scout — checks target + both neighbors for any wolf-team
  // member (dead or alive doesn't matter, seating is fixed). Whiffing
  // (0 wolves found) permanently disables the ability.
  let foxResult: NightResolutionResult['foxResult'] = null;
  if (draft.foxTargetId) {
    const fox = working.find((p) => p.role === RoleName.FOX);
    const target = byId.get(draft.foxTargetId);
    if (fox && fox.foxState && !fox.foxState.hasLostAbility && target) {
      const neighbors = getCircularNeighbors(working, target.id) ?? [];
      const trio = [target, ...neighbors];
      const hasWolf = trio.some((p) => isWolfTeam(p.role));
      foxResult = { targetId: target.id, hasWolf };
      if (!hasWolf) {
        fox.foxState = { hasLostAbility: true };
      }
    }
  }

  // 12. Bear Tamer's passive morning growl — purely informational, based
  // on final (post-death) seating.
  let bearGrowl = false;
  const bearTamer = working.find((p) => p.role === RoleName.BEAR_TAMER && p.isAlive);
  if (bearTamer) {
    const neighbors = getCircularNeighbors(working, bearTamer.id) ?? [];
    bearGrowl = neighbors.some((n) => n.isAlive && isWolfTeam(n.role));
  }

  // 13. Flutist's hypnosis — marks up to 2 players (dead or alive; a
  // hypnotized player who later dies still "counts" as hypnotized, it
  // just no longer matters since only the living are checked for the win).
  for (const targetId of draft.flutistTargetIds.slice(0, 2)) {
    const target = byId.get(targetId);
    if (target) target.isHypnotized = true;
  }

  // 14. Cult Leader's recruitment — one new member per night.
  let cultNewMemberId: string | null = null;
  if (draft.cultLeaderTargetId) {
    const recruit = byId.get(draft.cultLeaderTargetId);
    if (recruit && !recruit.isCultMember) {
      recruit.isCultMember = true;
      cultNewMemberId = recruit.id;
    }
  }

  return {
    updatedPlayers: working,
    killedPlayerIds: deathDetails.map((d) => d.playerId),
    deathDetails,
    seerResult,
    hunterPendingShotIds,
    convertedPlayerId,
    littleGirlResult,
    foxResult,
    bearGrowl,
    villagerSkillsShouldBeDisabled,
    wildChildTurnedIds,
    cultNewMemberId,
  };
}
