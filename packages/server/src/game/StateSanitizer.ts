import { GamePhase, GameState, Player } from '@werewolf/shared';

/**
 * Produces a version of GameState safe to send to a specific player.
 *
 * Rules:
 *  - A player always sees their own full data (role, witchState, guardState).
 *  - Once GAME_OVER, everyone sees everyone's role (final reveal).
 *  - Assumption: a player's role becomes visible to everyone as soon as
 *    they die (common convention in Ma Sói — adds strategic value to
 *    discussion). Still-living players' roles stay hidden from others.
 *  - A dead VIEWER becomes a spectator/"ghost" and sees every role,
 *    living or dead — the standard Werewolf/Mafia convention that once
 *    you're out, you get the full picture while still-alive players see
 *    only what they're supposed to. This reuses the same `revealAll`
 *    flag as the GAME_OVER case rather than adding a parallel system.
 *  - `socketId` is never sent to anyone but is not sensitive to the
 *    player themselves either — stripped for all viewers since clients
 *    never need it.
 *
 * IMPORTANT: this must be called separately per-recipient (using
 * `socket.emit`, never `io.to(room).emit`) — a single shared payload
 * would either leak everyone's role or hide the viewer's own role.
 */
export function sanitizeStateForPlayer(state: GameState, viewerPlayerId: string): GameState {
  const viewer = state.players.find((p) => p.id === viewerPlayerId);
  const viewerIsDeadSpectator = viewer !== undefined && !viewer.isAlive;
  const revealAll = state.phase === GamePhase.GAME_OVER || viewerIsDeadSpectator;
  return {
    ...state,
    players: state.players.map((p) => sanitizePlayer(p, viewerPlayerId, revealAll)),
  };
}

function sanitizePlayer(player: Player, viewerId: string, revealAll: boolean): Player {
  const isSelf = player.id === viewerId;
  const shouldRevealRole = revealAll || isSelf || !player.isAlive;

  return {
    ...player,
    role: shouldRevealRole ? player.role : null,
    witchState: isSelf ? player.witchState : null,
    guardState: isSelf ? player.guardState : null,
    socketId: null,
  };
}
