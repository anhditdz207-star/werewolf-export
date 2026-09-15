import { RoleName } from './roles';

/** Cause of death, used for DAY_REVEAL messaging and Hunter trigger logic. */
export enum DeathCause {
  WEREWOLF = 'WEREWOLF',
  WITCH_POISON = 'WITCH_POISON',
  VOTED_OUT = 'VOTED_OUT',
  LOVER_HEARTBREAK = 'LOVER_HEARTBREAK',
  HUNTER_SHOT = 'HUNTER_SHOT',
  WHITE_WOLF = 'WHITE_WOLF',
  RUSTY_KNIGHT_POISON = 'RUSTY_KNIGHT_POISON',
}

/**
 * Witch-specific runtime state. Kept separate so it's easy to see at a
 * glance which roles carry extra state beyond alive/dead.
 */
export interface WitchState {
  hasHealPotion: boolean;
  hasPoisonPotion: boolean;
}

/** Guard-specific runtime state, needed to enforce "no repeat target" rule. */
export interface GuardState {
  lastProtectedPlayerId: string | null;
}

/** Father Wolf's one-time-per-game conversion ability. */
export interface FatherWolfState {
  hasUsedConversion: boolean;
}

/** White Wolf's solo kill, usable once every 2 nights. */
export interface WhiteWolfState {
  /** dayCount of the last night the solo kill was used, or null if never. */
  lastActionDayCount: number | null;
}

/** Fox's scouting ability — lost permanently after one whiff (0 wolves found). */
export interface FoxState {
  hasLostAbility: boolean;
}

/** Elder's extra life against werewolf bites specifically. Starts at 2. */
export interface ElderState {
  livesRemaining: number;
}

/** Idiot's one-time "spared from hanging" effect. */
export interface IdiotState {
  isRevealed: boolean;
}

/** Corrupt Judge's one-time forced revote. */
export interface CorruptJudgeState {
  hasUsedRevote: boolean;
}

/** Wild Child's chosen idol, set once on the first night. */
export interface WildChildState {
  idolPlayerId: string | null;
}

/**
 * Player — full server-side representation of a participant.
 * Note: `role` and role-specific state are stripped out before broadcasting
 * to anyone other than the player themselves (see sanitizePlayerForBroadcast
 * on the server).
 */
export interface Player {
  id: string; // stable player id (persists across reconnects), NOT the socket.id
  socketId: string | null; // null when disconnected
  nickname: string;
  avatarUrl: string | null;
  isHost: boolean;
  isAlive: boolean;
  isConnected: boolean;
  /** Public elected title (NOT a hidden role card) — see GameStateMachine's
   * "Village Chief" section. Independent of `role`; any role can hold it. */
  isVillageChief: boolean;

  role: RoleName | null; // null until ROLE_ASSIGN
  deathCause: DeathCause | null;
  diedOnDay: number | null;

  loverId: string | null; // set by Cupid on night 1, mutual link

  witchState: WitchState | null; // present only if role === WITCH
  guardState: GuardState | null; // present only if role === GUARD
  fatherWolfState: FatherWolfState | null; // present only if role === FATHER_WOLF
  whiteWolfState: WhiteWolfState | null; // present only if role === WHITE_WOLF
  foxState: FoxState | null; // present only if role === FOX
  elderState: ElderState | null; // present only if role === ELDER
  idiotState: IdiotState | null; // present only if role === IDIOT
  corruptJudgeState: CorruptJudgeState | null; // present only if role === CORRUPT_JUDGE
  wildChildState: WildChildState | null; // present only if role === WILD_CHILD
  /** Flutist's hypnosis mark — any role can carry this, not just Flutist. */
  isHypnotized: boolean;
  /** Cult Leader's recruitment mark — any role can carry this, including the leader. */
  isCultMember: boolean;
}

export function createEmptyPlayer(
  id: string,
  nickname: string,
  isHost: boolean,
  avatarUrl: string | null = null,
): Player {
  return {
    id,
    socketId: null,
    nickname,
    avatarUrl,
    isHost,
    isAlive: true,
    isConnected: true,
    isVillageChief: false,
    role: null,
    deathCause: null,
    diedOnDay: null,
    loverId: null,
    witchState: null,
    guardState: null,
    fatherWolfState: null,
    whiteWolfState: null,
    foxState: null,
    elderState: null,
    idiotState: null,
    corruptJudgeState: null,
    wildChildState: null,
    isHypnotized: false,
    isCultMember: false,
  };
}
