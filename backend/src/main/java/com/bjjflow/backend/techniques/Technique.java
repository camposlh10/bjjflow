package com.bjjflow.backend.techniques;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A curated technique in the public library, browsable by category. */
@Entity
@Table(name = "techniques")
@Getter
@Setter
@NoArgsConstructor
public class Technique {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String slug;

    /** GUARD, PASSING, SUBMISSION, SWEEP, ESCAPE, TAKEDOWN, CONTROL */
    private String category;

    @Column(name = "name_pt")
    private String namePt;

    @Column(name = "position_pt")
    private String positionPt;

    @Column(name = "description_pt")
    private String descriptionPt;

    /** FUNDAMENTAL, INTERMEDIATE, ADVANCED */
    private String difficulty;

    @Column(name = "belt_slug")
    private String beltSlug;

    @Column(name = "video_url")
    private String videoUrl;

    @Column(name = "sort_order")
    private Integer sortOrder;
}
