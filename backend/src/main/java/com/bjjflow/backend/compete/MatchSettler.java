package com.bjjflow.backend.compete;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.bjjflow.backend.jobs.SchedulerLocks;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Settles rounds and expires challenges: every 10 minutes for everyone (so the
 * notifications go out), and on demand for one member before their matches are
 * shown. Each match settles in its own transaction; when two settlements race,
 * the loser's work is rolled back and the winner's stands.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchSettler {

    private final MatchService matchService;
    private final MatchRepository matchRepository;
    private final SchedulerLocks schedulerLocks;

    @Scheduled(cron = "0 */10 * * * *")
    public void run() {
        if (!schedulerLocks.tryLock("matches-settle", Duration.ofMinutes(8))) {
            return;
        }
        settleAll(Instant.now());
    }

    public void settleAll(Instant now) {
        for (Long id : matchRepository.findIdsByStatusIn(MatchService.OPEN)) {
            settleQuietly(id, now);
        }
    }

    public void settleFor(Long userId, Instant now) {
        List<Match> open = matchRepository.findForUser(userId, MatchService.OPEN, Pageable.unpaged());
        for (Match m : open) {
            settleQuietly(m.getId(), now);
        }
    }

    public void settleQuietly(Long matchId, Instant now) {
        try {
            matchService.settle(matchId, now);
        } catch (OptimisticLockingFailureException | DataIntegrityViolationException raced) {
            log.debug("Match {} was settled concurrently", matchId);
        } catch (RuntimeException e) {
            log.warn("Could not settle match {}", matchId, e);
        }
    }
}
