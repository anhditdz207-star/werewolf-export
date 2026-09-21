import { Server, Socket } from 'socket.io';
import {
  ClientEvents,
  ServerEvents,
  IdentifyPayload,
  LobbyChatSendPayload,
  DmSendPayload,
  DmHistoryRequestPayload,
  FriendAddPayload,
  FriendRemovePayload,
  FriendRespondPayload,
  LobbyChatMessagePayload,
  FriendEntry,
} from '@werewolf/shared';
import { SocialManager } from '../../social/SocialManager';

const MAX_MESSAGE_LENGTH = 300;

export function registerSocialHandlers(io: Server, socket: Socket, social: SocialManager): void {
  socket.on(ClientEvents.IDENTIFY, (payload: IdentifyPayload) => {
    if (!payload.deviceId || !payload.nickname) return;
    (socket.data as { deviceId?: string }).deviceId = payload.deviceId;
    social.identify(socket.id, payload.deviceId, payload.nickname, payload.avatarUrl ?? null);

    socket.emit(ServerEvents.LOBBY_CHAT_HISTORY, social.getChatHistory());
    sendFriendList(payload.deviceId);
  });

  socket.on(ClientEvents.LOBBY_CHAT_SEND, (payload: LobbyChatSendPayload) => {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    const player = social.getByDeviceId(deviceId);
    if (!player) return;

    const text = (payload.text ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    const message: LobbyChatMessagePayload = {
      deviceId,
      nickname: player.nickname,
      avatarUrl: player.avatarUrl,
      text,
      timestamp: Date.now(),
    };
    social.pushChatMessage(message);
    io.emit(ServerEvents.LOBBY_CHAT_MESSAGE, message);
  });

  socket.on(ClientEvents.DM_SEND, (payload: DmSendPayload) => {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    const text = (payload.text ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text || !payload.toDeviceId) return;
    const sender = social.getByDeviceId(deviceId);
    if (!sender) return;

    const message = {
      fromDeviceId: deviceId,
      fromNickname: sender.nickname,
      fromAvatarUrl: sender.avatarUrl,
      toDeviceId: payload.toDeviceId,
      text,
      timestamp: Date.now(),
    };
    social.pushDm(message);

    socket.emit(ServerEvents.DM_MESSAGE, message);
    const recipient = social.getByDeviceId(payload.toDeviceId);
    if (recipient && social.isOnline(recipient)) {
      io.sockets.sockets.get(recipient.socketId)?.emit(ServerEvents.DM_MESSAGE, message);
    }
  });

  socket.on(ClientEvents.DM_HISTORY_REQUEST, (payload: DmHistoryRequestPayload) => {
    const deviceId = requireDeviceId();
    if (!deviceId || !payload.withDeviceId) return;
    socket.emit(ServerEvents.DM_HISTORY, {
      withDeviceId: payload.withDeviceId,
      messages: social.getDmHistory(deviceId, payload.withDeviceId),
    });
  });

  socket.on(ClientEvents.FRIEND_ADD, (payload: FriendAddPayload) => {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    const result = social.sendFriendRequest(deviceId, (payload.friendCode ?? '').trim());
    if (!result.ok) {
      socket.emit(ServerEvents.SOCIAL_ERROR, { message: result.message });
      return;
    }
    // Notify the target immediately (so their red dot shows up right away).
    const target = social.getByDeviceId(result.friendDeviceId);
    if (target && social.isOnline(target)) sendFriendList(target.deviceId);
  });

  socket.on(ClientEvents.FRIEND_ACCEPT, (payload: FriendRespondPayload) => {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    social.acceptFriendRequest(deviceId, payload.deviceId);
    sendFriendList(deviceId);
    const other = social.getByDeviceId(payload.deviceId);
    if (other && social.isOnline(other)) sendFriendList(other.deviceId);
  });

  socket.on(ClientEvents.FRIEND_DECLINE, (payload: FriendRespondPayload) => {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    social.declineFriendRequest(deviceId, payload.deviceId);
    sendFriendList(deviceId);
  });

  socket.on(ClientEvents.FRIEND_REMOVE, (payload: FriendRemovePayload) => {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    social.removeFriend(deviceId, payload.deviceId);
    sendFriendList(deviceId);
  });

  socket.on(ClientEvents.FRIEND_LIST_REQUEST, () => {
    const deviceId = requireDeviceId();
    if (deviceId) sendFriendList(deviceId);
  });

  socket.on('disconnect', () => {
    social.disconnect(socket.id);
  });

  function requireDeviceId(): string | null {
    // We look the device up by scanning is avoided by storing it on the
    // socket object itself the first time IDENTIFY fires.
    return (socket.data as { deviceId?: string }).deviceId ?? null;
  }

  function toEntry(p: { deviceId: string; nickname: string; avatarUrl: string | null }): FriendEntry {
    const player = social.getByDeviceId(p.deviceId);
    return { deviceId: p.deviceId, nickname: p.nickname, avatarUrl: p.avatarUrl, online: !!player && social.isOnline(player) };
  }

  function sendFriendList(deviceId: string): void {
    const player = social.getByDeviceId(deviceId);
    if (!player) return;
    const targetSocket = io.sockets.sockets.get(player.socketId);
    targetSocket?.emit(ServerEvents.FRIEND_LIST, {
      friends: social.listFriends(deviceId).map(toEntry),
      pendingRequests: social.listPendingRequests(deviceId).map(toEntry),
      myFriendCode: social.getDisplayId(deviceId) ?? '',
    });
  }
}
