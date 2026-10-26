package com.limitbeyond.architecture;

import com.limitbeyond.LimitbeyondApplication;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

/**
 * Spring Modulith's own structural verification — mainly catches
 * inter-module cycles, which {@link ArchitectureRulesTest}'s hand-written
 * rules do not check for.
 *
 * <p>Run in the DEFAULT (open) visibility mode: every package within a
 * module is reachable from any other module, not just its {@code api/}
 * package. Enforcing {@code api/}-only visibility strictly would need each
 * module's {@code package-info.java} marked
 * {@code @ApplicationModule(type = Type.CLOSED)} plus
 * {@code @NamedInterface("api")} on the public packages — real, worthwhile
 * follow-up work, not done in this pass. {@link ArchitectureRulesTest}
 * already enforces the specific layering rules (web/internal/domain) that
 * matter most; this test adds cycle detection on top of that, which neither
 * ArchUnit rule above catches.
 */
class ModularityTest {

    @Test
    void modulesHaveNoCycles() {
        ApplicationModules.of(LimitbeyondApplication.class).verify();
    }
}
