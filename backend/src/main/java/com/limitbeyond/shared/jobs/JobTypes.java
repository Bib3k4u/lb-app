package com.limitbeyond.shared.jobs;

/** Job type names shared across modules, so the module that enqueues a job and
 *  the module that handles it never drift apart on a string. */
public final class JobTypes {

    /** Sent once a gym registration is complete. */
    public static final String WELCOME_EMAIL = "WELCOME_EMAIL";
    /** Sent about an hour after sign-up if the gym details were never filled in. */
    public static final String REGISTRATION_REMINDER_EMAIL = "REGISTRATION_REMINDER_EMAIL";

    private JobTypes() {
    }
}
