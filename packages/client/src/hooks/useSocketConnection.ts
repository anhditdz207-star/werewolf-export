import { useEffect } from 'react';
import {
  AllyRevealedPayload,
  ChatMessagePayload,
  DayRevealPayload,
  FoxResultPayload,
  GameOverPayload,
  HunterPromptPayload,
  LittleGirlResultPayload,
  ChiefSuccessorPromptPayload,
  MaidNightPromptPayload,
  MaidPromptPayload,
  MayorElectedPayload,
  NightActionConfirmedPayload,
  NightActionLogPayload,
  NightPromptPayload,
  RoleAssignedPayload,
  RoomErrorPayload,
  RoomStatePayload,
  SeerResultPayload,
  ServerEvents,
  ThiefCardsPayload,
  VoteResultPayload,
  VoteTallyPayload,
} from '@werewolf/shared';
import { socket } from '../lib/socket';
import { useGameDispatch } from '../store/GameContext';

/**
 * Subscribes to every ServerEvents.* event once and translates each into
 * a reducer action. This is the ONLY place that listens on the raw
 * socket — components never call socket.on directly, they read from
 * useGameState() instead. Keeps the socket <-> state mapping in one
 * auditable place.
 */
export function useSocketConnection(): void {
  const dispatch = useGameDispatch();

  useEffect(() => {
    const onRoomState = (state: RoomStatePayload) => dispatch({ type: 'ROOM_STATE', state });
    const onRoleAssigned = (payload: RoleAssignedPayload) =>
      dispatch({ type: 'ROLE_ASSIGNED', payload });
    const onNightPrompt = (payload: NightPromptPayload) =>
      dispatch({ type: 'NIGHT_PROMPT', payload });
    const onNightActionConfirmed = (payload: NightActionConfirmedPayload) =>
      dispatch({ type: 'NIGHT_ACTION_CONFIRMED', payload });
    const onNightActionLog = (payload: NightActionLogPayload) =>
      dispatch({ type: 'NIGHT_ACTION_LOG', payload });
    const onSeerResult = (payload: SeerResultPayload) => dispatch({ type: 'SEER_RESULT', payload });
    const onLittleGirlResult = (payload: LittleGirlResultPayload) =>
      dispatch({ type: 'LITTLE_GIRL_RESULT', payload });
    const onFoxResult = (payload: FoxResultPayload) => dispatch({ type: 'FOX_RESULT', payload });
    const onAllyRevealed = (payload: AllyRevealedPayload) =>
      dispatch({ type: 'ALLY_REVEALED', payload });
    const onThiefCards = (payload: ThiefCardsPayload) => dispatch({ type: 'THIEF_CARDS', payload });
    const onMaidPrompt = (payload: MaidPromptPayload) => dispatch({ type: 'MAID_PROMPT', payload });
    const onMaidNightPrompt = (payload: MaidNightPromptPayload) =>
      dispatch({ type: 'MAID_NIGHT_PROMPT', payload });
    const onChiefSuccessorPrompt = (payload: ChiefSuccessorPromptPayload) =>
      dispatch({ type: 'CHIEF_SUCCESSOR_PROMPT', payload });
    const onMayorElected = (payload: MayorElectedPayload) => {
      dispatch({ type: 'MAYOR_ELECTED', payload });
      dispatch({ type: 'CHIEF_SUCCESSOR_PROMPT', payload: null });
    };
    const onDayReveal = (payload: DayRevealPayload) => dispatch({ type: 'DAY_REVEAL', payload });
    const onVoteTally = (payload: VoteTallyPayload) =>
      dispatch({ type: 'VOTE_TALLY', tally: payload.tally });
    const onVoteResult = (payload: VoteResultPayload) =>
      dispatch({ type: 'VOTE_RESULT', payload });
    const onHunterPrompt = (payload: HunterPromptPayload) =>
      dispatch({ type: 'HUNTER_PROMPT', payload });
    const onGameOver = (payload: GameOverPayload) => dispatch({ type: 'GAME_OVER', payload });
    const onChatMessage = (payload: ChatMessagePayload) =>
      dispatch({ type: 'CHAT_MESSAGE', payload });
    const onRoomError = (payload: RoomErrorPayload) =>
      dispatch({ type: 'ERROR', message: payload.message });

    socket.on(ServerEvents.ROOM_STATE, onRoomState);
    socket.on(ServerEvents.ROLE_ASSIGNED, onRoleAssigned);
    socket.on(ServerEvents.NIGHT_PROMPT, onNightPrompt);
    socket.on(ServerEvents.NIGHT_ACTION_CONFIRMED, onNightActionConfirmed);
    socket.on(ServerEvents.NIGHT_ACTION_LOG, onNightActionLog);
    socket.on(ServerEvents.SEER_RESULT, onSeerResult);
    socket.on(ServerEvents.LITTLE_GIRL_RESULT, onLittleGirlResult);
    socket.on(ServerEvents.FOX_RESULT, onFoxResult);
    socket.on(ServerEvents.ALLY_REVEALED, onAllyRevealed);
    socket.on(ServerEvents.THIEF_CARDS, onThiefCards);
    socket.on(ServerEvents.MAID_PROMPT, onMaidPrompt);
    socket.on(ServerEvents.MAID_NIGHT_PROMPT, onMaidNightPrompt);
    socket.on(ServerEvents.CHIEF_SUCCESSOR_PROMPT, onChiefSuccessorPrompt);
    socket.on(ServerEvents.MAYOR_ELECTED, onMayorElected);
    socket.on(ServerEvents.DAY_REVEAL, onDayReveal);
    socket.on(ServerEvents.VOTE_TALLY, onVoteTally);
    socket.on(ServerEvents.VOTE_RESULT, onVoteResult);
    socket.on(ServerEvents.HUNTER_PROMPT, onHunterPrompt);
    socket.on(ServerEvents.GAME_OVER, onGameOver);
    socket.on(ServerEvents.CHAT_MESSAGE, onChatMessage);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);

    return () => {
      socket.off(ServerEvents.ROOM_STATE, onRoomState);
      socket.off(ServerEvents.ROLE_ASSIGNED, onRoleAssigned);
      socket.off(ServerEvents.NIGHT_PROMPT, onNightPrompt);
      socket.off(ServerEvents.NIGHT_ACTION_CONFIRMED, onNightActionConfirmed);
      socket.off(ServerEvents.NIGHT_ACTION_LOG, onNightActionLog);
      socket.off(ServerEvents.SEER_RESULT, onSeerResult);
      socket.off(ServerEvents.LITTLE_GIRL_RESULT, onLittleGirlResult);
      socket.off(ServerEvents.FOX_RESULT, onFoxResult);
      socket.off(ServerEvents.ALLY_REVEALED, onAllyRevealed);
      socket.off(ServerEvents.THIEF_CARDS, onThiefCards);
      socket.off(ServerEvents.MAID_PROMPT, onMaidPrompt);
      socket.off(ServerEvents.MAID_NIGHT_PROMPT, onMaidNightPrompt);
      socket.off(ServerEvents.CHIEF_SUCCESSOR_PROMPT, onChiefSuccessorPrompt);
      socket.off(ServerEvents.MAYOR_ELECTED, onMayorElected);
      socket.off(ServerEvents.DAY_REVEAL, onDayReveal);
      socket.off(ServerEvents.VOTE_TALLY, onVoteTally);
      socket.off(ServerEvents.VOTE_RESULT, onVoteResult);
      socket.off(ServerEvents.HUNTER_PROMPT, onHunterPrompt);
      socket.off(ServerEvents.GAME_OVER, onGameOver);
      socket.off(ServerEvents.CHAT_MESSAGE, onChatMessage);
      socket.off(ServerEvents.ROOM_ERROR, onRoomError);
    };
  }, [dispatch]);
}
