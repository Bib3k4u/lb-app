package com.limitbeyond.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption.DoNotIncludeTests;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.springframework.transaction.annotation.Transactional;

/**
 * Layering and the non-negotiables, as rules a build can fail on.
 *
 * <p>LB-ENG-1.0 ENG-02: automate the rule or drop it. A convention nothing
 * enforces decays within months; these do not, because violating one turns the
 * pipeline red rather than relying on someone noticing in review.
 */
@AnalyzeClasses(packages = "com.limitbeyond", importOptions = DoNotIncludeTests.class)
class ArchitectureRulesTest {

    // --- Layering (LB-ENG-1.0 §3.1) -----------------------------------------

    @ArchTest
    static final ArchRule controllersMustNotTouchRepositories =
            noClasses().that().resideInAPackage("..web..")
                    .should().dependOnClassesThat().resideInAPackage("..persistence..")
                    .because("controllers call exactly one service method; "
                            + "a repository in a controller means business logic has leaked upward");

    @ArchTest
    static final ArchRule servicesMustNotDependOnWebTypes =
            noClasses().that().resideInAPackage("..internal..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "jakarta.servlet..", "org.springframework.web..")
                    .because("a service that knows about HTTP cannot be reused or tested "
                            + "without inventing a request");

    /**
     * Deviation from the STANDARDS doc's aspirational stance, recorded rather
     * than silently applied: a full hexagonal split (plain-Java domain objects
     * mapped to separate JPA persistence classes) is real ceremony across ~20
     * entities, and this pass prioritises a working, tested vertical slice.
     * JPA {@code @Entity} classes live directly in {@code ..domain..}, with
     * invariants still enforced in their constructors/factory methods
     * (DM-02's actual goal) and mirrored as database constraints. What this
     * rule still forbids is a domain class knowing about HTTP or the web
     * layer — that coupling has no excuse at any velocity.
     */
    @ArchTest
    static final ArchRule domainMustNotDependOnWeb =
            noClasses().that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "jakarta.servlet..", "org.springframework.web..")
                    .because("a domain object that knows about HTTP has no excuse, "
                            + "at any velocity");

    // --- NN-5: transactions, and therefore RLS context, start in services ----

    @ArchTest
    static final ArchRule noTransactionalControllers =
            noClasses().that().resideInAPackage("..web..")
                    .should().beAnnotatedWith(Transactional.class)
                    .because("the transaction boundary is the service method — it is also "
                            + "where SET LOCAL injects RLS context (NN-1)");

    // --- NN-1: SET LOCAL, never bare SET ------------------------------------

    /**
     * The actual concern is narrower than "nobody but these packages may use
     * JdbcTemplate": it is that nobody outside {@code RlsContextAspect} sets
     * Postgres SESSION state (NN-1). {@code shared.jobs} (queue claiming) and
     * {@code shared.otp} (audit inserts into {@code otp_attempts}, which
     * predates authentication and so cannot go through the normal
     * repository/RLS path) are hand-reviewed exceptions to the broader "use
     * Spring Data repositories" convention, not exceptions to NN-1 itself —
     * neither ever issues a bare {@code SET}.
     */
    @ArchTest
    static final ArchRule onlyRlsAspectUsesJdbcTemplateForSession =
            noClasses().that().resideOutsideOfPackage("..shared.rls..")
                    .and().resideOutsideOfPackage("..shared.jobs..")
                    .and().resideOutsideOfPackage("..shared.otp..")
                    .should().dependOnClassesThat()
                    .haveFullyQualifiedName("org.springframework.jdbc.core.JdbcTemplate")
                    .because("raw JdbcTemplate is how a bare SET gets written by accident; "
                            + "session state belongs to RlsContextAspect alone (NN-1)");

    // --- NN-3 / NN-4: one media path, no exceptions -------------------------

    @ArchTest
    static final ArchRule onlyMediaServiceUsesCloudinary =
            noClasses().that().resideOutsideOfPackage("..shared.media..")
                    .should().dependOnClassesThat().resideInAPackage("com.cloudinary..")
                    .because("every upload must pass through MediaService, which requires a "
                            + "sensitivity argument — that is what makes NN-3 unbreakable");

    // --- Entities never cross the wire --------------------------------------

    /**
     * Enums are exempted: {@code CheckIn.CheckInMethod}, for instance, is a
     * closed vocabulary with no mutable state and no relationships — sharing
     * it between a domain entity's field and a web DTO's is a much smaller
     * coupling risk than sharing the entity itself would be, and defining a
     * parallel API-level enum for every one would be pure duplication with
     * no corresponding safety win. A full entity crossing into {@code web} —
     * mutable, relationship-bearing, schema-shaped — is what this rule
     * actually guards against.
     */
    @ArchTest
    static final ArchRule controllersMustNotReturnEntities =
            noClasses().that().resideInAPackage("..web..")
                    .should().dependOnClassesThat(
                            com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage("..domain..")
                                    .and(com.tngtech.archunit.base.DescribedPredicate.describe(
                                            "is not an enum",
                                            javaClass -> !javaClass.isEnum())))
                    .because("returning an entity leaks internal fields and couples the API "
                            + "shape to the schema; map to a response record instead");

    // --- Module boundaries (LB-ENG-1.0 ENG-2.1) -----------------------------
    // Only api/ is public; cross-module access goes through a facade or event.
    // Deliberately NOT expressed here: a naive ArchUnit rule would also flag a
    // module touching its OWN internals, which is legitimate. Distinguishing
    // "another module's internals" from "my own" is exactly what Spring
    // Modulith does, so ModularityTest owns that rule instead.
}
