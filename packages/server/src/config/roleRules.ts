import { RoleName } from '@werewolf/shared';

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 20;

/**
 * Roles that can only ever have at most 1 instance in a game.
 * (Werewolf is intentionally excluded — you can have multiple.)
 */
export const SINGLE_INSTANCE_ROLES: RoleName[] = [
  RoleName.SEER,
  RoleName.GUARD,
  RoleName.WITCH,
  RoleName.HUNTER,
  RoleName.CUPID,
  RoleName.WOLF_CUB,
  RoleName.FATHER_WOLF,
  RoleName.ALPHA_WOLF,
  RoleName.WHITE_WOLF,
  RoleName.LITTLE_GIRL,
  RoleName.FOX,
  RoleName.BEAR_TAMER,
  RoleName.ELDER,
  RoleName.RUSTY_KNIGHT,
  RoleName.SCAPEGOAT,
  RoleName.IDIOT,
  RoleName.CORRUPT_JUDGE,
  RoleName.WILD_CHILD,
  RoleName.ANGEL,
  RoleName.FLUTIST,
  RoleName.CULT_LEADER,
  RoleName.THIEF,
  RoleName.MAID,
];

/** Roles that must be assigned to EXACTLY this many players, or not used at all. */
const EXACT_COUNT_ROLES: Partial<Record<RoleName, number>> = {
  [RoleName.TWIN_SISTERS]: 2,
  [RoleName.THREE_BROTHERS]: 3,
};

/** All roles that belong to the werewolf team, for the pack-size safety check. */
const WOLF_TEAM_ROLES: RoleName[] = [
  RoleName.WEREWOLF,
  RoleName.WOLF_CUB,
  RoleName.FATHER_WOLF,
  RoleName.ALPHA_WOLF,
  RoleName.WHITE_WOLF,
];

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a role distribution against a given player count.
 * Rules enforced:
 *  - total players within [MIN_PLAYERS, MAX_PLAYERS]
 *  - sum of assigned roles <= total players (rest become VILLAGER)
 *  - single-instance roles never exceed count of 1
 *  - at least 1 werewolf required
 *  - werewolves must be strictly less than half the players (else werewolf
 *    team would start the game already at/above win threshold)
 */
export function validateRoomConfig(
  roleCounts: Partial<Record<RoleName, number>>,
  totalPlayers: number,
): ConfigValidationResult {
  const errors: string[] = [];

  if (totalPlayers < MIN_PLAYERS) {
    errors.push(`Cần tối thiểu ${MIN_PLAYERS} người chơi.`);
  }
  if (totalPlayers > MAX_PLAYERS) {
    errors.push(`Tối đa ${MAX_PLAYERS} người chơi.`);
  }

  const werewolfCount = roleCounts[RoleName.WEREWOLF] ?? 0;
  if (werewolfCount < 1) {
    errors.push('Cần ít nhất 1 Ma Sói.');
  }
  const wolfPackCount = WOLF_TEAM_ROLES.reduce((sum, role) => sum + (roleCounts[role] ?? 0), 0);
  if (wolfPackCount * 2 >= totalPlayers) {
    errors.push('Số lượng phe Sói phải nhỏ hơn một nửa tổng số người chơi.');
  }

  for (const role of SINGLE_INSTANCE_ROLES) {
    const count = roleCounts[role] ?? 0;
    if (count > 1) {
      errors.push(`Vai trò ${role} chỉ được có tối đa 1 người.`);
    }
  }

  for (const [role, exactCount] of Object.entries(EXACT_COUNT_ROLES) as Array<
    [RoleName, number]
  >) {
    const count = roleCounts[role] ?? 0;
    if (count > 0 && count !== exactCount) {
      errors.push(`Vai trò ${role} phải có đúng ${exactCount} người hoặc không chọn.`);
    }
  }

  const totalAssigned = Object.values(roleCounts).reduce<number>(
    (sum, n) => sum + (n ?? 0),
    0,
  );
  if (totalAssigned > totalPlayers) {
    errors.push('Tổng số vai trò được cấu hình vượt quá số người chơi.');
  }

  return { isValid: errors.length === 0, errors };
}
