import { DeathCause, Player } from './player';
import { GameState, RoomConfig } from './room';
import { RoleName } from './roles';

/**
 * All event names as constants (not raw strings) so a typo becomes a
 * compile error instead of a silent runtime bug.
 */
export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_REJOIN: 'room:rejoin',
  ROOM_LEAVE: 'room:leave',
  ROOM_UPDATE_CONFIG: 'room:updateConfig',
  ROOM_START: 'room:start',
  PLAYER_UPDATE_AVATAR: 'player:updateAvatar',

  NIGHT_ACTION_WEREWOLF: 'night:action:werewolf',
  NIGHT_ACTION_WEREWOLF_BONUS: 'night:action:werewolfBonus',
  NIGHT_ACTION_FATHER_WOLF: 'night:action:fatherWolf',
  NIGHT_ACTION_WHITE_WOLF: 'night:action:whiteWolf',
  NIGHT_ACTION_LITTLE_GIRL: 'night:action:littleGirl',
  NIGHT_ACTION_FOX: 'night:action:fox',
  NIGHT_ACTION_WILD_CHILD: 'night:action:wildChild',
  NIGHT_ACTION_FLUTIST: 'night:action:flutist',
  NIGHT_ACTION_CULT_LEADER: 'night:action:cultLeader',
  THIEF_CHOOSE: 'thief:choose',
  MAID_SWAP: 'maid:swap',
  MAID_NIGHT_SWAP: 'maid:nightSwap',
  NIGHT_ACTION_SEER: 'night:action:seer',
  NIGHT_ACTION_GUARD: 'night:action:guard',
  NIGHT_ACTION_WITCH: 'night:action:witch',
  NIGHT_ACTION_CUPID: 'night:action:cupid',

  CHAT_SEND: 'chat:send',
  VOTE_CAST: 'vote:cast',
  JUDGE_FORCE_REVOTE: 'vote:judgeForceRevote',
  HUNTER_SHOOT: 'hunter:shoot',
  MAYOR_VOTE_CAST: 'mayor:vote',
  CHIEF_CHOOSE_SUCCESSOR: 'chief:chooseSuccessor',

  VOICE_OFFER: 'voice:offer',
  VOICE_ANSWER: 'voice:answer',
  VOICE_ICE_CANDIDATE: 'voice:ice',

  IDENTIFY: 'social:identify',
  LOBBY_CHAT_SEND: 'social:lobbyChatSend',
  DM_SEND: 'social:dmSend',
  DM_HISTORY_REQUEST: 'social:dmHistoryRequest',
  FRIEND_ADD: 'social:friendAdd',
  FRIEND_ACCEPT: 'social:friendAccept',
  FRIEND_DECLINE: 'social:friendDecline',
  FRIEND_REMOVE: 'social:friendRemove',
  FRIEND_LIST_REQUEST: 'social:friendListRequest',
} as const;

export const ServerEvents = {
  ROOM_STATE: 'room:state', // sanitized full state, broadcast after every change
  ROOM_ERROR: 'room:error',
  ROLE_ASSIGNED: 'role:assigned', // private, sent only to the individual player's socket
  ROLE_REVEALED: 'role:revealed', // public — e.g. the Idiot surviving a hanging
  ALLY_REVEALED: 'ally:revealed', // private — Twin Sisters / Three Brothers night-1 reveal
  CULT_UPDATE: 'cult:update', // private — sent to a player when recruited into the cult
  THIEF_CARDS: 'thief:cards', // private — the Thief's 2 spare-card options
  MAID_PROMPT: 'maid:prompt', // private — Maid is offered the chance to swap
  MAID_NIGHT_PROMPT: 'maid:nightPrompt', // private — Maid may swap into one of tonight's dead

  NIGHT_PROMPT: 'night:prompt', // tells a specific player it's their turn to act
  // Private — sent once a night sub-phase's decision is locked in, to (a)
  // teammates who shared that sub-phase but didn't submit (currently only
  // relevant for the werewolf pack) and (b) every dead player, so ghosts
  // can watch the night unfold. Never sent to a living non-teammate.
  NIGHT_ACTION_CONFIRMED: 'night:actionConfirmed',
  // Private — sent once, right after a dead player reconnects mid-night,
  // catching them up on every action already confirmed that night (the
  // live NIGHT_ACTION_CONFIRMED stream only reaches sockets connected at
  // the moment it fires).
  NIGHT_ACTION_LOG: 'night:actionLog',
  SEER_RESULT: 'seer:result', // private result of a seer's inspection

  VOICE_OFFER: 'voice:offer', // relayed 1:1 signaling for the mesh voice-chat WebRTC connections
  VOICE_ANSWER: 'voice:answer',
  VOICE_ICE_CANDIDATE: 'voice:ice',
  VOICE_PEER_LEFT: 'voice:peerLeft', // tells peers to tear down their connection to a disconnected player
  LITTLE_GIRL_RESULT: 'littleGirl:result', // private result of a peek
  FOX_RESULT: 'fox:result', // private result of a scout
  BEAR_GROWL: 'bear:growl', // public: bear tamer sensed a wolf next to them

  DAY_REVEAL: 'day:reveal',
  CHAT_MESSAGE: 'chat:message',

  VOTE_TALLY: 'vote:tally', // live vote counts during VOTING
  VOTE_RESULT: 'vote:result',

  HUNTER_PROMPT: 'hunter:prompt', // sent to the hunter who just died
  MAYOR_ELECTED: 'mayor:elected', // public — Village Chief elected or title transferred to a successor
  CHIEF_SUCCESSOR_PROMPT: 'chief:successorPrompt', // sent privately to a Village Chief who just died

  GAME_OVER: 'game:over',

  LOBBY_CHAT_MESSAGE: 'social:lobbyChatMessage',
  LOBBY_CHAT_HISTORY: 'social:lobbyChatHistory',
  DM_MESSAGE: 'social:dmMessage',
  DM_HISTORY: 'social:dmHistory',
  FRIEND_LIST: 'social:friendList',
  SOCIAL_ERROR: 'social:error',
} as const;

// ---------- Client -> Server payloads ----------

export interface RoomCreatePayload {
  nickname: string;
  avatarUrl?: string | null;
}
export interface RoomJoinPayload {
  roomId: string;
  nickname: string;
  avatarUrl?: string | null;
}
/**
 * Re-associates an existing playerId (persisted client-side, e.g. in
 * localStorage) with a brand-new socket.id — used after a page
 * reload/reconnect instead of ROOM_JOIN, which would create a new
 * player. See SocketAuth.ts for the server-side rationale.
 */
export interface RoomRejoinPayload {
  roomId: string;
  playerId: string;
}
export interface RoomRejoinAck {
  ok: boolean;
  roomId?: string;
  playerId?: string;
}
export interface PlayerUpdateAvatarPayload {
  avatarUrl: string | null;
}
export interface RoomUpdateConfigPayload {
  config: RoomConfig;
}
export interface NightActionWerewolfPayload {
  targetId: string;
}
export interface NightActionWerewolfBonusPayload {
  targetId: string;
}
export interface NightActionFatherWolfPayload {
  /** true = convert the pack's victim into a Werewolf instead of killing them. */
  convert: boolean;
}
export interface NightActionWhiteWolfPayload {
  targetId: string;
}
export interface NightActionLittleGirlPayload {
  peek: boolean;
}
export interface NightActionFoxPayload {
  targetId: string;
}
export interface NightActionWildChildPayload {
  targetId: string;
}
export interface NightActionFlutistPayload {
  /** Up to 2 target ids to hypnotize tonight. */
  targetIds: string[];
}
export interface NightActionCultLeaderPayload {
  targetId: string;
}
export interface ThiefChoosePayload {
  /** One of the 2 offered spare roles, or null to keep the Thief role. */
  chosenRole: RoleName | null;
}
export interface MaidSwapPayload {
  swap: boolean;
}
/** Maid's choice after a night with 1+ deaths: swap into one of them, or decline. */
export interface MaidNightSwapPayload {
  chosenVictimId: string | null;
}
export interface NightActionSeerPayload {
  targetId: string;
}
export interface NightActionGuardPayload {
  targetId: string;
}
export interface NightActionWitchPayload {
  action: 'heal' | 'poison' | 'skip';
  targetId?: string; // required unless action === 'skip'
}
export interface NightActionCupidPayload {
  targetId1: string;
  targetId2: string;
}
export interface ChatSendPayload {
  text: string;
}

/** Generic WebRTC signaling envelope. `data` carries the SDP or ICE
 * candidate as an opaque JSON blob — typed `unknown` here since the
 * concrete RTCSessionDescriptionInit/RTCIceCandidateInit shapes are
 * DOM-only types the server package doesn't have available. */
export interface VoiceSignalSendPayload {
  targetPlayerId: string;
  data: unknown;
}
export interface VoiceSignalReceivedPayload {
  fromPlayerId: string;
  data: unknown;
}
export interface VoicePeerLeftPayload {
  playerId: string;
}
export interface VoteCastPayload {
  targetId: string;
}
export interface HunterShootPayload {
  targetId: string;
}
export interface MayorVoteCastPayload {
  targetId: string;
}
export interface ChiefChooseSuccessorPayload {
  targetId: string;
}

// ---------- Server -> Client payloads ----------

export interface RoomErrorPayload {
  message: string;
  code: string;
}
export interface RoleAssignedPayload {
  role: RoleName;
  /** Only populated for WEREWOLF role: ids of fellow werewolves. */
  teammateIds?: string[];
}
export interface NightPromptPayload {
  subPhase: string; // NightSubPhase value
  /** Valid target player ids the acting player may choose from. */
  eligibleTargetIds: string[];
  timeoutSeconds: number;
}
/** See ServerEvents.NIGHT_ACTION_CONFIRMED. */
export interface NightActionConfirmedPayload {
  subPhase: string; // NightSubPhase value
  targetIds: string[];
}
/** See ServerEvents.NIGHT_ACTION_LOG. */
export interface NightActionLogPayload {
  entries: NightActionConfirmedPayload[];
}
export interface SeerResultPayload {
  targetId: string;
  isWerewolf: boolean;
}
export interface LittleGirlResultPayload {
  werewolfIds: string[];
}
export interface FoxResultPayload {
  targetId: string;
  hasWolf: boolean;
}
export interface RoleRevealedPayload {
  playerId: string;
  role: RoleName;
}
export interface AllyRevealedPayload {
  role: RoleName;
  allyIds: string[];
}
export interface CultUpdatePayload {
  leaderId: string;
  memberIds: string[];
}
export interface ThiefCardsPayload {
  options: [RoleName, RoleName];
}
export interface MaidPromptPayload {
  /** The player about to be hanged, whom the Maid could take the place of. */
  victimId: string;
}
/**
 * Sent privately to a living Maid right after a night with 1+ deaths —
 * before the general DAY_REVEAL broadcast, so the Maid gets first look.
 * Roles are included directly (rather than relying on general state,
 * which hasn't been updated/broadcast yet) so the client can render each
 * candidate's actual role card for the choice.
 */
export interface MaidNightPromptPayload {
  candidates: Array<{ playerId: string; role: RoleName }>;
}
export interface DayRevealPayload {
  dayCount: number;
  deaths: Array<{ playerId: string; cause: DeathCause }>;
}
export interface ChatMessagePayload {
  playerId: string;
  nickname: string;
  text: string;
  timestamp: number;
}
export interface VoteTallyPayload {
  tally: Record<string, number>; // targetId -> vote count
}
export interface VoteResultPayload {
  eliminatedPlayerId: string | null;
  wasRevote: boolean;
}
export interface HunterPromptPayload {
  eligibleTargetIds: string[];
  timeoutSeconds: number;
}
export interface MayorElectedPayload {
  playerId: string; // new Village Chief — first election or a successor transfer
}
export interface ChiefSuccessorPromptPayload {
  eligibleTargetIds: string[];
  timeoutSeconds: number;
}
export interface GameOverPayload {
  winningTeam: 'VILLAGER' | 'WEREWOLF' | 'WHITE_WOLF' | 'ANGEL' | 'FLUTIST' | 'CULT_LEADER';
  allPlayers: Player[]; // full reveal, roles included
}

/** Generic envelope broadcast after every state-changing action. */
export type RoomStatePayload = GameState;

export interface IdentifyPayload {
  deviceId: string;
  nickname: string;
  avatarUrl?: string | null;
}
export interface LobbyChatSendPayload {
  text: string;
}
export interface DmSendPayload {
  toDeviceId: string;
  text: string;
}
export interface DmHistoryRequestPayload {
  withDeviceId: string;
}
export interface FriendAddPayload {
  friendCode: string;
}
export interface FriendRemovePayload {
  deviceId: string;
}
export interface FriendRespondPayload {
  deviceId: string; // the requester's deviceId
}
export interface LobbyChatMessagePayload {
  deviceId: string;
  nickname: string;
  avatarUrl: string | null;
  text: string;
  timestamp: number;
}
export interface DmMessagePayload {
  fromDeviceId: string;
  fromNickname: string;
  fromAvatarUrl: string | null;
  toDeviceId: string;
  text: string;
  timestamp: number;
}
export interface DmHistoryPayload {
  withDeviceId: string;
  messages: DmMessagePayload[];
}
export interface FriendEntry {
  deviceId: string;
  nickname: string;
  avatarUrl: string | null;
  online: boolean;
}
export interface FriendListPayload {
  friends: FriendEntry[];
  pendingRequests: FriendEntry[];
  myFriendCode: string;
}
export interface SocialErrorPayload {
  message: string;
}
