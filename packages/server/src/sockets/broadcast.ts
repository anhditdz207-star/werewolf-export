import { Server, Socket } from 'socket.io';
import { RoomErrorPayload, ServerEvents } from '@werewolf/shared';
import { Room } from '../rooms/Room';
import { GameSession } from '../game/GameSession';
import { GameLogicError } from '../game/GameLogicError';
import { sanitizeStateForPlayer } from '../game/StateSanitizer';

/**
 * Sends each connected player their OWN sanitized view of the room
 * state, via a direct-to-socket emit (never io.to(roomId).emit for this
 * — that would send everyone the same payload and either leak roles or
 * hide the viewer's own role; see StateSanitizer's docstring).
 */
export function broadcastRoomState(io: Server, room: Room): void {
  const state = room.getState();
  for (const player of state.players) {
    if (!player.socketId) continue; // disconnected right now, nothing to send
    const sanitized = sanitizeStateForPlayer(state, player.id);
    io.to(player.socketId).emit(ServerEvents.ROOM_STATE, sanitized);
  }
}

/**
 * Normalizes any thrown error into a RoomErrorPayload. GameLogicError
 * (and its subclasses, e.g. RoomNotFoundError) carry a safe, user-facing
 * message + code. Anything else is treated as an unexpected bug: logged
 * server-side, and the client gets a generic message instead of a raw
 * stack trace.
 */
export function sendError(socket: Socket, err: unknown): void {
  if (err instanceof GameLogicError) {
    const payload: RoomErrorPayload = { message: err.message, code: err.code };
    socket.emit(ServerEvents.ROOM_ERROR, payload);
    return;
  }
  // eslint-disable-next-line no-console
  console.error('Unexpected server error:', err);
  const payload: RoomErrorPayload = {
    message: 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.',
    code: 'UNKNOWN_ERROR',
  };
  socket.emit(ServerEvents.ROOM_ERROR, payload);
}

/**
 * Wires a GameSession's transport-agnostic events to actual Socket.IO
 * emissions. Call this exactly once, right after a GameSession is
 * created for a room (see lobbyHandlers.ts's ROOM_START handler).
 */
export function attachSessionBroadcastListeners(
  io: Server,
  room: Room,
  session: GameSession,
): void {
  session.on('stateChanged', () => broadcastRoomState(io, room));

  session.on('privateEvent', (playerId: string, event: string, payload: unknown) => {
    const player = room.getPlayer(playerId);
    if (player?.socketId) {
      io.to(player.socketId).emit(event, payload);
    }
  });

  session.on('broadcastEvent', (event: string, payload: unknown) => {
    io.to(room.roomId).emit(event, payload);
  });
}
