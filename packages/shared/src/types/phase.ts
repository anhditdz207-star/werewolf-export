/**
 * GamePhase — every state the game FSM can be in.
 *
 * Flow (see GameStateMachine.ts on the server for transition rules):
 *
 *   WAITING -> ROLE_ASSIGN -> NIGHT -> DAY_REVEAL -> [MAYOR_ELECTION, day 1 only] -> DISCUSSION -> VOTING
 *      -> (check win) -> NIGHT (loop) | GAME_OVER
 */
export enum GamePhase {
  /** Lobby: players joining, host configuring roles. */
  WAITING = 'WAITING',
  /** Roles have just been assigned; each player is shown their role privately. */
  ROLE_ASSIGN = 'ROLE_ASSIGN',
  /** Night actions happen in a fixed sub-order (see NightSubPhase). */
  NIGHT = 'NIGHT',
  /** Server announces who died overnight and (if applicable) how. */
  DAY_REVEAL = 'DAY_REVEAL',
  /** Day 1 only, if config.electMayor: public vote for Village Chief
   * (a public title, not a hidden role card) before discussion opens. */
  MAYOR_ELECTION = 'MAYOR_ELECTION',
  /** Timed open discussion among living players. */
  DISCUSSION = 'DISCUSSION',
  /** Players vote to eliminate a suspect; ties trigger a revote. */
  VOTING = 'VOTING',
  /** A win condition has been met; final reveal of all roles. */
  GAME_OVER = 'GAME_OVER',
}

/**
 * NightSubPhase — the fixed order in which roles act during NIGHT.
 * Cupid only acts when dayCount === 1 (first night only).
 */
export enum NightSubPhase {
  CUPID = 'CUPID', // first night only
  WILD_CHILD_IDOL = 'WILD_CHILD_IDOL', // first night only — pick an idol
  WEREWOLF = 'WEREWOLF',
  WEREWOLF_BONUS = 'WEREWOLF_BONUS', // 2nd pack victim (Wolf Cub death bonus / Alpha Wolf)
  FATHER_WOLF_DECISION = 'FATHER_WOLF_DECISION', // convert victim instead of killing
  WHITE_WOLF = 'WHITE_WOLF', // solo kill of a fellow wolf, every 2 nights
  LITTLE_GIRL_PEEK = 'LITTLE_GIRL_PEEK', // opt-in peek while wolves confer
  FOX = 'FOX', // scouts a target + its 2 neighbors for wolf presence
  FLUTIST = 'FLUTIST', // hypnotizes up to 2 players
  CULT_LEADER = 'CULT_LEADER', // recruits 1 player into the cult
  GUARD = 'GUARD',
  WITCH = 'WITCH',
  SEER = 'SEER',
  RESOLVING = 'RESOLVING', // server computing outcome, no player input
}

/**
 * VotingSubPhase — supports the tie -> revote -> no-elimination rule.
 */
export enum VotingSubPhase {
  FIRST_VOTE = 'FIRST_VOTE',
  REVOTE = 'REVOTE', // only entered if FIRST_VOTE ties; candidates limited to tied players
}
