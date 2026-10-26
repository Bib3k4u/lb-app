package com.limitbeyond.insights.internal;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class InsightsServiceTest {

    @AfterEach
    void clearAuthContext() {
        AuthContextHolder.clear();
    }

    @Test
    void platformOperatorCannotUseGymDashboardSurface() {
        AuthContextHolder.set(AuthContext.superAdmin(UUID.randomUUID()));
        InsightsService service = new InsightsService(mock(InsightsRepository.class));

        assertThrows(DomainException.class, () -> service.dashboard(null, null, null, null));
    }
}
