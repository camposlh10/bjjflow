package com.bjjflow.backend.submissions;

import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.submissions.SubmissionDtos.SubmissionCountDto;
import com.bjjflow.backend.submissions.SubmissionDtos.SubmissionStatsDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SubmissionLogRepository submissionLogRepository;

    @Transactional(readOnly = true)
    public SubmissionStatsDto stats(Long userId, String month, String direction) {
        YearMonth ym = parseMonth(month);
        String dir = (direction == null || direction.isBlank()) ? "HIT" : direction.trim().toUpperCase();
        if (!dir.equals("HIT") && !dir.equals("CONCEDED")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DIRECTION", "Direction must be HIT or CONCEDED");
        }

        List<Object[]> rows = submissionLogRepository.aggregate(userId, dir, ym.atDay(1), ym.atEndOfMonth());
        long total = rows.stream().mapToLong(r -> ((Number) r[1]).longValue()).sum();

        List<SubmissionCountDto> items = rows.stream()
                .map(r -> {
                    long c = ((Number) r[1]).longValue();
                    double pct = total == 0 ? 0 : Math.round(c * 1000.0 / total) / 10.0;
                    return new SubmissionCountDto((String) r[0], c, pct);
                })
                .sorted(Comparator.comparingLong(SubmissionCountDto::count).reversed())
                .toList();

        return new SubmissionStatsDto(dir, ym.toString(), total, items);
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(month.trim());
        } catch (RuntimeException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MONTH", "Month must be YYYY-MM");
        }
    }
}
