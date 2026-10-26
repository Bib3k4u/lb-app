/**
 * Dashboards and reports scoped by location, member activity and performance,
 * trainer utilisation, attendance, exports, churn worklists, AI generation
 * with human approval. LB-SRS M16/M18.
 *
 * Type.OPEN, not the strict-encapsulation default: Modulith only treats a module's ROOT package as its public API by default, requiring @NamedInterface on any sub-package (like this module's own api/) meant to be exposed too. Getting that scheme right for all eleven modules is real, worthwhile follow-up work (LB-ENG-1.0's aspirational api/-only-is-public rule), not done in this pass. What DOES already enforce the layering that matters most — web/internal/domain boundaries, entities never crossing into web — is ArchitectureRulesTest, independent of Modulith's own visibility model. This annotation only turns off Modulith's EXTRA restriction so ModularityTest can still do the one thing ArchUnit does not: catch a genuine cycle between modules.
 */
@org.springframework.modulith.ApplicationModule(
        displayName = "insights",
        type = org.springframework.modulith.ApplicationModule.Type.OPEN)
package com.limitbeyond.insights;
