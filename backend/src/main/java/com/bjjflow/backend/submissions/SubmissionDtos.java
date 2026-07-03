package com.bjjflow.backend.submissions;

import java.util.List;

public class SubmissionDtos {

    public record SubmissionCountDto(String submission, long count, double percentage) {
    }

    public record SubmissionStatsDto(String direction, String month, long total, List<SubmissionCountDto> items) {
    }
}
