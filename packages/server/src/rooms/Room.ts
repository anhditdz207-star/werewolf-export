import {
  createEmptyPlayer,
  DEFAULT_ROOM_CONFIG,
  GamePhase,
  GameState,
  Player,
  RoomConfig,
} from '@werewolf/shared';
import { generatePlayerId, generateRoomCode } from '../utils/idGenerator';

/**
 * Room — owns one room's GameState and is the ONLY place allowed to mutate
 * it directly. Everything else (socket handlers, the FSM) reads state via
 * getters and requests changes via these methods, never touching
 * `this.state` from outside this class.
 *
 * This class deliberately knows nothing about Socket.IO — it's plain,
 * synchronous, and unit-testable in isolation.
 */
export class Room {
  private state: GameState;

  private constructor(roomId: string, hostPlayer: Player) {
    this.state = {
      roomId,
      hostPlayerId: hostPlayer.id,
      config: DEFAULT_ROOM_CONFIG,
      phase: GamePhase.WAITING,
      nightSubPhase: null,
      votingSubPhase: null,
      dayCount: 0,
      phaseEndsAt: null,
      players: [hostPlayer],
      pendingWolfTargetId: null,
      history: { nights: [], votes: [] },
      winningTeam: null,
      villagerActiveSkillsDisabled: false,
      thiefSpareRoles: null,
    };
  }

  static create(hostNickname: string, hostAvatarUrl: string | null = null): Room {
    const roomId = generateRoomCode();
    const hostPlayer = createEmptyPlayer(generatePlayerId(), hostNickname, true, hostAvatarUrl);
    return new Room(roomId, hostPlayer);
  }

  get roomId(): string {
    return this.state.roomId;
  }

  get phase(): GamePhase {
    return this.state.phase;
  }

  /** Read-only snapshot of the full state. Callers must not mutate this. */
  getState(): Readonly<GameState> {
    return this.state;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.state.players.find((p) => p.id === playerId);
  }

  getAlivePlayers(): Player[] {
    return this.state.players.filter((p) => p.isAlive);
  }

  addPlayer(nickname: string, avatarUrl: string | null = null): Player {
    if (this.state.phase !== GamePhase.WAITING) {
      throw new Error('Không thể tham gia phòng khi ván đấu đã bắt đầu.');
    }
    const player = createEmptyPlayer(generatePlayerId(), nickname, false, avatarUrl);
    this.state.players.push(player);
    return player;
  }

  setAvatar(playerId: string, avatarUrl: string | null): void {
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.avatarUrl = avatarUrl;
  }

  removePlayer(playerId: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    // Reassign host if the host left and players remain.
    if (this.state.hostPlayerId === playerId && this.state.players.length > 0) {
      const newHost = this.state.players[0];
      newHost.isHost = true;
      this.state.hostPlayerId = newHost.id;
    }
  }

  setSocketId(playerId: string, socketId: string | null): void {
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.socketId = socketId;
    player.isConnected = socketId !== null;
  }

  updateConfig(config: RoomConfig): void {
    if (this.state.phase !== GamePhase.WAITING) {
      throw new Error('Không thể thay đổi cấu hình sau khi ván đấu đã bắt đầu.');
    }
    this.state.config = config;
  }

  isEmpty(): boolean {
    return this.state.players.every((p) => !p.isConnected);
  }

  /**
   * Direct mutable access, intentionally restricted to the FSM layer.
   * The FSM is the only collaborator trusted to drive phase/player
   * transitions; everything else goes through the typed methods above.
   */
  _internalStateForFsm(): GameState {
    return this.state;
  }
}
