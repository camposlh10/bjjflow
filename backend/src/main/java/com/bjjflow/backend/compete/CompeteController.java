package com.bjjflow.backend.compete;

import java.time.Instant;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.compete.CompeteDtos.ChallengeRequest;
import com.bjjflow.backend.compete.CompeteDtos.MatchDto;
import com.bjjflow.backend.compete.CompeteDtos.MatchListDto;
import com.bjjflow.backend.compete.CompeteDtos.MatchPostDto;
import com.bjjflow.backend.compete.CompeteDtos.MyRatingDto;
import com.bjjflow.backend.compete.CompeteDtos.PostRequest;
import com.bjjflow.backend.compete.CompeteDtos.RankingDto;
import com.bjjflow.backend.compete.CompeteDtos.SettingsRequest;
import com.bjjflow.backend.compete.CompeteDtos.VersusDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Rating, rankings, matches and match posts. */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CompeteController {

    private final RankingService rankingService;
    private final RatingService ratingService;
    private final MatchService matchService;
    private final MatchSettler matchSettler;
    private final MatchPostService matchPostService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping("/compete/me")
    public MyRatingDto me(Authentication auth) {
        return rankingService.me(userId(auth));
    }

    @PutMapping("/compete/me/settings")
    public MyRatingDto settings(Authentication auth, @Valid @RequestBody SettingsRequest request) {
        ratingService.setAcceptsChallenges(userId(auth), request.acceptsChallenges());
        return rankingService.me(userId(auth));
    }

    @GetMapping("/compete/ranking")
    public RankingDto ranking(Authentication auth, @RequestParam(defaultValue = "gym") String scope) {
        return rankingService.ranking(userId(auth), scope);
    }

    @GetMapping("/compete/vs/{userId}")
    public VersusDto versus(Authentication auth, @PathVariable Long userId) {
        matchSettler.settleFor(userId(auth), Instant.now());
        return matchService.versus(userId(auth), userId);
    }

    @GetMapping("/matches")
    public MatchListDto matches(Authentication auth) {
        matchSettler.settleFor(userId(auth), Instant.now());
        return matchService.list(userId(auth));
    }

    @PostMapping("/matches")
    public MatchDto challenge(Authentication auth, @Valid @RequestBody ChallengeRequest request) {
        return matchService.challenge(userId(auth), request.opponentId());
    }

    @GetMapping("/matches/{id}")
    public MatchDto match(Authentication auth, @PathVariable Long id) {
        matchSettler.settleQuietly(id, Instant.now());
        return matchService.get(userId(auth), id);
    }

    @PostMapping("/matches/{id}/accept")
    public MatchDto accept(Authentication auth, @PathVariable Long id) {
        return matchService.accept(userId(auth), id);
    }

    @PostMapping("/matches/{id}/decline")
    public MatchDto decline(Authentication auth, @PathVariable Long id) {
        return matchService.decline(userId(auth), id);
    }

    @PostMapping("/matches/{id}/silence")
    public MatchDto silence(Authentication auth, @PathVariable Long id) {
        return matchService.silence(userId(auth), id);
    }

    @PostMapping("/matches/{id}/block")
    public MatchDto block(Authentication auth, @PathVariable Long id) {
        return matchService.block(userId(auth), id);
    }

    @GetMapping("/compete/blocks")
    public List<CompeteDtos.BlockDto> blocks(Authentication auth) {
        return matchService.blocks(userId(auth));
    }

    @DeleteMapping("/compete/blocks/{userId}")
    public ResponseEntity<Void> unblock(Authentication auth, @PathVariable Long userId) {
        matchService.unblock(userId(auth), userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/matches/{id}/cancel")
    public MatchDto cancel(Authentication auth, @PathVariable Long id) {
        return matchService.cancel(userId(auth), id);
    }

    @PostMapping("/matches/{id}/forfeit")
    public MatchDto forfeit(Authentication auth, @PathVariable Long id) {
        return matchService.forfeit(userId(auth), id);
    }

    @PostMapping("/matches/{id}/post")
    public MatchPostDto post(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody(required = false) PostRequest request) {
        return matchPostService.post(userId(auth), id, request == null ? null : request.caption());
    }

    @GetMapping("/match-posts")
    public List<MatchPostDto> posts(Authentication auth, @RequestParam(defaultValue = "following") String scope) {
        return matchPostService.feed(userId(auth), scope);
    }

    @PostMapping("/match-posts/{id}/repost")
    public MatchPostDto repost(Authentication auth, @PathVariable Long id) {
        return matchPostService.repost(userId(auth), id);
    }

    @DeleteMapping("/match-posts/{id}")
    public ResponseEntity<Void> deletePost(Authentication auth, @PathVariable Long id) {
        matchPostService.delete(userId(auth), id);
        return ResponseEntity.noContent().build();
    }
}
