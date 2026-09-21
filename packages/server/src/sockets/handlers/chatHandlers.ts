import { Server, Socket } from 'socket.io';
import { ChatSendPayload, ClientEvents, ServerEvents } from '@werewolf/shared';
import { RoomManager } from '../../rooms/RoomManager';
import { GameLogicError } from '../../game/GameLogicError';
import { GameSessionRegistry } from '../GameSessionRegistry';
import { SocketAuthRegistry } from '../SocketAuth';
import { sendError } from '../broadcast';

const MAX_MESSAGE_LENGTH = 500;

export function registerChatHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  sessionRegistry: GameSessionRegistry,
  auth: SocketAuthRegistry,
): void {
  socket.on(ClientEvents.CHAT_SEND, (payload: ChatSendPayload) => {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return;
    }
    const room = roomManager.tryGetRoom(authData.roomId);
    const player = room?.getPlayer(authData.playerId);
    if (!room || !player) return;

    const text = payload.text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    const session = sessionRegistry.get(authData.roomId);
    if (session) {
      // In-game chat: routed through GameSession so it's just another
      // broadcastEvent alongside DAY_REVEAL/VOTE_RESULT/etc.
      session.handleChatMessage(player.id, player.nickname, text);
    } else {
      // Lobby chat before the game starts — no GameSession exists yet,
      // so emit directly to the room.
      io.to(authData.roomId).emit(ServerEvents.CHAT_MESSAGE, {
        playerId: player.id,
        nickname: player.nickname,
        text,
        timestamp: Date.now(),
      });
    }
  });
}
