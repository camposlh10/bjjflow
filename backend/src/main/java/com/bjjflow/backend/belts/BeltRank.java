package com.bjjflow.backend.belts;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "belt_ranks")
@Getter
@Setter
@NoArgsConstructor
public class BeltRank {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "belt_system_id")
    private BeltSystem beltSystem;

    private String slug;

    private String name;

    @Column(name = "name_pt")
    private String namePt;

    @Column(name = "color_hex")
    private String colorHex;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "max_stripes")
    private Integer maxStripes;
}
