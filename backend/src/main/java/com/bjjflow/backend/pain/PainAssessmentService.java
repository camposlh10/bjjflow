package com.bjjflow.backend.pain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.pain.PainAssessmentDtos.AreaDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.AreaInput;
import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentSummaryDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.CreateAssessmentRequest;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PainAssessmentService {

    private final PainAssessmentRepository assessmentRepository;
    private final PainAssessmentAreaRepository areaRepository;

    @Transactional
    public AssessmentDto create(Long userId, CreateAssessmentRequest req) {
        PainAssessment a = new PainAssessment();
        a.setUserId(userId);
        a.setAssessedOn(LocalDate.now());
        a.setOnsetDate(req.onsetDate());
        a.setTrend(blankToNull(req.trend()));
        a.setFrequency(blankToNull(req.frequency()));
        a.setRelieves(blankToNull(req.relieves()));
        a.setWorsens(blankToNull(req.worsens()));
        a.setNotes(blankToNull(req.notes()));
        assessmentRepository.save(a);

        List<PainAssessmentArea> areas = new ArrayList<>();
        for (AreaInput in : req.areas()) {
            PainAssessmentArea area = new PainAssessmentArea();
            area.setAssessmentId(a.getId());
            area.setRegion(in.region().trim().toLowerCase(Locale.ROOT));
            area.setPainType(blankToNull(in.painType()));
            area.setIntensity(in.intensity());
            area.setNote(blankToNull(in.note()));
            areas.add(area);
        }
        areaRepository.saveAll(areas);
        return toDto(a, areas);
    }

    @Transactional(readOnly = true)
    public List<AssessmentSummaryDto> list(Long userId, Integer limit) {
        int size = (limit == null || limit < 1 || limit > 100) ? 50 : limit;
        List<PainAssessment> assessments = assessmentRepository
                .findByUserIdOrderByAssessedOnDescIdDesc(userId, PageRequest.of(0, size));
        if (assessments.isEmpty()) {
            return List.of();
        }
        List<Long> ids = assessments.stream().map(PainAssessment::getId).toList();
        Map<Long, List<PainAssessmentArea>> byAssessment = areaRepository.findByAssessmentIdIn(ids).stream()
                .collect(Collectors.groupingBy(PainAssessmentArea::getAssessmentId));
        return assessments.stream()
                .map(a -> {
                    List<PainAssessmentArea> areas = byAssessment.getOrDefault(a.getId(), List.of());
                    return new AssessmentSummaryDto(a.getId(), a.getAssessedOn(), areas.size(),
                            avg(areas), a.getTrend(), predominant(areas));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public AssessmentDto get(Long userId, Long id) {
        PainAssessment a = assessmentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "Assessment not found"));
        return toDto(a, areaRepository.findByAssessmentIdOrderByIntensityDesc(id));
    }

    /** Most recent assessment (for prefilling "Copiar última" / showing the current map); null if none. */
    @Transactional(readOnly = true)
    public AssessmentDto latest(Long userId) {
        return assessmentRepository.findFirstByUserIdOrderByAssessedOnDescIdDesc(userId)
                .map(a -> toDto(a, areaRepository.findByAssessmentIdOrderByIntensityDesc(a.getId())))
                .orElse(null);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        PainAssessment a = assessmentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "Assessment not found"));
        areaRepository.deleteByAssessmentId(a.getId());
        assessmentRepository.delete(a);
    }

    private AssessmentDto toDto(PainAssessment a, List<PainAssessmentArea> areas) {
        List<AreaDto> areaDtos = areas.stream()
                .sorted(Comparator.comparingInt(PainAssessmentService::intensityOf).reversed())
                .map(x -> new AreaDto(x.getRegion(), x.getPainType(), intensityOf(x), x.getNote()))
                .toList();
        return new AssessmentDto(a.getId(), a.getAssessedOn(), a.getOnsetDate(), a.getTrend(), a.getFrequency(),
                a.getRelieves(), a.getWorsens(), a.getNotes(), areaDtos, avg(areas), predominant(areas));
    }

    private static int intensityOf(PainAssessmentArea x) {
        return x.getIntensity() == null ? 0 : x.getIntensity();
    }

    /** Mean area intensity, rounded to one decimal. */
    private double avg(List<PainAssessmentArea> areas) {
        if (areas.isEmpty()) {
            return 0;
        }
        double sum = areas.stream().mapToInt(PainAssessmentService::intensityOf).sum();
        return Math.round(sum / areas.size() * 10.0) / 10.0;
    }

    /** The pain type assigned to the most areas (ties broken arbitrarily); null if none typed. */
    private String predominant(List<PainAssessmentArea> areas) {
        return areas.stream()
                .map(PainAssessmentArea::getPainType)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(t -> t, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
