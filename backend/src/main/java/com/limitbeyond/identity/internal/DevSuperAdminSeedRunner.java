package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.domain.FitnessProfile;
import com.limitbeyond.identity.domain.RoleGrant;
import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.FitnessProfileRepository;
import com.limitbeyond.identity.persistence.RoleGrantRepository;
import com.limitbeyond.identity.persistence.UserRepository;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dev/test convenience only. FR-AUTH-03 is explicit that Super Admin accounts
 * are provisioned directly, never through public registration — by design,
 * there is no endpoint that creates one. That leaves a real gap for anyone
 * standing this codebase up locally: something has to be the first Super
 * Admin.
 *
 * <p>Seeded with BOTH a phone number (OTP login, same path any other
 * account uses) and an email + password (AuthService.login) — not because a
 * self-registered account would ever get both, but because whichever of
 * Twilio SMS/email is actually reachable in a given local setup varies (a
 * fresh Twilio trial account needs the phone number verified in its
 * console; the email channel needs a linked SendGrid integration on top of
 * that), and this way there is always at least one working path to the
 * first Super Admin regardless of which of those two hasn't been set up
 * yet. FR-AUTH-03's "no admin above a Super Admin to approve them" is what
 * the OTP self-REGISTRATION restriction is about — logging an EXISTING,
 * already-seeded account in via OTP is the ordinary case every account
 * uses, so this creates no conflict. {@code @Profile("!prod")} keeps it out
 * of any real deployment; a genuine production environment provisions its
 * Super Admin some other way (a one-off migration or an operator runbook),
 * never this.
 *
 * <p>Deliberately NOT {@code @Transactional} itself, and delegates to
 * {@link DevSuperAdminSeeder} — a separate bean — rather than to a private
 * method on this one. Two reasons, not one: a private
 * {@code @Transactional} method called via {@code this.foo()} is
 * self-invocation, which bypasses the proxy and silently runs with no
 * transaction at all (see {@code JobProcessor}'s Javadoc). But even fixing
 * that by putting {@code @Transactional} directly on {@code run()} isn't
 * enough — {@code RlsContextAspect}'s advice fires when the transaction
 * *opens*, which is on entry to the proxied call, before that method's own
 * body has run. Setting {@code AuthContextHolder} inside the transactional
 * method would apply it one step too late. Setting it HERE, in the caller,
 * immediately before crossing into {@link DevSuperAdminSeeder}'s proxy, is
 * what makes it visible in time.
 */
@Component
@Profile("!prod")
public class DevSuperAdminSeedRunner implements CommandLineRunner {

    private final String phoneE164;
    private final String email;
    private final UserRepository userRepository;
    private final DevSuperAdminSeeder seeder;

    public DevSuperAdminSeedRunner(
            @Value("${limitbeyond.dev-super-admin.phone:+918088620079}") String phoneE164,
            @Value("${limitbeyond.dev-super-admin.email:bibek.jha1911@gmail.com}") String email,
            UserRepository userRepository,
            DevSuperAdminSeeder seeder) {
        this.phoneE164 = phoneE164;
        this.email = email;
        this.userRepository = userRepository;
        this.seeder = seeder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.findByEmail(email).isPresent() || userRepository.findByPhoneE164(phoneE164).isPresent()) {
            return;
        }

        // role_grants has RLS FORCED; an anonymous context matches none of
        // its policy's clauses, so this insert needs the same system-level
        // bypass JobProcessor uses for background work — a deliberate,
        // narrow, and named exception, not a general habit.
        AuthContextHolder.set(AuthContext.superAdmin(null));
        try {
            seeder.seed(phoneE164, email);
        } finally {
            AuthContextHolder.clear();
        }
    }
}

/** The {@code @Transactional} half — see {@link DevSuperAdminSeedRunner}'s Javadoc for why this is a separate bean. */
@Component
class DevSuperAdminSeeder {

    private static final Logger log = LoggerFactory.getLogger(DevSuperAdminSeeder.class);

    private final String rawPassword;
    private final UserRepository userRepository;
    private final FitnessProfileRepository fitnessProfileRepository;
    private final RoleGrantRepository roleGrantRepository;
    private final PasswordEncoder passwordEncoder;

    DevSuperAdminSeeder(
            @Value("${limitbeyond.dev-super-admin.password:Bibek@12345}") String rawPassword,
            UserRepository userRepository,
            FitnessProfileRepository fitnessProfileRepository,
            RoleGrantRepository roleGrantRepository,
            PasswordEncoder passwordEncoder) {
        this.rawPassword = rawPassword;
        this.userRepository = userRepository;
        this.fitnessProfileRepository = fitnessProfileRepository;
        this.roleGrantRepository = roleGrantRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    void seed(String phoneE164, String email) {
        User admin = User.registerWithPhoneAndEmail(phoneE164, email, "Bibek", "Jha");
        admin.markPhoneVerified();
        admin.markEmailVerified();
        admin.assignPassword(passwordEncoder.encode(rawPassword));
        admin.activate();
        userRepository.save(admin);
        fitnessProfileRepository.save(new FitnessProfile(admin.getId()));
        roleGrantRepository.save(RoleGrant.superAdmin(admin.getId(), null));

        log.info("Seeded dev Super Admin: phone={} email={} — sign in via OTP or POST /api/v1/auth/login",
                phoneE164, email);
    }
}
