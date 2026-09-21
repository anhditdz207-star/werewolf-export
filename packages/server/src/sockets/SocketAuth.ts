export interface SocketAuthData {
  playerId: string;
  roomId: string;
}

/**
 * In-memory map of socket.id -> {roomId, playerId}. Lets every handler
 * find "who is this and which room are they in" without the client
 * having to resend both ids on every single event.
 *
 * NOTE (future extension): reconnect-after-refresh currently requires a
 * brand-new join (new playerId). A production version would have the
 * client persist {roomId, playerId} (e.g. in localStorage) and expose a
 * ROOM_REJOIN event that re-associates an existing playerId with a new
 * socket.id via room.setSocketId(...) instead of creating a new player.
 * Room.setSocketId already supports this; only the client-facing
 * "rejoin" event is left as an exercise for Phase 2.
 */
export class SocketAuthRegistry {
  private bySocketId = new Map<string, SocketAuthData>();

  register(socketId: string, data: SocketAuthData): void {
    this.bySocketId.set(socketId, data);
  }

  get(socketId: string): SocketAuthData | undefined {
    return this.bySocketId.get(socketId);
  }

  remove(socketId: string): void {
    this.bySocketId.delete(socketId);
  }
}
