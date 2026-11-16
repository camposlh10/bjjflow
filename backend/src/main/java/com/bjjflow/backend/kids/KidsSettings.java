package com.bjjflow.backend.kids;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The owner's rules for the gym's kids program. */
@Entity
@Table(name = "gym_kids_settings")
@Getter
@Setter
@NoArgsConstructor
public class KidsSettings {

    public static final String POLICY_WARN = "WARN";
    public static final String POLICY_BLOCK = "BLOCK";

    @Id
    @Column(name = "gym_id")
    private Long gymId;

    /** Children must be checked out by a guardian or an authorised person. */
    @Column(name = "checkout_required")
    private Boolean checkoutRequired;

    /** Only guardians and people on the pickup list may collect a child. */
    @Column(name = "pickup_list_only")
    private Boolean pickupListOnly;

    @Column(name = "late_pickup_minutes")
    private Integer latePickupMinutes;

    /** WARN: the child trains and staff see a warning. BLOCK: not until documents are in. */
    @Column(name = "missing_documents_policy")
    private String missingDocumentsPolicy;

    /** Students this age or older are adults for the program. */
    @Column(name = "adult_age")
    private Integer adultAge;

    @Column(name = "updated_by_user_id")
    private Long updatedByUserId;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
