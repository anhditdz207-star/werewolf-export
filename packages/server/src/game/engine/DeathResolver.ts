import { DeathCause, Player, RoleName } from '@werewolf/shared';

export interface DeathApplicationResult {
  updatedPlayers: Player[];
  deathDetails: Array<{ playerId: string; cause: DeathCause }>;
  /** Newly-dead players holding the Hunter role — caller must prompt
   * them to shoot before the game state is considered settled. */
  hunterPendingShotIds: string[];
  /** True if the Elder just died from a vote or Witch poison (not a wolf
   * bite) — caller should permanently disable Villager active night
   * skills starting the next night. */
  villagerSkillsShouldBeDisabled: boolean;
  /** Wild Children whose idol died in this batch — they just flipped to
   * Werewolf. Caller should notify them of their new role/teammates. */
  wildChildTurnedIds: string[];
}

const WOLF_BITE_CAUSES = new Set([DeathCause.WEREWOLF, DeathCause.WHITE_WOLF]);
const ELDER_SKILL_LOCK_CAUSES = new Set([DeathCause.VOTED_OUT, DeathCause.WITCH_POISON]);

/**
 * Applies a set of initial deaths to the player list, then resolves the
 * Cupid lover cascade to a fixpoint (in case of chained pairs — not
 * possible with a single Cupid, but this stays correct if that rule
 * ever changes), and detects any newly-dead Hunters.
 *
 * This is the ONLY place that marks a player as dead. Night resolution,
 * vote elimination, and Hunter's own retaliation shot all funnel through
 * here so the lover/Hunter/Elder rules can never be implemented
 * inconsistently in two places.
 */
export function applyDeaths(
  players: Player[],
  initialDeaths: Map<string, DeathCause>,
  dayCount: number,
): DeathApplicationResult {
  const updated = players.map((p) => ({ ...p }));
  const byId = new Map(updated.map((p) => [p.id, p]));
  const deathCauseById = new Map(initialDeaths);

  let changed = true;
  while (changed) {
    changed = false;
    for (const deadId of Array.from(deathCauseById.keys())) {
      const deadPlayer = byId.get(deadId);
      const loverId = deadPlayer?.loverId;
      if (loverId && !deathCauseById.has(loverId)) {
        const lover = byId.get(loverId);
        if (lover && lover.isAlive) {
          deathCauseById.set(loverId, DeathCause.LOVER_HEARTBREAK);
          changed = true;
        }
      }
    }
  }

  const hunterPendingShotIds: string[] = [];
  const deathDetails: Array<{ playerId: string; cause: DeathCause }> = [];
  let villagerSkillsShouldBeDisabled = false;

  for (const [playerId, cause] of deathCauseById.entries()) {
    const player = byId.get(playerId);
    if (!player || !player.isAlive) continue; // already dead, ignore

    // Elder survives a werewolf bite as long as they still have a spare
    // life — the bite is absorbed instead of killing them.
    if (
      player.role === RoleName.ELDER &&
      player.elderState &&
      WOLF_BITE_CAUSES.has(cause) &&
      player.elderState.livesRemaining > 1
    ) {
      player.elderState = { livesRemaining: player.elderState.livesRemaining - 1 };
      continue;
    }

    player.isAlive = false;
    player.deathCause = cause;
    player.diedOnDay = dayCount;
    deathDetails.push({ playerId, cause });
    if (player.role === RoleName.HUNTER) {
      hunterPendingShotIds.push(playerId);
    }
    if (player.role === RoleName.ELDER && ELDER_SKILL_LOCK_CAUSES.has(cause)) {
      villagerSkillsShouldBeDisabled = true;
    }
  }

  // Wild Child's idol just died (in this very batch) — instantly flips
  // them to Werewolf. Checked against actual applied deaths, not the
  // initial intent map, so an already-dead idol from a previous event
  // can't re-trigger this.
  const justDiedIds = new Set(deathDetails.map((d) => d.playerId));
  const wildChildTurnedIds: string[] = [];
  for (const player of updated) {
    if (
      player.role === RoleName.WILD_CHILD &&
      player.isAlive &&
      player.wildChildState?.idolPlayerId &&
      justDiedIds.has(player.wildChildState.idolPlayerId)
    ) {
      player.role = RoleName.WEREWOLF;
      player.wildChildState = null;
      wildChildTurnedIds.push(player.id);
    }
  }

  return {
    updatedPlayers: updated,
    deathDetails,
    hunterPendingShotIds,
    villagerSkillsShouldBeDisabled,
    wildChildTurnedIds,
  };
}
