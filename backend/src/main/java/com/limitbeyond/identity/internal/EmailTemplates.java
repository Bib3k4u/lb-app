package com.limitbeyond.identity.internal;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Loads the branded HTML layouts in src/main/resources/email and fills them in. */
final class EmailTemplates {

    static final String LOGO_DARK = "https://neelkanthgym.in/images/logo-dark-v6.png";

    private EmailTemplates() {
    }

    static String load(String name) {
        try (var in = EmailTemplates.class.getResourceAsStream("/email/" + name)) {
            if (in == null) {
                throw new IllegalStateException("email/" + name + " is missing from the classpath");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read email/" + name, e);
        }
    }

    static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    static String fill(String template, String name, String url) {
        return template
                .replace("@NAME@", escape(name))
                .replace("@URL@", escape(url))
                .replace("@LOGO_DARK@", LOGO_DARK);
    }

    static String firstNameOrThere(String firstName) {
        return firstName == null || firstName.isBlank() ? "there" : firstName.trim();
    }

    static String baseUrl(String configured) {
        return configured == null || configured.isBlank() ? "https://admin.neelkanthgym.in" : configured.replaceAll("/+$", "");
    }
}
