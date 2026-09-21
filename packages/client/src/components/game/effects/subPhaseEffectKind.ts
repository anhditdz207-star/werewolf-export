import { NightSubPhase } from '@werewolf/shared';
import { RoleActionKind } from './RoleActionEffect';

/**
 * Which night sub-phases get a RoleActionEffect, and which kind. Single
 * source of truth used both by NightActionPanel (to show the effect to
 * the actor / a non-submitting teammate) and by RoomPage's dead-spectator
 * view (see SpectatorNightEffect) — so the two never drift apart.
 *
 * Deliberately excludes sub-phases with no clear lightweight visual:
 * FATHER_WOLF_DECISION and LITTLE_GIRL_PEEK are yes/no choices with no
 * target to point an effect at.
 */
export const SUBPHASE_EFFECT_KIND: Partial<Record<string, RoleActionKind>> = {
  [NightSubPhase.WEREWOLF]: 'werewolf',
  [NightSubPhase.WEREWOLF_BONUS]: 'werewolf',
  [NightSubPhase.GUARD]: 'guard',
  [NightSubPhase.SEER]: 'seer',
  [NightSubPhase.WHITE_WOLF]: 'white-wolf',
  [NightSubPhase.FOX]: 'fox',
  [NightSubPhase.CULT_LEADER]: 'cult-leader',
  [NightSubPhase.WILD_CHILD_IDOL]: 'wild-child',
  [NightSubPhase.WITCH]: 'witch-poison',
  [NightSubPhase.CUPID]: 'cupid',
  [NightSubPhase.FLUTIST]: 'flutist',
};
