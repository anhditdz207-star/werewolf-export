export interface IdentifiedPlayer {
  deviceId: string;
  nickname: string;
  avatarUrl: string | null;
  socketId: string;
}

const MAX_CHAT_HISTORY = 50;

function formatId(seq: number): string {
  return String(seq).padStart(10, '0');
}

/** Deterministic, restart-safe 10-digit ID derived from a device's UUID —
 * same input always produces the same output, so it doesn't depend on the
 * server remembering anything (unlike an in-memory counter, which used to
 * reset to 1 every time the free-tier server restarted, handing out
 * colliding IDs to different accounts). FNV-1a hash, kept in the
 * [1, 9999999999] range; seq 0 stays reserved for "Admin". */
function deviceIdToDisplayId(deviceId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < deviceId.length; i++) {
    hash ^= deviceId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const positive = (hash >>> 0) % 9999999999;
  return formatId(positive + 1);
}

/**
 * All social state (identify, friends, lobby chat) lives in memory for the
 * lifetime of the server process — same tradeoff as RoomManager. Friend
 * relationships and chat history are lost on restart; there is no database
 * in this project.
 *
 * Each browser (deviceId, a UUID persisted in localStorage) gets a
 * human-friendly sequential 10-digit ID the first time it identifies
 * (0000000001, 0000000002, ...). That ID — not the raw UUID — is what
 * players share with each other to add friends. Seq 0 (0000000000) is
 * reserved for the built-in "Admin" contact and is never handed out.
 */
export class SocialManager {
  private players = new Map<string, IdentifiedPlayer>(); // deviceId -> player
  private socketToDevice = new Map<string, string>(); // socketId -> deviceId
  private friends = new Map<string, Set<string>>(); // deviceId -> set of friend deviceIds
  private pendingRequests = new Map<string, Set<string>>(); // deviceId -> set of deviceIds who requested them
  private chatHistory: Array<{ deviceId: string; nickname: string; avatarUrl: string | null; text: string; timestamp: number }> = [];
  private dmHistory = new Map<string, Array<{ fromDeviceId: string; fromNickname: string; fromAvatarUrl: string | null; toDeviceId: string; text: string; timestamp: number }>>();
  private deviceBySeq = new Map<string, string>(); // displayId -> deviceId (for friend-add lookup)

  identify(socketId: string, deviceId: string, nickname: string, avatarUrl: string | null): string {
    this.players.set(deviceId, { deviceId, nickname, avatarUrl, socketId });
    this.socketToDevice.set(socketId, deviceId);

    const displayId = deviceIdToDisplayId(deviceId);
    this.deviceBySeq.set(displayId, deviceId);
    return displayId;
  }

  getDisplayId(deviceId: string): string | undefined {
    return deviceIdToDisplayId(deviceId);
  }

  disconnect(socketId: string): void {
    const deviceId = this.socketToDevice.get(socketId);
    if (!deviceId) return;
    this.socketToDevice.delete(socketId);
    const player = this.players.get(deviceId);
    // Only clear the socket link if this was their current socket (avoids a
    // stale disconnect event clobbering a fresher reconnect).
    if (player && player.socketId === socketId) {
      player.socketId = '';
    }
  }

  getByDeviceId(deviceId: string): IdentifiedPlayer | undefined {
    return this.players.get(deviceId);
  }

  sendFriendRequest(deviceId: string, friendIdInput: string): FriendAddResult {
    const digits = friendIdInput.replace(/\D/g, '');
    if (!digits) return { ok: false, message: 'ID không hợp lệ.' };
    const displayId = digits.padStart(10, '0');

    const targetId = this.deviceBySeq.get(displayId);
    if (!targetId) return { ok: false, message: 'Không tìm thấy người chơi với ID này.' };
    if (targetId === deviceId) return { ok: false, message: 'Không thể tự kết bạn với chính mình.' };
    if (!this.players.has(targetId)) return { ok: false, message: 'Không tìm thấy người chơi với ID này.' };
    if (this.friends.get(deviceId)?.has(targetId)) return { ok: false, message: 'Hai bạn đã là bạn bè.' };

    if (!this.pendingRequests.has(targetId)) this.pendingRequests.set(targetId, new Set());
    this.pendingRequests.get(targetId)!.add(deviceId);
    return { ok: true, friendDeviceId: targetId };
  }

  acceptFriendRequest(deviceId: string, fromDeviceId: string): void {
    this.pendingRequests.get(deviceId)?.delete(fromDeviceId);
    if (!this.friends.has(deviceId)) this.friends.set(deviceId, new Set());
    if (!this.friends.has(fromDeviceId)) this.friends.set(fromDeviceId, new Set());
    this.friends.get(deviceId)!.add(fromDeviceId);
    this.friends.get(fromDeviceId)!.add(deviceId);
  }

  declineFriendRequest(deviceId: string, fromDeviceId: string): void {
    this.pendingRequests.get(deviceId)?.delete(fromDeviceId);
  }

  listPendingRequests(deviceId: string): IdentifiedPlayer[] {
    const ids = this.pendingRequests.get(deviceId);
    if (!ids) return [];
    return [...ids].map((id) => this.players.get(id)).filter((p): p is IdentifiedPlayer => !!p);
  }

  removeFriend(deviceId: string, friendDeviceId: string): void {
    this.friends.get(deviceId)?.delete(friendDeviceId);
    this.friends.get(friendDeviceId)?.delete(deviceId);
  }

  listFriends(deviceId: string): IdentifiedPlayer[] {
    const ids = this.friends.get(deviceId);
    if (!ids) return [];
    return [...ids].map((id) => this.players.get(id)).filter((p): p is IdentifiedPlayer => !!p);
  }

  isOnline(player: IdentifiedPlayer): boolean {
    return player.socketId !== '';
  }

  pushChatMessage(msg: { deviceId: string; nickname: string; avatarUrl: string | null; text: string; timestamp: number }): void {
    this.chatHistory.push(msg);
    if (this.chatHistory.length > MAX_CHAT_HISTORY) this.chatHistory.shift();
  }

  getChatHistory() {
    return this.chatHistory;
  }

  private dmKey(a: string, b: string): string {
    return [a, b].sort().join('|');
  }

  pushDm(msg: { fromDeviceId: string; fromNickname: string; fromAvatarUrl: string | null; toDeviceId: string; text: string; timestamp: number }): void {
    const key = this.dmKey(msg.fromDeviceId, msg.toDeviceId);
    if (!this.dmHistory.has(key)) this.dmHistory.set(key, []);
    const list = this.dmHistory.get(key)!;
    list.push(msg);
    if (list.length > MAX_CHAT_HISTORY) list.shift();
  }

  getDmHistory(a: string, b: string) {
    return this.dmHistory.get(this.dmKey(a, b)) ?? [];
  }
}

type FriendAddResult = { ok: true; friendDeviceId: string } | { ok: false; message: string };
