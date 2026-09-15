import { Server, Socket } from 'socket.io';
import {
  ClientEvents,
  PlayerUpdateAvatarPayload,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomRejoinAck,
  RoomRejoinPayload,
  RoomUpdateConfigPayload,
  ThiefChoosePayload,
} from '@werewolf/shared';
import { RoomManager } from '../../rooms/RoomManager';
import { GameSession } from '../../game/GameSession';
import { GameLogicError } from '../../game/GameLogicError';
import { GameSessionRegistry } from '../GameSessionRegistry';
import { SocketAuthRegistry } from '../SocketAuth';
import { attachSessionBroadcastListeners, broadcastRoomState, sendError } from '../broadcast';

export function registerLobbyHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  sessionRegistry: GameSessionRegistry,
  auth: SocketAuthRegistry,
): void {
  socket.on(
    ClientEvents.ROOM_CREATE,
    (payload: RoomCreatePayload, ack?: (res: { roomId: string; playerId: string }) => void) => {
      try {
        const room = roomManager.createRoom(payload.nickname, payload.avatarUrl ?? null);
        const hostId = room.getState().hostPlayerId;
        room.setSocketId(hostId, socket.id);
        auth.register(socket.id, { roomId: room.roomId, playerId: hostId });
        socket.join(room.roomId);
        broadcastRoomState(io, room);
        ack?.({ roomId: room.roomId, playerId: hostId });
      } catch (err) {
        sendError(socket, err);
      }
    },
  );

  socket.on(
    ClientEvents.ROOM_JOIN,
    (payload: RoomJoinPayload, ack?: (res: { roomId: string; playerId: string }) => void) => {
      try {
        const { room, player } = roomManager.joinRoom(payload.roomId, payload.nickname, payload.avatarUrl ?? null);
        room.setSocketId(player.id, socket.id);
        auth.register(socket.id, { roomId: room.roomId, playerId: player.id });
        socket.join(room.roomId);
        broadcastRoomState(io, room);
        ack?.({ roomId: room.roomId, playerId: player.id });
      } catch (err) {
        sendError(socket, err);
      }
    },
  );

  socket.on(
    ClientEvents.ROOM_REJOIN,
    (payload: RoomRejoinPayload, ack?: (res: RoomRejoinAck) => void) => {
      // Deliberately silent on failure (stale/expired session, room already
      // gone, etc.) — the client just falls back to the normal lobby flow,
      // so there's nothing actionable to show the user as an error.
      const room = roomManager.tryGetRoom(payload.roomId);
      const player = room?.getPlayer(payload.playerId);
      if (!room || !player) {
        ack?.({ ok: false });
        return;
      }
      room.setSocketId(player.id, socket.id);
      auth.register(socket.id, { roomId: room.roomId, playerId: player.id });
      socket.join(room.roomId);
      broadcastRoomState(io, room);
      ack?.({ ok: true, roomId: room.roomId, playerId: player.id });
    },
  );

  socket.on(ClientEvents.ROOM_UPDATE_CONFIG, (payload: RoomUpdateConfigPayload) => {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return;
    }
    try {
      const room = roomManager.getRoom(authData.roomId);
      if (room.getState().hostPlayerId !== authData.playerId) {
        throw new GameLogicError('Chỉ chủ phòng được thay đổi cấu hình.', 'NOT_HOST');
      }
      room.updateConfig(payload.config);
      broadcastRoomState(io, room);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.ROOM_START, () => {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return;
    }
    try {
      const room = roomManager.getRoom(authData.roomId);
      const session = new GameSession(room);
      attachSessionBroadcastListeners(io, room, session);
      sessionRegistry.create(room.roomId, session);
      // Validates host + config internally; throws GameLogicError if invalid.
      session.handleStartGame(authData.playerId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.THIEF_CHOOSE, (payload: ThiefChoosePayload) => {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return;
    }
    const session = sessionRegistry.get(authData.roomId);
    if (!session) {
      sendError(socket, new GameLogicError('Ván đấu chưa bắt đầu.', 'NO_ACTIVE_GAME'));
      return;
    }
    try {
      session.handleThiefChoice(authData.playerId, payload.chosenRole);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.PLAYER_UPDATE_AVATAR, (payload: PlayerUpdateAvatarPayload) => {
    const authData = auth.get(socket.id);
    if (!authData) return;
    const room = roomManager.tryGetRoom(authData.roomId);
    if (!room) return;
    room.setAvatar(authData.playerId, payload.avatarUrl);
    broadcastRoomState(io, room);
  });

  socket.on(ClientEvents.ROOM_LEAVE, () => {
    leaveCurrentRoom();
  });

  socket.on('disconnect', () => {
    const authData = auth.get(socket.id);
    if (!authData) return;
    const room = roomManager.tryGetRoom(authData.roomId);
    if (room) {
      // Mark disconnected but keep the player in the game — a lot of
      // Ma Sói rounds happen on flaky mobile connections, so we don't
      // want a brief drop to eject someone from an in-progress game.
      room.setSocketId(authData.playerId, null);
      broadcastRoomState(io, room);
    }
    auth.remove(socket.id);
  });

  function leaveCurrentRoom(): void {
    const authData = auth.get(socket.id);
    if (!authData) return;
    const room = roomManager.tryGetRoom(authData.roomId);
    if (room) {
      room.removePlayer(authData.playerId);
      socket.leave(authData.roomId);
      broadcastRoomState(io, room);
      roomManager.cleanupIfEmpty(authData.roomId);
      if (room.isEmpty()) {
        sessionRegistry.remove(authData.roomId);
      }
    }
    auth.remove(socket.id);
  }
}
