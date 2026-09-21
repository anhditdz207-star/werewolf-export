import { NightSubPhase, Player, RoleName } from '@werewolf/shared';
import {
  fatherWolfDecisionAvailable,
  isWolfTeam,
  whiteWolfActionAvailable,
  wolfBonusBiteActive,
} from '../engine/NightResolver';

const FULL_SEQUENCE: NightSubPhase[] = [
  NightSubPhase.CUPID,
  NightSubPhase.WILD_CHILD_IDOL,
  NightSubPhase.WEREWOLF,
  NightSubPhase.WEREWOLF_BONUS,
  NightSubPhase.FATHER_WOLF_DECISION,
  NightSubPhase.WHITE_WOLF,
  NightSubPhase.LITTLE_GIRL_PEEK,
  NightSubPhase.FOX,
  NightSubPhase.FLUTIST,
  NightSubPhase.CULT_LEADER,
  NightSubPhase.GUARD,
  NightSubPhase.WITCH,
  NightSubPhase.SEER,
  NightSubPhase.RESOLVING,
];

const SUBPHASE_ROLE: Partial<Record<NightSubPhase, RoleName>> = {
  [NightSubPhase.CUPID]: RoleName.CUPID,
  [NightSubPhase.WILD_CHILD_IDOL]: RoleName.WILD_CHILD,
  [NightSubPhase.WEREWOLF]: RoleName.WEREWOLF,
  [NightSubPhase.FATHER_WOLF_DECISION]: RoleName.FATHER_WOLF,
  [NightSubPhase.WHITE_WOLF]: RoleName.WHITE_WOLF,
  [NightSubPhase.LITTLE_GIRL_PEEK]: RoleName.LITTLE_GIRL,
  [NightSubPhase.FOX]: RoleName.FOX,
  [NightSubPhase.FLUTIST]: RoleName.FLUTIST,
  [NightSubPhase.CULT_LEADER]: RoleName.CULT_LEADER,
  [NightSubPhase.GUARD]: RoleName.GUARD,
  [NightSubPhase.WITCH]: RoleName.WITCH,
  [NightSubPhase.SEER]: RoleName.SEER,
};

/**
 * Returns the ordered list of sub-phases that should actually happen
 * tonight — skipping roles with no living player, and skipping CUPID
 * entirely after the first night. RESOLVING is always included as the
 * terminal marker.
 */
export function getApplicableNightSubPhases(
  players: Player[],
  dayCount: number,
  villagerSkillsDisabled = false,
): NightSubPhase[] {
  const LOCKABLE_VILLAGER_SUBPHASES: NightSubPhase[] = [
    NightSubPhase.GUARD,
    NightSubPhase.WITCH,
    NightSubPhase.SEER,
    NightSubPhase.LITTLE_GIRL_PEEK,
    NightSubPhase.FOX,
    NightSubPhase.FLUTIST,
    NightSubPhase.CULT_LEADER,
  ];

  return FULL_SEQUENCE.filter((subPhase) => {
    if (subPhase === NightSubPhase.RESOLVING) return true;
    if (villagerSkillsDisabled && LOCKABLE_VILLAGER_SUBPHASES.includes(subPhase)) return false;
    if (subPhase === NightSubPhase.CUPID) {
      if (dayCount !== 1) return false;
      return players.some((p) => p.role === RoleName.CUPID && p.isAlive);
    }
    if (subPhase === NightSubPhase.WILD_CHILD_IDOL) {
      if (dayCount !== 1) return false;
      return players.some(
        (p) => p.role === RoleName.WILD_CHILD && p.isAlive && p.wildChildState?.idolPlayerId === null,
      );
    }
    if (subPhase === NightSubPhase.WEREWOLF_BONUS) {
      return (
        players.some((p) => isWolfTeam(p.role) && p.isAlive) &&
        wolfBonusBiteActive(players, dayCount)
      );
    }
    if (subPhase === NightSubPhase.FATHER_WOLF_DECISION) {
      return fatherWolfDecisionAvailable(players);
    }
    if (subPhase === NightSubPhase.WHITE_WOLF) {
      return whiteWolfActionAvailable(players, dayCount);
    }
    if (subPhase === NightSubPhase.LITTLE_GIRL_PEEK) {
      return players.some((p) => p.role === RoleName.LITTLE_GIRL && p.isAlive);
    }
    if (subPhase === NightSubPhase.FOX) {
      return players.some(
        (p) => p.role === RoleName.FOX && p.isAlive && p.foxState && !p.foxState.hasLostAbility,
      );
    }

    const role = SUBPHASE_ROLE[subPhase];
    if (!role) return false;

    if (role === RoleName.WITCH) {
      const witch = players.find((p) => p.role === RoleName.WITCH && p.isAlive);
      return !!witch && witch.witchState !== null &&
        (witch.witchState.hasHealPotion || witch.witchState.hasPoisonPotion);
    }

    return players.some((p) => p.role === role && p.isAlive);
  });
}

/** Returns the next sub-phase after `current` within the applicable list. */
export function getNextNightSubPhase(
  current: NightSubPhase,
  applicable: NightSubPhase[],
): NightSubPhase {
  const idx = applicable.indexOf(current);
  if (idx === -1 || idx === applicable.length - 1) {
    return NightSubPhase.RESOLVING;
  }
  return applicable[idx + 1];
}
