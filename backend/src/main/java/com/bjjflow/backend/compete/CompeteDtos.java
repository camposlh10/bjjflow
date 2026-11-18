package com.bjjflow.backend.compete;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.bjjflow.backend.auth.AuthDtos.BeltDto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CompeteDtos {

    /** A member as shown in rankings and matches. */
    public record PlayerDto(Long id, String username, String displayName, String avatarUrl, BeltDto belt,
            int rating) {
    }

    /** The signed-in member's rating at a glance (Progresso, after a check-in). */
    public record MyRatingDto(
            int rating,
            int monthDelta,
            /** Position in their gym's ranking; null without a gym. */
            Integer gymPosition,
            Integer gymSize,
            /** Training days this week (Monday to Sunday) and the goal the bonus needs. */
            int weekDays,
            int weeklyGoal,
            boolean weekBonusEarned,
            boolean acceptsChallenges,
            int openMatches) {
    }

    public record SettingsRequest(@NotNull Boolean acceptsChallenges) {
    }

    public record RankingEntryDto(int position, PlayerDto player, int monthDelta, boolean me) {
    }

    /** {@code available} is false for the gym board when the member has no gym. */
    public record RankingDto(String scope, boolean available, List<RankingEntryDto> entries) {
    }

    public record ChallengeRequest(@NotNull Long opponentId) {
    }

    public record RoundDto(int roundNo, LocalDate startsOn, LocalDate endsOn, int challengerDays,
            int opponentDays, Long winnerId) {
    }

    /** The round being played: days counted so far and which days. */
    public record CurrentRoundDto(int roundNo, LocalDate startsOn, LocalDate endsOn, Instant settlesAt,
            int challengerDays, int opponentDays, List<LocalDate> challengerDates, List<LocalDate> opponentDates) {
    }

    /** Rating each player gains by winning (the loser loses the same). */
    public record StakeDto(int challengerWin, int opponentWin) {
    }

    /** Finished matches between the two players, as of now. */
    public record HeadToHeadDto(int challengerWins, int opponentWins, int draws) {
    }

    /** A counted training in the match, for the timeline. */
    public record ProofDto(Long userId, LocalDate date, boolean gym, String photoUrl) {
    }

    /**
     * A match, from neither player's side: the app turns it into "you vs them".
     * {@code myRole} is CHALLENGER, OPPONENT or null for someone else viewing a post.
     */
    public record MatchDto(
            Long id,
            String status,
            String myRole,
            PlayerDto challenger,
            PlayerDto opponent,
            LocalDate startsOn,
            int challengerRounds,
            int opponentRounds,
            int roundsPlayed,
            Long winnerId,
            String endReason,
            Integer challengerDelta,
            Integer opponentDelta,
            Instant createdAt,
            Instant expiresAt,
            Instant finishedAt,
            List<RoundDto> rounds,
            CurrentRoundDto current,
            StakeDto stake,
            HeadToHeadDto headToHead,
            /** Detail only: the counted trainings so far, newest first. */
            List<ProofDto> timeline,
            boolean postedByMe) {
    }

    public record MatchListDto(List<MatchDto> incoming, List<MatchDto> outgoing, List<MatchDto> active,
            List<MatchDto> finished) {
    }

    /** What a profile shows about the viewer against this member. */
    public record VersusDto(
            PlayerDto them,
            int myWins,
            int theirWins,
            int draws,
            /** The open (pending or active) match between the two, if any. */
            MatchDto openMatch,
            boolean canChallenge,
            /** Why not, when canChallenge is false: SELF, NOT_CONNECTED, DISABLED, TOO_MANY_MINE, TOO_MANY_THEIRS, OPEN_MATCH. */
            String blockedReason,
            int winGain,
            int lossCost) {
    }

    public record PostRequest(@Size(max = 280) String caption) {
    }

    public record MatchPostDto(
            Long id,
            PlayerDto author,
            /** The original post's author, when this is a repost. */
            PlayerDto repostOf,
            Long originalPostId,
            String caption,
            Instant createdAt,
            MatchDto match,
            int repostCount,
            boolean sharedByMe) {
    }
}
