/**
 * Exercise catalogue, workout templates and routines, set logging, personal records, nutrition, progress — and the personal fitness profile EVERY account holds. LB-SRS M10-M13/M21.
 *
 * <p><strong>This module serves every role, not only members.</strong> That is
 * FR-PFP-01 expressed structurally: no method here accepts a role as a
 * parameter or branches on one. A Gym Owner logging their own sets travels the
 * identical code path a member does. If a role check ever appears in this
 * module, the dual-facet model has been broken.
 *
 * <p>Type.OPEN, not the strict-encapsulation default: Modulith only treats a
 * module's ROOT package as its public API by default, requiring
 * {@code @NamedInterface} on any sub-package (like this module's own api/)
 * meant to be exposed too. Getting that scheme right for all eleven modules
 * is real, worthwhile follow-up work (LB-ENG-1.0's aspirational
 * api/-only-is-public rule), not done in this pass. What DOES already
 * enforce the layering that matters most — web/internal/domain boundaries,
 * entities never crossing into web — is {@code ArchitectureRulesTest},
 * independent of Modulith's own visibility model. This annotation only
 * turns off Modulith's EXTRA restriction so {@code ModularityTest} can still
 * do the one thing ArchUnit does not: catch a genuine cycle between modules.
 */
@org.springframework.modulith.ApplicationModule(
        displayName = "training",
        type = org.springframework.modulith.ApplicationModule.Type.OPEN)
package com.limitbeyond.training;
