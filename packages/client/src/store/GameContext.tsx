import React, { createContext, useContext, useReducer } from 'react';
import {
  AllyRevealedPayload,
  ChatMessagePayload,
  ChiefSuccessorPromptPayload,
  DayRevealPayload,
  FoxResultPayload,
  GameOverPayload,
  GameState,
  HunterPromptPayload,
  LittleGirlResultPayload,
  MaidNightPromptPayload,
  MaidPromptPayload,
  MayorElectedPayload,
  NightPromptPayload,
  RoleAssignedPayload,
  SeerResultPayload,
  ThiefCardsPayload,
} from '@werewolf/shared';

export interface GameUiState {
  myPlayerId: string | null;
  roomState: GameState | null;
  myRoleInfo: RoleAssignedPayload | null;
  nightPrompt: NightPromptPayload | null;
  seerResult: SeerResultPayload | null;
  littleGirlResult: LittleGirlResultPayload | null;
  foxResult: FoxResultPayload | null;
  allyRevealed: AllyRevealedPayload | null;
  thiefCards: ThiefCardsPayload | null;
  maidPrompt: MaidPromptPayload | null;
  maidNightPrompt: MaidNightPromptPayload | null;
  chiefSuccessorPrompt: ChiefSuccessorPromptPayload | null;
  mayorElected: MayorElectedPayload | null; // transient — drives the announcement banner
  lastDayReveal: DayRevealPayload | null;
  voteTally: Record<string, number>;
  hunterPrompt: HunterPromptPayload | null;
  gameOver: GameOverPayload | null;
  chatMessages: ChatMessagePayload[];
  errorMessage: string | null;
}

const initialState: GameUiState = {
  myPlayerId: null,
  roomState: null,
  myRoleInfo: null,
  nightPrompt: null,
  seerResult: null,
  littleGirlResult: null,
  foxResult: null,
  allyRevealed: null,
  thiefCards: null,
  maidPrompt: null,
  maidNightPrompt: null,
  chiefSuccessorPrompt: null,
  mayorElected: null,
  lastDayReveal: null,
  voteTally: {},
  hunterPrompt: null,
  gameOver: null,
  chatMessages: [],
  errorMessage: null,
};

type Action =
  | { type: 'SET_MY_PLAYER_ID'; playerId: string }
  | { type: 'ROOM_STATE'; state: GameState }
  | { type: 'ROLE_ASSIGNED'; payload: RoleAssignedPayload }
  | { type: 'NIGHT_PROMPT'; payload: NightPromptPayload | null }
  | { type: 'SEER_RESULT'; payload: SeerResultPayload }
  | { type: 'LITTLE_GIRL_RESULT'; payload: LittleGirlResultPayload }
  | { type: 'FOX_RESULT'; payload: FoxResultPayload }
  | { type: 'ALLY_REVEALED'; payload: AllyRevealedPayload }
  | { type: 'THIEF_CARDS'; payload: ThiefCardsPayload | null }
  | { type: 'MAID_PROMPT'; payload: MaidPromptPayload | null }
  | { type: 'MAID_NIGHT_PROMPT'; payload: MaidNightPromptPayload | null }
  | { type: 'CHIEF_SUCCESSOR_PROMPT'; payload: ChiefSuccessorPromptPayload | null }
  | { type: 'MAYOR_ELECTED'; payload: MayorElectedPayload | null }
  | { type: 'DAY_REVEAL'; payload: DayRevealPayload }
  | { type: 'VOTE_TALLY'; tally: Record<string, number> }
  | { type: 'VOTE_RESULT_CLEAR_TALLY' }
  | { type: 'HUNTER_PROMPT'; payload: HunterPromptPayload | null }
  | { type: 'GAME_OVER'; payload: GameOverPayload }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessagePayload }
  | { type: 'ERROR'; message: string | null }
  | { type: 'LEAVE_ROOM' };

function reducer(state: GameUiState, action: Action): GameUiState {
  switch (action.type) {
    case 'SET_MY_PLAYER_ID':
      return { ...state, myPlayerId: action.playerId };
    case 'ROOM_STATE':
      return { ...state, roomState: action.state };
    case 'ROLE_ASSIGNED':
      return { ...state, myRoleInfo: action.payload };
    case 'NIGHT_PROMPT':
      return { ...state, nightPrompt: action.payload, littleGirlResult: null, foxResult: null };
    case 'SEER_RESULT':
      return { ...state, seerResult: action.payload };
    case 'LITTLE_GIRL_RESULT':
      return { ...state, littleGirlResult: action.payload };
    case 'FOX_RESULT':
      return { ...state, foxResult: action.payload };
    case 'ALLY_REVEALED':
      return { ...state, allyRevealed: action.payload };
    case 'THIEF_CARDS':
      return { ...state, thiefCards: action.payload };
    case 'MAID_PROMPT':
      return { ...state, maidPrompt: action.payload };
    case 'MAID_NIGHT_PROMPT':
      return { ...state, maidNightPrompt: action.payload };
    case 'CHIEF_SUCCESSOR_PROMPT':
      return { ...state, chiefSuccessorPrompt: action.payload };
    case 'MAYOR_ELECTED':
      return { ...state, mayorElected: action.payload };
    case 'DAY_REVEAL':
      return { ...state, lastDayReveal: action.payload, nightPrompt: null, maidNightPrompt: null };
    case 'VOTE_TALLY':
      return { ...state, voteTally: action.tally };
    case 'VOTE_RESULT_CLEAR_TALLY':
      return { ...state, voteTally: {} };
    case 'HUNTER_PROMPT':
      return { ...state, hunterPrompt: action.payload };
    case 'GAME_OVER':
      return { ...state, gameOver: action.payload };
    case 'CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload].slice(-200) };
    case 'ERROR':
      return { ...state, errorMessage: action.message };
    case 'LEAVE_ROOM':
      return { ...initialState, myPlayerId: state.myPlayerId };
    default:
      return state;
  }
}

const GameStateContext = createContext<GameUiState | null>(null);
const GameDispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>{children}</GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameUiState {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useGameState must be used within GameProvider');
  return ctx;
}

export function useGameDispatch(): React.Dispatch<Action> {
  const ctx = useContext(GameDispatchContext);
  if (!ctx) throw new Error('useGameDispatch must be used within GameProvider');
  return ctx;
}
