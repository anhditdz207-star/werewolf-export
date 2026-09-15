import { DeathCause, Player, RoleName } from '@werewolf/shared';
import { isWolfTeam } from './NightResolver';

export type WinResult =
  | 'VILLAGER'
  | 'WEREWOLF'
  | 'WHITE_WOLF'
  | 'ANGEL'
  | 'FLUTIST'
  | 'CULT_LEADER'
  | null;

/**
 * Angel wins alone, instantly, if voted out on Day 1 before anyone else
 * in the game has died. Since night always resolves before the day-1
 * vote, "no one died before them" reduces to: no OTHER player also has
 * diedOnDay === 1 (any such death would have to be from that same
 * night, i.e. strictly earlier). Fully derivable from player state —
 * no extra flags needed, and it naturally stops being true once day 1
 * has passed (diedOnDay would no longer be 1).
 */
function checkAngelWin(players: Player[]): boolean {
  const angel = players.find((p) => p.role === RoleName.ANGEL);
  if (!angel || angel.deathCause !== DeathCause.VOTED_OUT || angel.diedOnDay !== 1) {
    return false;
  }
  return !players.some((p) => p.id !== angel.id && p.diedOnDay === 1);
}

/** Flutist wins the instant every living player (including themself) is hypnotized. */
function checkFlutistWin(players: Player[]): boolean {
  const hasFlutist = players.some((p) => p.role === RoleName.FLUTIST);
  if (!hasFlutist) return false;
  const alive = players.filter((p) => p.isAlive);
  return alive.length > 0 && alive.every((p) => p.isHypnotized);
}

/** The Cult wins the instant every living player (including the leader) has been recruited. */
function checkCultLeaderWin(players: Player[]): boolean {
  const hasLeader = players.some((p) => p.role === RoleName.CULT_LEADER);
  if (!hasLeader) return false;
  const alive = players.filter((p) => p.isAlive);
  return alive.length > 0 && alive.every((p) => p.isCultMember);
}

/**
 * Win conditions, checked in priority order:
 *  1. Angel / Flutist / Cult Leader — each role's own special win,
 *     independent of team. These pre-empt everything else.
 *  2. WHITE_WOLF — wins the instant they are the only player left alive.
 *  3. VILLAGER — zero wolf-team players remain alive.
 *  4. WEREWOLF — alive wolf-team players >= alive non-wolf players.
 *  5. null — game continues.
 *
 * Call this after every death-causing event: night resolution, vote
 * elimination, AND hunter shots — any of these can end the game.
 */
export function checkWinCondition(players: Player[]): WinResult {
  if (checkAngelWin(players)) return 'ANGEL';
  if (checkFlutistWin(players)) return 'FLUTIST';
  if (checkCultLeaderWin(players)) return 'CULT_LEADER';

  const alive = players.filter((p) => p.isAlive);

  if (alive.length === 1 && alive[0].role === RoleName.WHITE_WOLF) {
    return 'WHITE_WOLF';
  }

  const aliveWolfTeam = alive.filter((p) => isWolfTeam(p.role)).length;
  const aliveOthers = alive.length - aliveWolfTeam;

  if (aliveWolfTeam === 0) return 'VILLAGER';
  if (aliveWolfTeam >= aliveOthers) return 'WEREWOLF';
  return null;
}
