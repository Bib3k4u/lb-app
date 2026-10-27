package com.limitbeyond.identity.internal;

/** Small helpers shared by the access-request mails. */
final class DecisionEmails {

    private DecisionEmails() {
    }

    static String firstNameOrThere(String firstName) {
        return firstName == null || firstName.isBlank() ? "there" : firstName.trim();
    }
}
