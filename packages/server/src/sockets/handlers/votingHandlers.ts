import { Server, Socket } from 'socket.io';
import {
  ChiefChooseSuccessorPayload,
  ClientEvents,
  HunterShootPayload,
  MaidNightSwapPayload,
  MaidSwapPayload,
  MayorVoteCastPayload,
  VoteCastPayload,
} from '@werewolf/shared';
import { RoomManager } from '../../rooms/RoomManager';
import { GameSession } from '../../game/GameSession';
import { GameLogicError } from '../../game/GameLogicError';
import { GameSessionRegistry } from '../GameSessionRegistry';
import { SocketAuthRegistry } from '../SocketAuth';
import { sendError } from '../broadcast';

export function registerVotingHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  sessionRegistry: GameSessionRegistry,
  auth: SocketAuthRegistry,
): void {
  /** Looks up the caller's active game session, or reports why it can't. */
  function withSession(action: (playerId: string, session: GameSession) => void) {
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
      action(authData.playerId, session);
    } catch (err) {
      sendError(socket, err);
    }
  }

  socket.on(ClientEvents.VOTE_CAST, (payload: VoteCastPayload) => {
    withSession((playerId, session) => session.handleVoteCast(playerId, payload.targetId));
  });

  socket.on(ClientEvents.JUDGE_FORCE_REVOTE, () => {
    withSession((playerId, session) => session.handleJudgeRevote(playerId));
  });

  socket.on(ClientEvents.MAID_SWAP, (payload: MaidSwapPayload) => {
    withSession((playerId, session) => session.handleMaidSwap(playerId, payload.swap));
  });

  socket.on(ClientEvents.MAID_NIGHT_SWAP, (payload: MaidNightSwapPayload) => {
    withSession((playerId, session) => session.handleMaidNightSwap(playerId, payload.chosenVictimId));
  });

  socket.on(ClientEvents.HUNTER_SHOOT, (payload: HunterShootPayload) => {
    withSession((playerId, session) => session.handleHunterShot(playerId, payload.targetId));
  });

  socket.on(ClientEvents.MAYOR_VOTE_CAST, (payload: MayorVoteCastPayload) => {
    withSession((playerId, session) => session.handleMayorVoteCast(playerId, payload.targetId));
  });

  socket.on(ClientEvents.CHIEF_CHOOSE_SUCCESSOR, (payload: ChiefChooseSuccessorPayload) => {
    withSession((playerId, session) => session.handleChiefChooseSuccessor(playerId, payload.targetId));
  });
}
