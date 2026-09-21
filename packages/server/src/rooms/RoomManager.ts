import { MAX_PLAYERS } from '../config/roleRules';
import { GameLogicError } from '../game/GameLogicError';
import { Room } from './Room';

export class RoomNotFoundError extends GameLogicError {
  constructor(roomId: string) {
    super(`Không tìm thấy phòng "${roomId}".`, 'ROOM_NOT_FOUND');
  }
}

export class RoomFullError extends GameLogicError {
  constructor() {
    super(`Phòng đã đầy (tối đa ${MAX_PLAYERS} người chơi).`, 'ROOM_FULL');
  }
}

/**
 * RoomManager — single source of truth for "which rooms currently exist".
 * Uses a plain in-memory Map. For a single-process deployment this is
 * sufficient; if this ever needs to scale across multiple server
 * instances, this class is the one place to swap in Redis without
 * touching any other module (Room/FSM/socket handlers stay unchanged).
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostNickname: string, hostAvatarUrl: string | null = null): Room {
    const room = Room.create(hostNickname, hostAvatarUrl);
    this.rooms.set(room.roomId, room);
    return room;
  }

  getRoom(roomId: string): Room {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      throw new RoomNotFoundError(roomId);
    }
    return room;
  }

  tryGetRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  joinRoom(roomId: string, nickname: string, avatarUrl: string | null = null) {
    const room = this.getRoom(roomId);
    if (room.getState().players.length >= MAX_PLAYERS) {
      throw new RoomFullError();
    }
    const player = room.addPlayer(nickname, avatarUrl);
    return { room, player };
  }

  /**
   * Removes a room if it has no connected players left. Called after
   * disconnects, on a short delay, to allow for reconnects without
   * immediately tearing down an in-progress game.
   */
  cleanupIfEmpty(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room && room.isEmpty()) {
      this.rooms.delete(roomId);
    }
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  get activeRoomCount(): number {
    return this.rooms.size;
  }
}
