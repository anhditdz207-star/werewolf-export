export const TIMING = {
  /** Delay after ROLE_ASSIGN before the first night begins, giving
   * clients time to show the role-reveal modal. */
  ROLE_REVEAL_DELAY_MS: 6000,
  /** How long a DAY_REVEAL banner stays up before discussion opens. */
  DAY_REVEAL_DISPLAY_MS: 5000,
  /** Max time a night role gets to submit their action before the
   * server auto-advances (treated as a skip). */
  NIGHT_ACTION_TIMEOUT_SECONDS: 20,
  /** Max time a Hunter gets to choose a retaliation target. */
  HUNTER_SHOT_TIMEOUT_SECONDS: 15,
  /** Max time a dying Village Chief gets to name a successor before the title goes vacant. */
  CHIEF_SUCCESSOR_TIMEOUT_SECONDS: 15,
  /** Max time the Maid gets to decide whether to take a hanging victim's place. */
  MAID_DECISION_TIMEOUT_MS: 8000,
} as const;
