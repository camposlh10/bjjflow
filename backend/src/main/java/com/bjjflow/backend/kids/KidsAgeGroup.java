package com.bjjflow.backend.kids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An age band of the kids program, e.g. "Pequenos" 4 to 6. */
@Entity
@Table(name = "kids_age_groups")
@Getter
@Setter
@NoArgsConstructor
public class KidsAgeGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    private String name;

    @Column(name = "min_age")
    private Integer minAge;

    @Column(name = "max_age")
    private Integer maxAge;

    private Integer position;

    public boolean contains(int age) {
        return age >= minAge && age <= maxAge;
    }
}
