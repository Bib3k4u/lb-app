package com.limitbeyond.org.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.limitbeyond.org.domain.Location.LocationState;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LocationTest {

    @Test
    void laterLocationRequiresApproval() {
        Location location = location();

        assertThat(location.getApprovalState()).isEqualTo(LocationState.PENDING_REVIEW);

        location.review(true, UUID.randomUUID(), null);

        assertThat(location.getApprovalState()).isEqualTo(LocationState.APPROVED);
        assertThat(location.getRejectionReason()).isNull();
    }

    @Test
    void editingRejectedLocationResubmitsItForReview() {
        Location location = location();
        location.review(false, UUID.randomUUID(), "Address could not be verified");

        location.update("indiranagar", "Indiranagar", "12 Main Road", null,
                "Bengaluru", "Karnataka", "560038", 12.9784, 77.6408, "+918088620079");

        assertThat(location.getApprovalState()).isEqualTo(LocationState.PENDING_REVIEW);
        assertThat(location.getRejectionReason()).isNull();
    }

    @Test
    void deletingLocationSoftClosesIt() {
        Location location = location();

        location.close();

        assertThat(location.isClosed()).isTrue();
    }

    private Location location() {
        return new Location(UUID.randomUUID(), "indiranagar", "Indiranagar", "10 Main Road", null,
                "Bengaluru", "Karnataka", "560038", 12.9784, 77.6408, "+918088620079");
    }
}
