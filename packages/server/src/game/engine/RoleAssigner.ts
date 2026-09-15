import { Player, RoleName, RoomConfig } from '@werewolf/shared';

/** Fisher-Yates shuffle — does not mutate the input array. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Expands a roleCounts map (e.g. { WEREWOLF: 2, SEER: 1 }) into a flat
 * array of role assignments (e.g. [WEREWOLF, WEREWOLF, SEER]), padding
 * the remainder with VILLAGER up to `poolSize`.
 */
function buildRolePool(
  roleCounts: Partial<Record<RoleName, number>>,
  poolSize: number,
): RoleName[] {
  const pool: RoleName[] = [];
  for (const [role, count] of Object.entries(roleCounts) as [RoleName, number][]) {
    for (let i = 0; i < count; i++) {
      pool.push(role);
    }
  }
  while (pool.length < poolSize) {
    pool.push(RoleName.VILLAGER);
  }
  return pool;
}

/**
 * The role-specific state fields for a freshly-assigned role. Exported so
 * the Thief's card swap and the Maid's death-swap can re-initialize a
 * player's state after changing their `role` mid-game, without duplicating
 * this table in multiple places.
 */
export function createRoleState(
  role: RoleName,
): Pick<
  Player,
  | 'witchState'
  | 'guardState'
  | 'fatherWolfState'
  | 'whiteWolfState'
  | 'foxState'
  | 'elderState'
  | 'idiotState'
  | 'corruptJudgeState'
  | 'wildChildState'
  | 'isCultMember'
> {
  return {
    witchState: role === RoleName.WITCH ? { hasHealPotion: true, hasPoisonPotion: true } : null,
    guardState: role === RoleName.GUARD ? { lastProtectedPlayerId: null } : null,
    fatherWolfState: role === RoleName.FATHER_WOLF ? { hasUsedConversion: false } : null,
    whiteWolfState: role === RoleName.WHITE_WOLF ? { lastActionDayCount: null } : null,
    foxState: role === RoleName.FOX ? { hasLostAbility: false } : null,
    elderState: role === RoleName.ELDER ? { livesRemaining: 2 } : null,
    idiotState: role === RoleName.IDIOT ? { isRevealed: false } : null,
    corruptJudgeState: role === RoleName.CORRUPT_JUDGE ? { hasUsedRevote: false } : null,
    wildChildState: role === RoleName.WILD_CHILD ? { idolPlayerId: null } : null,
    isCultMember: role === RoleName.CULT_LEADER,
  };
}

export interface RoleAssignmentResult {
  players: Player[];
  /**
   * The 2 extra spare cards dealt for the Thief to choose from, drawn
   * from the same configured role pool (so they can occasionally be a
   * special role, not just Villager filler) — or null if no Thief is
   * in this game.
   */
  thiefSpareRoles: [RoleName, RoleName] | null;
}

/**
 * Assigns roles randomly to the given players. Returns NEW Player objects
 * (does not mutate input) with `role` and role-specific state initialized.
 *
 * Caller is responsible for validating the config beforehand
 * (see config/roleRules.ts) — this function assumes a valid distribution.
 */
export function assignRoles(players: Player[], config: RoomConfig): RoleAssignmentResult {
  const hasThief = (config.roleCounts[RoleName.THIEF] ?? 0) > 0;
  const poolSize = players.length + (hasThief ? 2 : 0);
  const fullPool = shuffle(buildRolePool(config.roleCounts, poolSize));

  const assignedRoles = fullPool.slice(0, players.length);
  const thiefSpareRoles = hasThief
    ? ([fullPool[players.length], fullPool[players.length + 1]] as [RoleName, RoleName])
    : null;

  const newPlayers = players.map((player, index) => {
    const role = assignedRoles[index];
    return {
      ...player,
      role,
      ...createRoleState(role),
      isHypnotized: false,
    };
  });

  return { players: newPlayers, thiefSpareRoles };
}
