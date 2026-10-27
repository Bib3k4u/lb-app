package com.limitbeyond.shared.jobs;

/** Job type names shared across modules, so the module that enqueues a job and
 *  the module that handles it never drift apart on a string. */
public final class JobTypes {

    /** Sent once a gym registration is complete. */
    public static final String WELCOME_EMAIL = "WELCOME_EMAIL";
    /** Sent about an hour after sign-up if the gym details were never filled in. */
    public static final String REGISTRATION_REMINDER_EMAIL = "REGISTRATION_REMINDER_EMAIL";

    /** Tells every Super Admin that a gym registered and awaits review. */
    public static final String GYM_REGISTERED_ADMIN_EMAIL = "GYM_REGISTERED_ADMIN_EMAIL";
    /** Tells every Super Admin that an existing gym added a branch awaiting review. */
    public static final String LOCATION_ADDED_ADMIN_EMAIL = "LOCATION_ADDED_ADMIN_EMAIL";

    /** Tells the gym owner their gym registration was approved or rejected. */
    public static final String GYM_REVIEW_RESULT_EMAIL = "GYM_REVIEW_RESULT_EMAIL";
    /** Tells the gym owner(s) a branch was approved or rejected. */
    public static final String LOCATION_REVIEW_RESULT_EMAIL = "LOCATION_REVIEW_RESULT_EMAIL";

    /** Tells a gym's admins that a member or trainer is asking for access. */
    public static final String ACCESS_REQUESTED_ADMIN_EMAIL = "ACCESS_REQUESTED_ADMIN_EMAIL";
    /** Tells a member or trainer their access request was approved (welcome) or declined. */
    public static final String ACCESS_DECISION_EMAIL = "ACCESS_DECISION_EMAIL";

    private JobTypes() {
    }
}
