package com.limitbeyond.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * No {@code gym_id}. Authority is a grant ({@link RoleGrant}), never a
 * column here — this is the schema expression of "membership is a role, not
 * an identity" (LB-DATA-1.0 §2.1), and it is what lets staff train without a
 * second account.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    private UUID id;

    @Column(name = "phone_e164")
    private String phoneE164;

    // citext: case-insensitive uniqueness (LB-DATA-1.0); see Gym.slug for why
    // this has to be spelled out for Hibernate's schema validator.
    @Column(columnDefinition = "citext")
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    private String gender;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "account_state")
    private AccountState state = AccountState.PENDING_VERIFICATION;

    @Column(name = "phone_verified_at")
    private Instant phoneVerifiedAt;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected User() {
    }

    private User(String phoneE164, String email, String firstName, String lastName) {
        // DM-02: the invariant "a user has at least one identifier" is
        // enforced here AND as a database CHECK constraint. The object-level
        // check gives a legible error message at the moment of construction;
        // the constraint guarantees the rule even if a future code path
        // somehow bypasses this constructor.
        if ((phoneE164 == null || phoneE164.isBlank()) && (email == null || email.isBlank())) {
            throw new IllegalArgumentException("A user requires a phone number or an email address.");
        }
        this.id = UUID.randomUUID();
        this.phoneE164 = phoneE164;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public static User registerWithPhone(String phoneE164, String firstName, String lastName) {
        return new User(phoneE164, null, firstName, lastName);
    }

    public static User registerWithEmail(String email, String firstName, String lastName) {
        return new User(null, email, firstName, lastName);
    }

    /** Both identifiers on one account — used for the dev Super Admin seed
     *  specifically, so it can sign in via whichever of OTP (phone) or
     *  password (email) is actually reachable in a given environment (e.g.
     *  Twilio email channel not yet configured). Not exposed through any
     *  self-registration path — a regular account only ever gets one or the
     *  other, from whichever of registerWithPhone/registerWithEmail
     *  AuthService.verifyOtp used. */
    public static User registerWithPhoneAndEmail(String phoneE164, String email, String firstName, String lastName) {
        return new User(phoneE164, email, firstName, lastName);
    }

    /** Password login (email + password) is for accounts FR-AUTH-03 excludes
     *  from OTP-based self-registration — a Super Admin, with no admin above
     *  them to send a verification code through. {@code passwordHash} must
     *  already be BCrypt-hashed; this method does not hash it. */
    public void assignPassword(String passwordHash) {
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new IllegalArgumentException("A password hash cannot be blank.");
        }
        this.passwordHash = passwordHash;
        this.updatedAt = Instant.now();
    }

    /** Every parameter applied only if non-blank/non-null — this is a PATCH,
     *  not a PUT: a caller sends whatever one onboarding step collected and
     *  leaves the rest alone. */
    public void updateProfile(String firstName, String lastName, LocalDate dateOfBirth, String gender) {
        if (firstName != null && !firstName.isBlank()) {
            this.firstName = firstName;
        }
        if (lastName != null && !lastName.isBlank()) {
            this.lastName = lastName;
        }
        if (dateOfBirth != null) {
            this.dateOfBirth = dateOfBirth;
        }
        if (gender != null && !gender.isBlank()) {
            this.gender = gender;
        }
        this.updatedAt = Instant.now();
    }

    /**
     * FR-AUTH-06/09: proving you own a phone number and being ADMITTED by an
     * admin are two different events, and this method is only the first one
     * — the account stays {@code PENDING_VERIFICATION} regardless. Activation
     * is the separate, explicit {@link #activate()} call an admin's approval
     * triggers in {@code identity.internal.VerificationService}.
     */
    public void markPhoneVerified() {
        this.phoneVerifiedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void markEmailVerified() {
        this.emailVerifiedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void suspend(String reason) {
        this.state = AccountState.SUSPENDED;
        this.updatedAt = Instant.now();
    }

    public void activate() {
        this.state = AccountState.ACTIVE;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getPhoneE164() {
        return phoneE164;
    }

    public String getEmail() {
        return email;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public AccountState getState() {
        return state;
    }

    public Instant getPhoneVerifiedAt() {
        return phoneVerifiedAt;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public String getGender() {
        return gender;
    }

    public enum AccountState {
        PENDING_VERIFICATION, ACTIVE, SUSPENDED, DEACTIVATED
    }
}
