import { Server, Socket } from 'socket.io';
import {
  ClientEvents,
  NightActionCultLeaderPayload,
  NightActionCupidPayload,
  NightActionFatherWolfPayload,
  NightActionFlutistPayload,
  NightActionFoxPayload,
  NightActionGuardPayload,
  NightActionLittleGirlPayload,
  NightActionSeerPayload,
  NightActionWerewolfBonusPayload,
  NightActionWerewolfPayload,
  NightActionWhiteWolfPayload,
  NightActionWildChildPayload,
  NightActionWitchPayload,
} from '@werewolf/shared';
import { RoomManager } from '../../rooms/RoomManager';
import { GameSession } from '../../game/GameSession';
import { GameLogicError } from '../../game/GameLogicError';
import { GameSessionRegistry } from '../GameSessionRegistry';
import { SocketAuthRegistry } from '../SocketAuth';
import { sendError } from '../broadcast';

export function registerNightActionHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  sessionRegistry: GameSessionRegistry,
  auth: SocketAuthRegistry,
): void {
  function getActiveSession(): { session: GameSession; playerId: string } | null {
    const authData = auth.get(socket.id);
    if (!authData) {
      sendError(socket, new GameLogicError('Bạn chưa tham gia phòng nào.', 'NOT_IN_ROOM'));
      return null;
    }
    const session = sessionRegistry.get(authData.roomId);
    if (!session) {
      sendError(socket, new GameLogicError('Ván đấu chưa bắt đầu.', 'NO_ACTIVE_GAME'));
      return null;
    }
    return { session, playerId: authData.playerId };
  }

  socket.on(ClientEvents.NIGHT_ACTION_WEREWOLF, (payload: NightActionWerewolfPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleWerewolfTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_WEREWOLF_BONUS, (payload: NightActionWerewolfBonusPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleWerewolfBonusTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_FATHER_WOLF, (payload: NightActionFatherWolfPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleFatherWolfDecision(ctx.playerId, payload.convert);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_WHITE_WOLF, (payload: NightActionWhiteWolfPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleWhiteWolfTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_LITTLE_GIRL, (payload: NightActionLittleGirlPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleLittleGirlPeek(ctx.playerId, payload.peek);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_FOX, (payload: NightActionFoxPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleFoxTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_WILD_CHILD, (payload: NightActionWildChildPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleWildChildIdol(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_FLUTIST, (payload: NightActionFlutistPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleFlutistTargets(ctx.playerId, payload.targetIds);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_CULT_LEADER, (payload: NightActionCultLeaderPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleCultLeaderTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_GUARD, (payload: NightActionGuardPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleGuardTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_SEER, (payload: NightActionSeerPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleSeerTarget(ctx.playerId, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_WITCH, (payload: NightActionWitchPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleWitchAction(ctx.playerId, payload.action, payload.targetId);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on(ClientEvents.NIGHT_ACTION_CUPID, (payload: NightActionCupidPayload) => {
    const ctx = getActiveSession();
    if (!ctx) return;
    try {
      ctx.session.handleCupidTargets(ctx.playerId, payload.targetId1, payload.targetId2);
    } catch (err) {
      sendError(socket, err);
    }
  });
}
