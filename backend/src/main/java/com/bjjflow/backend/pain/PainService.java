package com.bjjflow.backend.pain;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.pain.PainDtos.LogPainRequest;
import com.bjjflow.backend.pain.PainDtos.MonthlyRegionDto;
import com.bjjflow.backend.pain.PainDtos.PainEntryDto;
import com.bjjflow.backend.pain.PainDtos.PainHistoryDto;
import com.bjjflow.backend.pain.PainDtos.PainMapDto;
import com.bjjflow.backend.pain.PainDtos.PainMonthlyDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PainService {

    /** A region drops off the map after this many days with no new reading. */
    private static final int WINDOW_DAYS = 21;

    private final PainLogRepository painLogRepository;

    @Transactional
    public PainMapDto log(Long userId, LogPainRequest req) {
        PainLog entry = new PainLog();
        entry.setUserId(userId);
        entry.setRegion(req.region().trim().toLowerCase(Locale.ROOT));
        entry.setIntensity(req.intensity());
        entry.setNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());
        entry.setOccurredAt(LocalDate.now());
        painLogRepository.save(entry);
        return currentMap(userId);
    }

    /** Latest reading per region within the window; intensity 0 means healed, so it's dropped. */
    @Transactional(readOnly = true)
    public PainMapDto currentMap(Long userId) {
        List<PainLog> recent = painLogRepository
                .findByUserIdAndOccurredAtAfterOrderByOccurredAtDescCreatedAtDesc(
                        userId, LocalDate.now().minusDays(WINDOW_DAYS));
        Map<String, PainLog> latest = new LinkedHashMap<>();
        for (PainLog p : recent) {
            latest.putIfAbsent(p.getRegion(), p); // newest-first, so first seen wins
        }
        List<PainEntryDto> regions = latest.values().stream()
                .filter(p -> p.getIntensity() != null && p.getIntensity() > 0)
                .map(p -> new PainEntryDto(p.getRegion(), p.getIntensity(), p.getNote(), p.getOccurredAt()))
                .sorted(Comparator.comparingInt(PainEntryDto::intensity).reversed())
                .toList();
        return new PainMapDto(regions);
    }

    /** A single day's pain (latest reading per region that day). */
    @Transactional(readOnly = true)
    public PainMapDto daily(Long userId, String dateStr) {
        LocalDate date = parseDate(dateStr);
        Map<String, PainLog> latest = new LinkedHashMap<>();
        for (PainLog p : painLogRepository.findByUserIdAndOccurredAtOrderByCreatedAtDesc(userId, date)) {
            latest.putIfAbsent(p.getRegion(), p);
        }
        List<PainEntryDto> regions = latest.values().stream()
                .filter(p -> p.getIntensity() != null && p.getIntensity() > 0)
                .map(p -> new PainEntryDto(p.getRegion(), p.getIntensity(), p.getNote(), p.getOccurredAt()))
                .sorted(Comparator.comparingInt(PainEntryDto::intensity).reversed())
                .toList();
        return new PainMapDto(regions);
    }

    /** A month's aggregate per region: peak intensity + number of days it hurt — the "bigger picture". */
    @Transactional(readOnly = true)
    public PainMonthlyDto monthly(Long userId, String monthStr) {
        YearMonth ym = parseMonth(monthStr);
        Map<String, Integer> maxByRegion = new LinkedHashMap<>();
        Map<String, Set<LocalDate>> daysByRegion = new HashMap<>();
        for (PainLog p : painLogRepository.findByUserIdAndOccurredAtBetween(userId, ym.atDay(1), ym.atEndOfMonth())) {
            if (p.getIntensity() == null || p.getIntensity() <= 0) {
                continue;
            }
            maxByRegion.merge(p.getRegion(), p.getIntensity(), Math::max);
            daysByRegion.computeIfAbsent(p.getRegion(), k -> new HashSet<>()).add(p.getOccurredAt());
        }
        List<MonthlyRegionDto> regions = maxByRegion.entrySet().stream()
                .map(e -> new MonthlyRegionDto(e.getKey(), e.getValue(), daysByRegion.get(e.getKey()).size()))
                .sorted(Comparator.comparingInt(MonthlyRegionDto::intensity).reversed())
                .toList();
        return new PainMonthlyDto(ym.toString(), regions);
    }

    @Transactional(readOnly = true)
    public List<PainHistoryDto> history(Long userId, Integer limit) {
        int size = (limit == null || limit < 1 || limit > 100) ? 30 : limit;
        List<PainHistoryDto> out = new ArrayList<>();
        for (PainLog p : painLogRepository.findByUserIdOrderByOccurredAtDescCreatedAtDesc(userId, PageRequest.of(0, size))) {
            out.add(new PainHistoryDto(p.getId(), p.getRegion(), p.getIntensity(), p.getNote(), p.getOccurredAt()));
        }
        return out;
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(s.trim());
        } catch (RuntimeException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE", "Date must be YYYY-MM-DD");
        }
    }

    private YearMonth parseMonth(String s) {
        if (s == null || s.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(s.trim());
        } catch (RuntimeException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MONTH", "Month must be YYYY-MM");
        }
    }
}
