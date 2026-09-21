/**
 * Thrown whenever a requested action violates a game rule (wrong phase,
 * not your turn, invalid target, etc). Socket handlers catch this
 * specifically and forward `message` to the client as a room:error event,
 * as opposed to unexpected exceptions which should be logged as bugs.
 */
export class GameLogicError extends Error {
  constructor(message: string, public code: string = 'GAME_LOGIC_ERROR') {
    super(message);
    this.name = 'GameLogicError';
  }
}
