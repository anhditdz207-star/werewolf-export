import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents, VoiceSignalSendPayload } from '@werewolf/shared';
import { RoomManager } from '../../rooms/RoomManager';
import { SocketAuthRegistry } from '../SocketAuth';

/**
 * Pure 1:1 relay for the mesh voice-chat WebRTC signaling (offer/answer/
 * ICE candidates). The server never inspects or stores the SDP — it just
 * looks up the target player's current socket and forwards the envelope
 * with `fromPlayerId` attached so the recipient knows which peer
 * connection to route it to. Actual audio flows peer-to-peer afterward.
 */
export function registerVoiceHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  auth: SocketAuthRegistry,
): void {
  function relay(eventName: string) {
    return (payload: VoiceSignalSendPayload) => {
      const authData = auth.get(socket.id);
      if (!authData) return;
      const room = roomManager.tryGetRoom(authData.roomId);
      const targetPlayer = room?.getPlayer(payload.targetPlayerId);
      if (!targetPlayer?.socketId) return;
      io.to(targetPlayer.socketId).emit(eventName, {
        fromPlayerId: authData.playerId,
        data: payload.data,
      });
    };
  }

  socket.on(ClientEvents.VOICE_OFFER, relay(ServerEvents.VOICE_OFFER));
  socket.on(ClientEvents.VOICE_ANSWER, relay(ServerEvents.VOICE_ANSWER));
  socket.on(ClientEvents.VOICE_ICE_CANDIDATE, relay(ServerEvents.VOICE_ICE_CANDIDATE));

  socket.on('disconnect', () => {
    const authData = auth.get(socket.id);
    if (!authData) return;
    socket.to(authData.roomId).emit(ServerEvents.VOICE_PEER_LEFT, { playerId: authData.playerId });
  });
}
