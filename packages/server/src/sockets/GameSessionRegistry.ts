import { GameSession } from '../game/GameSession';

export class GameSessionRegistry {
  private sessions = new Map<string, GameSession>();

  create(roomId: string, session: GameSession): void {
    this.sessions.set(roomId, session);
  }

  get(roomId: string): GameSession | undefined {
    return this.sessions.get(roomId);
  }

  remove(roomId: string): void {
    this.sessions.get(roomId)?.clearTimers();
    this.sessions.delete(roomId);
  }
}
