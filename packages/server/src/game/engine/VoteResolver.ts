import { VotingSubPhase } from '@werewolf/shared';

export interface VoteResolutionResult {
  tally: Record<string, number>;
  /** Player(s) tied for the most votes. Length 1 means a clear winner. */
  tiedPlayerIds: string[];
  eliminatedPlayerId: string | null;
  /** True only when FIRST_VOTE ended in a tie and a REVOTE should follow. */
  needsRevote: boolean;
}

/**
 * Resolves a round of voting.
 *
 * Rule (see project assumptions): a tie in FIRST_VOTE triggers an
 * automatic revote restricted to the tied players. If REVOTE also ties,
 * no one is eliminated that day.
 *
 * `votes` maps voterId -> targetId. Only votes from `eligibleVoterIds`
 * are counted (defensive filter — the caller should already prevent dead
 * players from voting, but this keeps the function safe standalone).
 */
export function resolveVotes(
  votes: Record<string, string>,
  eligibleVoterIds: string[],
  subPhase: VotingSubPhase,
  voteWeights: Record<string, number> = {},
): VoteResolutionResult {
  const eligibleSet = new Set(eligibleVoterIds);
  const tally: Record<string, number> = {};

  for (const [voterId, targetId] of Object.entries(votes)) {
    if (!eligibleSet.has(voterId)) continue;
    tally[targetId] = (tally[targetId] ?? 0) + (voteWeights[voterId] ?? 1);
  }

  const entries = Object.entries(tally);
  if (entries.length === 0) {
    return { tally, tiedPlayerIds: [], eliminatedPlayerId: null, needsRevote: false };
  }

  const maxVotes = Math.max(...entries.map(([, count]) => count));
  const tiedPlayerIds = entries.filter(([, count]) => count === maxVotes).map(([id]) => id);

  if (tiedPlayerIds.length === 1) {
    return {
      tally,
      tiedPlayerIds,
      eliminatedPlayerId: tiedPlayerIds[0],
      needsRevote: false,
    };
  }

  // Tie: revote only if we haven't already revoted this round.
  const needsRevote = subPhase === VotingSubPhase.FIRST_VOTE;
  return { tally, tiedPlayerIds, eliminatedPlayerId: null, needsRevote };
}
