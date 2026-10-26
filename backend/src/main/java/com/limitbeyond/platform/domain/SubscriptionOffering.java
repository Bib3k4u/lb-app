package com.limitbeyond.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "subscription_offerings")
public class SubscriptionOffering {

    @Id
    private UUID id;

    private String name;

    @Column(name = "term_months")
    private int termMonths;

    @Column(name = "price_minor")
    private long priceMinor;

    private String currency = "INR";

    @Column(name = "is_active")
    private boolean active = true;

    protected SubscriptionOffering() {
    }

    public SubscriptionOffering(String name, int termMonths, long priceMinor) {
        if (termMonths <= 0) {
            throw new IllegalArgumentException("termMonths must be positive.");
        }
        this.id = UUID.randomUUID();
        this.name = name;
        this.termMonths = termMonths;
        this.priceMinor = priceMinor;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getTermMonths() {
        return termMonths;
    }

    public long getPriceMinor() {
        return priceMinor;
    }

    public String getCurrency() {
        return currency;
    }

    public boolean isActive() {
        return active;
    }
}
