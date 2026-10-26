package com.limitbeyond.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** Gym-wide (shape B): pricing is reserved to the Gym Owner to write
 *  (FR-ORG-12) but readable by any staff of the gym at any location. */
@Entity
@Table(name = "plans")
public class Plan {

    @Id
    private UUID id;

    @Column(name = "gym_id", nullable = false)
    private UUID gymId;

    @Column(nullable = false)
    private String name;

    @Column(name = "duration_months", nullable = false)
    private int durationMonths;

    @Column(name = "price_minor", nullable = false)
    private long priceMinor;

    private String currency = "INR";

    @Column(name = "is_active")
    private boolean active = true;

    protected Plan() {
    }

    public Plan(UUID gymId, String name, int durationMonths, long priceMinor) {
        if (durationMonths <= 0) {
            throw new IllegalArgumentException("durationMonths must be positive.");
        }
        this.id = UUID.randomUUID();
        this.gymId = gymId;
        this.name = name;
        this.durationMonths = durationMonths;
        this.priceMinor = priceMinor;
    }

    public UUID getId() {
        return id;
    }

    public UUID getGymId() {
        return gymId;
    }

    public int getDurationMonths() {
        return durationMonths;
    }

    public long getPriceMinor() {
        return priceMinor;
    }

    public String getName() {
        return name;
    }

    public String getCurrency() {
        return currency;
    }

    public boolean isActive() {
        return active;
    }

    public void update(String name, int durationMonths, long priceMinor) {
        if (name == null || name.isBlank() || durationMonths <= 0 || priceMinor <= 0) {
            throw new IllegalArgumentException("Plan name, duration and price must be valid.");
        }
        this.name = name.trim();
        this.durationMonths = durationMonths;
        this.priceMinor = priceMinor;
    }

    /** Soft deletion preserves historical membership and payment references. */
    public void deactivate() {
        this.active = false;
    }
}
