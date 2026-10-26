package com.limitbeyond.platform.internal;

import com.limitbeyond.identity.api.RoleGrantFacade;
import com.limitbeyond.identity.api.UserFacade;
import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.platform.domain.Gym;
import com.limitbeyond.platform.domain.GymSubscription;
import com.limitbeyond.platform.domain.SubscriptionOffering;
import com.limitbeyond.platform.domain.SubscriptionPayment;
import com.limitbeyond.platform.persistence.GymRepository;
import com.limitbeyond.platform.persistence.GymSubscriptionRepository;
import com.limitbeyond.platform.persistence.SubscriptionOfferingRepository;
import com.limitbeyond.platform.persistence.SubscriptionPaymentRepository;
import com.limitbeyond.platform.web.PlatformDtos;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import com.limitbeyond.shared.rls.RlsContext;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The gym lifecycle: register → verify → activate. LB-SRS-1.1 M20.
 *
 * <p>Verification and activation are deliberately separate (FR-SUB-03) and
 * this class enforces that ordering as state-machine transitions on
 * {@link Gym} itself, not merely as a convention callers are expected to
 * follow.
 */
@Service
public class PlatformService {

    private static final int GRACE_DAYS = 14;

    // A single "Standard Annual" offering, created lazily the first time
    // anyone activates a gym — there is no offering-management UI yet, and
    // building one is a separate piece of work from letting the Super Admin
    // actually complete an activation today.
    private static final String DEFAULT_OFFERING_NAME = "Standard Annual";
    private static final int DEFAULT_OFFERING_TERM_MONTHS = 12;
    private static final long DEFAULT_OFFERING_PRICE_MINOR = 4_999_900L;

    private final GymRepository gymRepository;
    private final GymSubscriptionRepository subscriptionRepository;
    private final SubscriptionPaymentRepository paymentRepository;
    private final SubscriptionOfferingRepository offeringRepository;
    private final RoleGrantFacade roleGrantFacade;
    private final LocationFacade locationFacade;
    private final UserFacade userFacade;
    private final RlsContext rlsContext;
    private final com.limitbeyond.shared.jobs.JobQueueService jobQueueService;

    public PlatformService(
            GymRepository gymRepository,
            GymSubscriptionRepository subscriptionRepository,
            SubscriptionPaymentRepository paymentRepository,
            SubscriptionOfferingRepository offeringRepository,
            RoleGrantFacade roleGrantFacade,
            LocationFacade locationFacade,
            UserFacade userFacade,
            RlsContext rlsContext,
            com.limitbeyond.shared.jobs.JobQueueService jobQueueService) {
        this.gymRepository = gymRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.paymentRepository = paymentRepository;
        this.offeringRepository = offeringRepository;
        this.roleGrantFacade = roleGrantFacade;
        this.locationFacade = locationFacade;
        this.userFacade = userFacade;
        this.rlsContext = rlsContext;
        this.jobQueueService = jobQueueService;
    }

    /**
     * FR-AUTH-04: one submission carries the gym profile AND its first
     * location — see {@link LocationFacade#createInitialLocation} for why
     * that bootstrap has to happen here rather than through the normal
     * authenticated location-creation path.
     *
     * <p>{@code firstLocation}'s {@code gymId} field is ignored — deliberately:
     * the gym does not exist yet when the controller builds its request, so
     * there is no real gym id for it to have supplied. This method creates
     * the gym first and stamps the real id onto the location record itself.
     */
    @Transactional
    public UUID registerGym(UUID registrantUserId, String slug, String legalName, String tradingName,
            String gstin, LocationFacade.NewLocation firstLocation) {
        if (gymRepository.existsBySlug(slug)) {
            throw new DomainException(ErrorCode.CONFLICT, "That gym URL is already taken.");
        }

        // Both gyms and locations carry FORCE ROW LEVEL SECURITY, and the
        // registrant's own AuthContext has no gym scope at all yet — they
        // hold no grant until activation (FR-AUTH-16). Without a matching
        // context, "gym_id = current gym" (or, for the gym row itself,
        // "id = current gym") can never be true, and Postgres would silently
        // insert zero rows for BOTH writes below.
        //
        // The id is generated in Java (User/Gym/Location all assign their own
        // UUID in the constructor, before persistence — see Gym's
        // constructor), so it exists before any save() call. That is what
        // lets this bootstrap context be correct from the very first insert
        // rather than only from the second one on.
        //
        // RlsContextAspect fires exactly ONCE per transaction — at this
        // method's own entry, using whatever context existed before this
        // call (a fresh registrant with no gym scope at all). It does NOT
        // fire again for the repository/facade calls below (Spring Data
        // wires @Transactional into its proxies through its own internal
        // machinery, invisible to this aspect's pointcut — see
        // RlsContextAspect's Javadoc), so reassigning AuthContextHolder
        // here has no effect on the database session until rlsContext.
        // reapply() explicitly pushes it. Restoring the original context
        // afterward is Java-side bookkeeping only, for whatever runs later
        // on this thread — it needs no matching reapply() of its own, since
        // nothing else in this transaction touches the database after it.
        Gym gym = new Gym(slug, legalName, tradingName, gstin, registrantUserId);

        AuthContext originalContext = AuthContextHolder.get();
        AuthContextHolder.set(new AuthContext(registrantUserId, gym.getId(), Set.of(), Set.of(), true, false));
        rlsContext.reapply();
        try {
            gym = gymRepository.save(gym);
            locationFacade.createInitialLocation(new LocationFacade.NewLocation(
                    gym.getId(), firstLocation.slug(), firstLocation.name(), firstLocation.addressLine1(),
                    firstLocation.addressLine2(), firstLocation.city(), firstLocation.state(),
                    firstLocation.pincode(), firstLocation.latitude(), firstLocation.longitude(),
                    firstLocation.phoneE164()));
        } finally {
            AuthContextHolder.set(originalContext);
        }

        // The welcome email goes out only now that registration is complete — same
        // transaction, so a failed registration never emails anyone.
        jobQueueService.enqueue(
                com.limitbeyond.shared.jobs.JobTypes.WELCOME_EMAIL, java.util.Map.of("userId", registrantUserId));

        jobQueueService.enqueue(
                com.limitbeyond.shared.jobs.JobTypes.GYM_REGISTERED_ADMIN_EMAIL, java.util.Map.of("gymId", gym.getId()));

        return gym.getId();
    }

    /** Super Admin only — enforced by the caller (PlatformController). */
    @Transactional
    public void verify(UUID gymId, boolean approve, String reason) {
        Gym gym = gymRepository.findById(gymId).orElseThrow(() -> DomainException.notFound("Gym"));
        if (approve) {
            gym.verify(AuthContextHolder.get().userId());
        } else {
            gym.reject(reason);
        }
        gymRepository.save(gym);
        // Tell the person who registered it, however the decision was made
        // (console or the review link in the notification email).
        java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("gymId", gymId);
        payload.put("outcome", approve ? "APPROVED" : "REJECTED");
        payload.put("reason", approve || reason == null ? "" : reason);
        jobQueueService.enqueue(com.limitbeyond.shared.jobs.JobTypes.GYM_REVIEW_RESULT_EMAIL, payload);
    }

    @Transactional
    public void deactivate(UUID gymId, String reason) {
        Gym gym = gymRepository.findById(gymId).orElseThrow(() -> DomainException.notFound("Gym"));
        gym.suspend(reason);
        gymRepository.save(gym);
    }

    @Transactional
    public void reactivate(UUID gymId) {
        Gym gym = gymRepository.findById(gymId).orElseThrow(() -> DomainException.notFound("Gym"));
        gym.reactivate();
        gymRepository.save(gym);
    }

    /** Soft delete: preserves payments, memberships and audit history. */
    @Transactional
    public void close(UUID gymId) {
        Gym gym = gymRepository.findById(gymId).orElseThrow(() -> DomainException.notFound("Gym"));
        gym.close();
        gymRepository.save(gym);
    }

    /** Returns view records (PlatformDtos, per identity module's own
     *  established pattern — see AuthDtos's Javadoc), never entities — the
     *  controller must not touch a Gym getter directly
     *  (ArchitectureRulesTest.controllersMustNotReturnEntities). */
    @Transactional(readOnly = true)
    public List<PlatformDtos.GymSummary> pendingGyms() {
        // Both states a Super Admin still has something to do about: a
        // freshly-registered gym needs verifying, a verified one needs
        // activating (FR-SUB-03's two separate steps). A gym disappearing
        // from this list the instant it's verified — before it's actually
        // usable — would leave no way back to it through the app.
        return gymRepository
                .findByStateInOrderByCreatedAtAsc(List.of(Gym.GymState.PENDING_VERIFICATION, Gym.GymState.VERIFIED))
                .stream()
                .map(this::toGymSummary)
                .toList();
    }

    /** Complete lifecycle view for the Super Admin dashboard and records tab. */
    @Transactional(readOnly = true)
    public List<PlatformDtos.GymSummary> allGyms() {
        return gymRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toGymSummary)
                .toList();
    }

    private PlatformDtos.GymSummary toGymSummary(Gym gym) {
        return new PlatformDtos.GymSummary(
                gym.getId(), gym.getSlug(), gym.getLegalName(), gym.getTradingName(), gym.getGstin(),
                gym.getState().name(), gym.getCreatedAt(),
                userFacade.findContact(gym.getRegisteredByUserId())
                        .map(c -> new PlatformDtos.RegistrantSummary(
                                c.firstName(), c.lastName(), c.phoneE164(), c.email()))
                        .orElse(null),
                locationFacade.listDetailsForGym(gym.getId()).stream()
                        .map(l -> new PlatformDtos.LocationDetail(
                                l.id(), l.slug(), l.name(), l.addressLine1(), l.addressLine2(),
                                l.city(), l.state(), l.pincode(), l.phoneE164(), l.approvalState()))
                        .toList());
    }

    /** The one offering a Super Admin activates a gym against, since there's
     *  no catalogue-management UI yet — created on first use, reused after.
     *  subscription_offerings has no RLS restriction (world-readable
     *  catalogue; see its migration), so no bypass is needed here. */
    @Transactional
    public PlatformDtos.OfferingSummary defaultOffering() {
        SubscriptionOffering offering = offeringRepository.findFirstByActiveTrueOrderByPriceMinorAsc()
                .orElseGet(() -> offeringRepository.save(new SubscriptionOffering(
                        DEFAULT_OFFERING_NAME, DEFAULT_OFFERING_TERM_MONTHS, DEFAULT_OFFERING_PRICE_MINOR)));
        return new PlatformDtos.OfferingSummary(
                offering.getId(), offering.getName(), offering.getPriceMinor(), offering.getCurrency());
    }

    /**
     * Every LIVE gym and its locations — what a prospective member/trainer
     * browses to choose where to join (the counterpart to registerGym's
     * "start a new gym" path). Bypassed the same way isLive/existsInGym are:
     * the caller browsing this has no gym context yet, and a gym need not be
     * {@code is_publicly_listed} (that flag is for the public web directory,
     * a separate concern) to be joinable by someone who already knows to
     * look for it in-app.
     */
    @Transactional(readOnly = true)
    public List<PlatformDtos.GymDirectoryEntry> listLiveGyms() {
        return rlsContext.withSystemBypass(() -> gymRepository.findByStateOrderByCreatedAtAsc(Gym.GymState.LIVE)
                .stream()
                .map(g -> new PlatformDtos.GymDirectoryEntry(
                        g.getId(), g.getSlug(), g.getLegalName(), g.getTradingName(),
                        locationFacade.listForGym(g.getId()).stream()
                                .map(l -> new PlatformDtos.LocationEntry(l.id(), l.slug(), l.name(), l.city()))
                                .toList()))
                .toList());
    }

    private static final int REVENUE_MONTHS = 6;

    /**
     * Super-Admin-only platform revenue — what gyms pay LimitBeyond via
     * subscription_payments, never a gym's own member-level billing
     * (NFR-PRV-03: reach across gyms, not depth into any one of them).
     */
    @Transactional(readOnly = true)
    public PlatformDtos.RevenueSummary revenueSummary() {
        long total = paymentRepository.totalRevenueMinor();
        long last30Days = paymentRepository.revenueMinorSince(LocalDate.now().minusDays(30));
        List<PlatformDtos.MonthlyRevenuePoint> monthly = paymentRepository.monthlyRevenue(REVENUE_MONTHS).stream()
                .map(row -> new PlatformDtos.MonthlyRevenuePoint(row.getMonth(), row.getTotalMinor()))
                .toList();
        return new PlatformDtos.RevenueSummary(total, last30Days, monthly);
    }

    /**
     * FR-SUB-03: records cash and, on a gym's FIRST payment, makes it live
     * and grants Gym Owner (FR-AUTH-16) — never on a later renewal payment,
     * where the gym is already live and already has an owner.
     */
    @Transactional
    public UUID recordSubscriptionPayment(UUID gymId, UUID offeringId, long amountMinor,
            SubscriptionPayment.PaymentMethod method, String reference, LocalDate receivedOn,
            String idempotencyKey) {
        UUID actorId = AuthContextHolder.get().userId();

        var existing = paymentRepository.findByRecordedByUserIdAndIdempotencyKey(actorId, idempotencyKey);
        if (existing.isPresent()) {
            return existing.get().getId(); // FR replay: same key, same actor — return the original outcome
        }

        Gym gym = gymRepository.findById(gymId).orElseThrow(() -> DomainException.notFound("Gym"));
        if (gym.getState() == Gym.GymState.PENDING_VERIFICATION) {
            throw new DomainException(ErrorCode.RULE_VIOLATION, "This gym must be verified before it can be activated.");
        }

        boolean firstActivation = gym.getState() == Gym.GymState.VERIFIED;

        GymSubscription subscription = subscriptionRepository
                .findByGymIdAndStateOrderByExpiresOnDesc(gymId, GymSubscription.SubscriptionState.LIVE)
                .orElseGet(() -> new GymSubscription(gymId, offeringId, receivedOn, 12, GRACE_DAYS));
        subscription = subscriptionRepository.save(subscription);

        SubscriptionPayment payment = new SubscriptionPayment(
                subscription.getId(), gymId, amountMinor, method, reference, receivedOn, actorId, idempotencyKey);
        payment = paymentRepository.save(payment);

        gym.goLive();
        gymRepository.save(gym);

        if (firstActivation) {
            roleGrantFacade.grantGymOwner(gym.getRegisteredByUserId(), gymId);
        }

        return payment.getId();
    }
}
