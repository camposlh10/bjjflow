package com.bjjflow.backend.compete;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.compete.CompeteDtos.CurrentRoundDto;
import com.bjjflow.backend.compete.CompeteDtos.HeadToHeadDto;
import com.bjjflow.backend.compete.CompeteDtos.MatchDto;
import com.bjjflow.backend.compete.CompeteDtos.MatchListDto;
import com.bjjflow.backend.compete.CompeteDtos.PlayerDto;
import com.bjjflow.backend.compete.CompeteDtos.ProofDto;
import com.bjjflow.backend.compete.CompeteDtos.RoundDto;
import com.bjjflow.backend.compete.CompeteDtos.StakeDto;
import com.bjjflow.backend.compete.CompeteDtos.VersusDto;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.social.FollowRepository;
import com.bjjflow.backend.storage.MediaStorage;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Matches: challenge, accept or decline, weekly rounds settled from counted
 * training days, first to 3 rounds, and the rating exchange at the end.
 */
@Service
@RequiredArgsConstructor
public class MatchService {

    static final List<String> OPEN = List.of(Match.PENDING, Match.ACTIVE);

    private final MatchRepository matchRepository;
    private final MatchRoundRepository roundRepository;
    private final MatchPostRepository postRepository;
    private final RatingService ratingService;
    private final TrainingProof trainingProof;
    private final Players players;
    private final UserRepository userRepository;
    private final GymMemberRepository gymMemberRepository;
    private final FollowRepository followRepository;
    private final NotificationService notificationService;
    private final MediaStorage mediaStorage;
    private final JdbcTemplate jdbc;
    private final ChallengeBlocks challengeBlocks;

    // ---------------------------------------------------------------- challenge flow

    @Transactional
    public MatchDto challenge(Long me, Long opponentId) {
        requirePlayer(opponentId);
        String blocked = blockedReason(me, opponentId);
        if (blocked != null) {
            throw new ApiException(HttpStatus.CONFLICT, "CHALLENGE_" + blocked, "You can't challenge this member now");
        }
        Match m = new Match();
        m.setChallengerId(me);
        m.setOpponentId(opponentId);
        m.setStatus(Match.PENDING);
        m = matchRepository.save(m);
        notify(opponentId, nameOf(me) + " desafiou você",
                "Quem treinar mais dias vence a semana. Primeiro a 3 leva a partida. Responda em até 48 h.", m);
        return toDto(m, me, false);
    }

    @Transactional
    public MatchDto accept(Long me, Long matchId) {
        Match m = requireMatch(matchId);
        if (!me.equals(m.getOpponentId()) || !Match.PENDING.equals(m.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "MATCH_NOT_PENDING", "This challenge can't be accepted");
        }
        Instant now = Instant.now();
        if (now.isAfter(m.getCreatedAt().plus(Compete.CHALLENGE_TTL))) {
            throw new ApiException(HttpStatus.CONFLICT, "CHALLENGE_EXPIRED", "This challenge expired");
        }
        if (matchRepository.countForUser(me, List.of(Match.ACTIVE)) >= Compete.MAX_OPEN) {
            throw new ApiException(HttpStatus.CONFLICT, "CHALLENGE_TOO_MANY_MINE", "Too many active matches");
        }
        m.setStatus(Match.ACTIVE);
        m.setRespondedAt(now);
        m.setStartsOn(Compete.today(now).plusDays(1));
        notify(m.getChallengerId(), nameOf(me) + " aceitou o desafio", "A partida começa amanhã. 0 × 0.", m);
        return toDto(m, me, false);
    }

    @Transactional
    public MatchDto decline(Long me, Long matchId) {
        Match m = requireMatch(matchId);
        if (!me.equals(m.getOpponentId()) || !Match.PENDING.equals(m.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "MATCH_NOT_PENDING", "This challenge can't be declined");
        }
        m.setStatus(Match.DECLINED);
        m.setRespondedAt(Instant.now());
        return toDto(m, me, false);
    }

    /** Declines and stops challenges from this challenger for a week. */
    @Transactional
    public MatchDto silence(Long me, Long matchId) {
        MatchDto dto = decline(me, matchId);
        challengeBlocks.set(me, dto.challenger().id(), Instant.now().plus(ChallengeBlocks.SILENCE));
        return dto;
    }

    /** Declines and stops challenges from this challenger until lifted in Privacidade. */
    @Transactional
    public MatchDto block(Long me, Long matchId) {
        MatchDto dto = decline(me, matchId);
        challengeBlocks.set(me, dto.challenger().id(), null);
        return dto;
    }

    @Transactional(readOnly = true)
    public List<CompeteDtos.BlockDto> blocks(Long me) {
        List<ChallengeBlocks.Block> list = challengeBlocks.list(me);
        Map<Long, PlayerDto> p = players.of(list.stream().map(ChallengeBlocks.Block::userId).toList());
        return list.stream().map(b -> new CompeteDtos.BlockDto(p.get(b.userId()), b.until())).toList();
    }

    @Transactional
    public void unblock(Long me, Long userId) {
        challengeBlocks.remove(me, userId);
    }

    @Transactional
    public MatchDto cancel(Long me, Long matchId) {
        Match m = requireMatch(matchId);
        if (!me.equals(m.getChallengerId()) || !Match.PENDING.equals(m.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "MATCH_NOT_PENDING", "This challenge can't be cancelled");
        }
        m.setStatus(Match.CANCELLED);
        m.setRespondedAt(Instant.now());
        return toDto(m, me, false);
    }

    /** Leaving an active match loses it, with the usual rating exchange. */
    @Transactional
    public MatchDto forfeit(Long me, Long matchId) {
        Match m = requireMatch(matchId);
        if (!m.involves(me) || !Match.ACTIVE.equals(m.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "MATCH_NOT_ACTIVE", "This match isn't being played");
        }
        Long other = m.otherThan(me);
        finish(m, other, Match.FORFEIT, Instant.now());
        int gain = me.equals(m.getChallengerId()) ? m.getOpponentDelta() : m.getChallengerDelta();
        notify(other, nameOf(me) + " desistiu da partida", "A vitória é sua · " + signed(gain) + " de rating.", m);
        return toDto(m, me, false);
    }

    // ---------------------------------------------------------------- settlement

    /**
     * Brings one match up to date at {@code now}: expires an unanswered challenge,
     * settles every round whose week (plus the morning grace) is over, and finishes
     * the match at 3 round wins or after the 5th round.
     */
    @Transactional
    public void settle(Long matchId, Instant now) {
        Match m = matchRepository.findById(matchId).orElse(null);
        if (m == null) {
            return;
        }
        if (Match.PENDING.equals(m.getStatus())) {
            if (now.isAfter(m.getCreatedAt().plus(Compete.CHALLENGE_TTL))) {
                m.setStatus(Match.EXPIRED);
                m.setRespondedAt(now);
            }
            return;
        }
        while (Match.ACTIVE.equals(m.getStatus()) && m.getStartsOn() != null) {
            int n = m.getRoundsPlayed() + 1;
            LocalDate from = Compete.roundStart(m.getStartsOn(), n);
            LocalDate to = Compete.roundEnd(m.getStartsOn(), n);
            if (now.isBefore(Compete.settlesAt(to))) {
                return;
            }
            int a = trainingProof.count(m.getChallengerId(), from, to);
            int b = trainingProof.count(m.getOpponentId(), from, to);
            Long winner = a > b ? m.getChallengerId() : b > a ? m.getOpponentId() : null;
            MatchRound round = new MatchRound();
            round.setMatchId(m.getId());
            round.setRoundNo(n);
            round.setStartsOn(from);
            round.setEndsOn(to);
            round.setChallengerDays(a);
            round.setOpponentDays(b);
            round.setWinnerId(winner);
            roundRepository.save(round);

            m.setRoundsPlayed(n);
            if (m.getChallengerId().equals(winner)) {
                m.setChallengerRounds(m.getChallengerRounds() + 1);
            } else if (m.getOpponentId().equals(winner)) {
                m.setOpponentRounds(m.getOpponentRounds() + 1);
            }

            if (m.getChallengerRounds() >= Compete.ROUNDS_TO_WIN || m.getOpponentRounds() >= Compete.ROUNDS_TO_WIN) {
                finish(m, winner, Match.FIRST_TO_3, now);
                notifyFinished(m);
            } else if (n >= Compete.MAX_ROUNDS) {
                Long leader = m.getChallengerRounds() > m.getOpponentRounds() ? m.getChallengerId()
                        : m.getOpponentRounds() > m.getChallengerRounds() ? m.getOpponentId() : null;
                finish(m, leader, Match.ROUND_CAP, now);
                notifyFinished(m);
            } else {
                notifyRound(m, round);
            }
        }
    }

    private void finish(Match m, Long winnerId, String reason, Instant now) {
        Map<Long, Integer> r = ratingService.ratings(List.of(m.getChallengerId(), m.getOpponentId()));
        double score = winnerId == null ? 0.5 : winnerId.equals(m.getChallengerId()) ? 1 : 0;
        int delta = Compete.elo(r.get(m.getChallengerId()), r.get(m.getOpponentId()), score);
        m.setStatus(Match.FINISHED);
        m.setWinnerId(winnerId);
        m.setEndReason(reason);
        m.setFinishedAt(now);
        m.setChallengerDelta(delta);
        m.setOpponentDelta(-delta);
        ratingService.applyMatch(m.getId(), m.getChallengerId(), delta, m.getOpponentId(), -delta);
    }

    private void notifyRound(Match m, MatchRound round) {
        for (Long me : List.of(m.getChallengerId(), m.getOpponentId())) {
            Long other = m.otherThan(me);
            boolean challenger = me.equals(m.getChallengerId());
            int mine = challenger ? m.getChallengerRounds() : m.getOpponentRounds();
            int theirs = challenger ? m.getOpponentRounds() : m.getChallengerRounds();
            String result = round.getWinnerId() == null ? "empate"
                    : round.getWinnerId().equals(me) ? "você venceu" : nameOf(other) + " venceu";
            notify(me, "Rodada " + round.getRoundNo() + ": " + result,
                    mine + " × " + theirs + " na partida contra " + nameOf(other) + ".", m);
        }
    }

    private void notifyFinished(Match m) {
        for (Long me : List.of(m.getChallengerId(), m.getOpponentId())) {
            Long other = m.otherThan(me);
            boolean challenger = me.equals(m.getChallengerId());
            int mine = challenger ? m.getChallengerRounds() : m.getOpponentRounds();
            int theirs = challenger ? m.getOpponentRounds() : m.getChallengerRounds();
            int delta = challenger ? m.getChallengerDelta() : m.getOpponentDelta();
            String score = mine + " × " + theirs + " · " + signed(delta) + " de rating";
            if (m.getWinnerId() == null) {
                notify(me, "A partida contra " + nameOf(other) + " terminou empatada", score + ".", m);
            } else if (m.getWinnerId().equals(me)) {
                notify(me, "Você venceu a partida contra " + nameOf(other), score + ". Compartilhe o resultado.", m);
            } else {
                notify(me, nameOf(other) + " venceu a partida", score + ". Que tal uma revanche?", m);
            }
        }
    }

    // ---------------------------------------------------------------- reads

    /** A member's round in progress, from their side (for reminders). */
    public record OpenRound(String opponentFirstName, int myDays, int theirDays, LocalDate endsOn) {
    }

    /** The member's active round that ends soonest, if they're in one that has started. */
    @Transactional(readOnly = true)
    public java.util.Optional<OpenRound> currentRound(Long userId, LocalDate today) {
        OpenRound best = null;
        for (Match m : matchRepository.findForUser(userId, List.of(Match.ACTIVE), PageRequest.of(0, Compete.MAX_OPEN))) {
            if (m.getStartsOn() == null || today.isBefore(m.getStartsOn())) {
                continue;
            }
            int n = m.getRoundsPlayed() + 1;
            LocalDate from = Compete.roundStart(m.getStartsOn(), n);
            LocalDate to = Compete.roundEnd(m.getStartsOn(), n);
            if (today.isAfter(to)) {
                continue;
            }
            Long other = m.otherThan(userId);
            String name = nameOf(other).trim().split(" ")[0];
            OpenRound round = new OpenRound(name, trainingProof.count(userId, from, today),
                    trainingProof.count(other, from, today), to);
            if (best == null || round.endsOn().isBefore(best.endsOn())) {
                best = round;
            }
        }
        return java.util.Optional.ofNullable(best);
    }

    @Transactional(readOnly = true)
    public MatchDto get(Long me, Long matchId) {
        Match m = requireMatch(matchId);
        if (!m.involves(me) && !postRepository.existsByMatchId(matchId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND", "Match not found");
        }
        return toDto(m, me, true);
    }

    @Transactional(readOnly = true)
    public MatchListDto list(Long me) {
        List<MatchDto> incoming = new ArrayList<>();
        List<MatchDto> outgoing = new ArrayList<>();
        List<MatchDto> active = new ArrayList<>();
        for (Match m : matchRepository.findForUser(me, OPEN, PageRequest.of(0, 20))) {
            MatchDto dto = toDto(m, me, false);
            if (Match.ACTIVE.equals(m.getStatus())) {
                active.add(dto);
            } else if (me.equals(m.getOpponentId())) {
                incoming.add(dto);
            } else {
                outgoing.add(dto);
            }
        }
        List<MatchDto> finished = matchRepository
                .findForUser(me, List.of(Match.FINISHED), PageRequest.of(0, 10)).stream()
                .map(m -> toDto(m, me, false))
                .toList();
        return new MatchListDto(incoming, outgoing, active, finished);
    }

    @Transactional(readOnly = true)
    public VersusDto versus(Long me, Long them) {
        requirePlayer(them);
        Map<Long, PlayerDto> p = players.of(List.of(me, them));
        int[] h2h = headToHead(me, them);
        Match open = me.equals(them) ? null
                : matchRepository.findBetween(me, them, OPEN).stream().findFirst().orElse(null);
        String blocked = blockedReason(me, them);
        int rMe = p.get(me).rating();
        int rThem = p.get(them).rating();
        return new VersusDto(p.get(them), h2h[0], h2h[1], h2h[2],
                open == null ? null : toDto(open, me, false),
                blocked == null, blocked,
                Compete.elo(rMe, rThem, 1), -Compete.elo(rMe, rThem, 0));
    }

    /** Null when {@code me} may challenge {@code them} now, else the reason code. */
    String blockedReason(Long me, Long them) {
        if (me.equals(them)) {
            return "SELF";
        }
        if (!connected(me, them)) {
            return "NOT_CONNECTED";
        }
        // Silenced or blocked reads the same to the challenger as challenges turned off.
        if (!ratingService.acceptsChallenges(them) || challengeBlocks.blocks(them, me)) {
            return "DISABLED";
        }
        if (!matchRepository.findBetween(me, them, OPEN).isEmpty()) {
            return "OPEN_MATCH";
        }
        if (matchRepository.countForUser(me, OPEN) >= Compete.MAX_OPEN) {
            return "TOO_MANY_MINE";
        }
        if (matchRepository.countForUser(them, OPEN) >= Compete.MAX_OPEN) {
            return "TOO_MANY_THEIRS";
        }
        return null;
    }

    /** Members of the same gym, or who follow each other. */
    private boolean connected(Long a, Long b) {
        Long gymA = gymMemberRepository.findFirstByUserId(a).map(GymMember::getGymId).orElse(null);
        Long gymB = gymMemberRepository.findFirstByUserId(b).map(GymMember::getGymId).orElse(null);
        if (gymA != null && gymA.equals(gymB)) {
            return true;
        }
        return followRepository.existsByFollowerIdAndFollowingId(a, b)
                && followRepository.existsByFollowerIdAndFollowingId(b, a);
    }

    /** Finished matches between a and b: {a's wins, b's wins, draws}. */
    int[] headToHead(Long a, Long b) {
        int[] out = new int[3];
        jdbc.query("""
                SELECT winner_id, COUNT(*) FROM matches
                WHERE status = 'FINISHED'
                  AND ((challenger_id = ? AND opponent_id = ?) OR (challenger_id = ? AND opponent_id = ?))
                GROUP BY winner_id
                """, rs -> {
            long winner = rs.getLong(1);
            boolean draw = rs.wasNull();
            int n = rs.getInt(2);
            if (draw) {
                out[2] += n;
            } else if (winner == a) {
                out[0] += n;
            } else if (winner == b) {
                out[1] += n;
            }
        }, a, b, b, a);
        return out;
    }

    MatchDto toDto(Match m, Long viewer, boolean detail) {
        Long c = m.getChallengerId();
        Long o = m.getOpponentId();
        Map<Long, PlayerDto> p = players.of(List.of(c, o));
        LocalDate today = Compete.today(Instant.now());

        List<RoundDto> rounds = roundRepository.findAllByMatchIdOrderByRoundNoAsc(m.getId()).stream()
                .map(r -> new RoundDto(r.getRoundNo(), r.getStartsOn(), r.getEndsOn(), r.getChallengerDays(),
                        r.getOpponentDays(), r.getWinnerId()))
                .toList();

        CurrentRoundDto current = null;
        if (Match.ACTIVE.equals(m.getStatus()) && m.getStartsOn() != null) {
            int n = m.getRoundsPlayed() + 1;
            LocalDate from = Compete.roundStart(m.getStartsOn(), n);
            LocalDate to = Compete.roundEnd(m.getStartsOn(), n);
            LocalDate upTo = today.isBefore(to) ? today : to;
            List<LocalDate> cd = trainingProof.days(c, from, upTo).stream().map(TrainingProof.ProvenDay::date).toList();
            List<LocalDate> od = trainingProof.days(o, from, upTo).stream().map(TrainingProof.ProvenDay::date).toList();
            current = new CurrentRoundDto(n, from, to, Compete.settlesAt(to), cd.size(), od.size(), cd, od);
        }

        StakeDto stake = null;
        if (OPEN.contains(m.getStatus())) {
            int rc = p.get(c).rating();
            int ro = p.get(o).rating();
            stake = new StakeDto(Compete.elo(rc, ro, 1), Compete.elo(ro, rc, 1));
        }
        int[] h2h = headToHead(c, o);

        List<ProofDto> timeline = null;
        if (detail && m.getStartsOn() != null) {
            LocalDate end = m.getFinishedAt() != null
                    ? Compete.roundEnd(m.getStartsOn(), Math.max(1, m.getRoundsPlayed()))
                    : today;
            if (m.getFinishedAt() != null && Compete.today(m.getFinishedAt()).isBefore(end)) {
                end = Compete.today(m.getFinishedAt());
            }
            List<ProofDto> items = new ArrayList<>();
            for (Long id : List.of(c, o)) {
                for (TrainingProof.ProvenDay d : trainingProof.days(id, m.getStartsOn(), end)) {
                    items.add(new ProofDto(id, d.date(), d.gym(),
                            d.photoKey() == null ? null : mediaStorage.urlFor(d.photoKey())));
                }
            }
            items.sort(Comparator.comparing(ProofDto::date).reversed());
            timeline = items.size() > 30 ? items.subList(0, 30) : items;
        }

        String role = c.equals(viewer) ? "CHALLENGER" : o.equals(viewer) ? "OPPONENT" : null;
        boolean postedByMe = viewer != null && Match.FINISHED.equals(m.getStatus())
                && postRepository.findByMatchIdAndUserId(m.getId(), viewer).isPresent();
        Instant expiresAt = Match.PENDING.equals(m.getStatus()) ? m.getCreatedAt().plus(Compete.CHALLENGE_TTL) : null;

        return new MatchDto(m.getId(), m.getStatus(), role, p.get(c), p.get(o), m.getStartsOn(),
                m.getChallengerRounds(), m.getOpponentRounds(), m.getRoundsPlayed(), m.getWinnerId(),
                m.getEndReason(), m.getChallengerDelta(), m.getOpponentDelta(), m.getCreatedAt(), expiresAt,
                m.getFinishedAt(), rounds, current, stake, new HeadToHeadDto(h2h[0], h2h[1], h2h[2]), timeline,
                postedByMe);
    }

    // ---------------------------------------------------------------- helpers

    Match requireMatch(Long matchId) {
        return matchRepository.findById(matchId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND", "Match not found"));
    }

    /** A member who can play: exists and has their own login (not a child profile the gym manages). */
    private User requirePlayer(Long userId) {
        User u = userRepository.findById(userId).orElse(null);
        if (u == null || Boolean.TRUE.equals(u.getManaged())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");
        }
        return u;
    }

    private String nameOf(Long userId) {
        return userRepository.findById(userId).map(User::getDisplayName).filter(Objects::nonNull).orElse("Alguém");
    }

    private void notify(Long userId, String title, String body, Match m) {
        notificationService.notify(userId, NotificationType.TRAINING, title, body, "match:" + m.getId());
    }

    private static String signed(int n) {
        return n >= 0 ? "+" + n : String.valueOf(n);
    }
}
