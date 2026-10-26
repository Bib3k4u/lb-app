package com.limitbeyond.shared.email;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * The one HTML layout every email is rendered through: a full-width page with
 * a black hero, a yellow band, a white body, a sign-off and a footer. Callers
 * pass content; the layout owns every colour, size and spacing, so all mails
 * stay visually identical. Anything passed in as {@code ...Html} is trusted
 * markup built with the helpers below, which escape every dynamic value.
 */
public final class EmailLayout {

    private static final String LAYOUT = load("layout.html");
    public static final String LOGO_DARK = "https://neelkanthgym.in/images/logo-dark-v6.png";

    /** A call-to-action button; secondary ones are outlined. */
    public record Button(String label, String url, boolean primary) {
    }

    private EmailLayout() {
    }

    public static String render(String preheader, String eyebrow, String titleHtml, String introHtml,
            String bodyHtml, List<Button> buttons, String signoffHtml, String footnote) {
        String plainTitle = titleHtml.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        return LAYOUT
                .replace("@TITLE_TEXT@", escape(plainTitle))
                .replace("@PREHEADER@", escape(preheader))
                .replace("@EYEBROW@", escape(eyebrow))
                .replace("@TITLE_HTML@", titleHtml)
                .replace("@INTRO@", introHtml)
                .replace("@BODY@", bodyHtml)
                .replace("@BUTTONS@", buttonsRow(buttons))
                .replace("@SIGNOFF@", signoffHtml)
                .replace("@FOOTNOTE@", escape(footnote))
                .replace("@LOGO_DARK@", LOGO_DARK);
    }

    // ---- content helpers (all escape their inputs) ---------------------------------

    public static String highlight(String text) {
        return "<span style=\"background:#f6dc3c;color:#0a0a0a;padding:0 8px\">" + escape(text) + "</span>";
    }

    public static String strongYellow(String text) {
        return "<b style=\"color:#f6dc3c\">" + escape(text) + "</b>";
    }

    public static String eyebrowLabel(String text) {
        return "<p style=\"margin:0;font-size:11px;font-weight:800;letter-spacing:.16em;color:#7a6200\">" + escape(text) + "</p>";
    }

    public static String heading(String text) {
        return "<h2 style=\"margin:6px 0 10px;font-family:'Arial Narrow',Arial,sans-serif;font-size:24px;line-height:1.12;text-transform:uppercase;color:#0a0a0a\">" + escape(text) + "</h2>";
    }

    public static String paragraph(String text) {
        return "<p style=\"margin:0 0 18px;font-size:15px;line-height:1.6;color:#55554d\">" + escape(text) + "</p>";
    }

    /** A tick-marked row: bold title with a one-line description. */
    public static String feature(String title, String description) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 14px\"><tr>"
                + "<td width=\"38\" valign=\"top\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#f6dc3c\" align=\"center\" width=\"26\" height=\"26\" style=\"background:#f6dc3c;border-radius:50%;font-weight:800;font-size:13px\">&#10003;</td></tr></table></td>"
                + "<td valign=\"top\"><b style=\"font-size:15px;color:#0a0a0a\">" + escape(title) + "</b><br>"
                + "<span style=\"font-size:14px;line-height:1.55;color:#55554d\">" + escape(description) + "</span></td></tr></table>";
    }

    /** A bordered key/value table; null or blank values are skipped. */
    public static String details(String... labelValuePairs) {
        StringBuilder sb = new StringBuilder(
                "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 22px;border:1px solid #e6e4d6;border-radius:12px;background:#faf9f2\">");
        for (int i = 0; i + 1 < labelValuePairs.length; i += 2) {
            String value = labelValuePairs[i + 1];
            if (value == null || value.isBlank()) {
                continue;
            }
            sb.append("<tr><td width=\"34%\" valign=\"top\" style=\"padding:11px 14px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#7a6200;border-bottom:1px solid #eeecdf\">")
                    .append(escape(labelValuePairs[i].toUpperCase())).append("</td>")
                    .append("<td valign=\"top\" style=\"padding:11px 14px;font-size:14px;line-height:1.5;color:#0a0a0a;border-bottom:1px solid #eeecdf\">")
                    .append(escape(value)).append("</td></tr>");
        }
        return sb.append("</table>").toString();
    }

    private static String buttonsRow(List<Button> buttons) {
        if (buttons == null || buttons.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("<tr><td style=\"padding:6px 24px 32px\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>");
        for (Button b : buttons) {
            String bg = b.primary() ? "#f6dc3c" : "#ffffff";
            String border = b.primary() ? "#f6dc3c" : "#0a0a0a";
            sb.append("<td style=\"padding:0 10px 10px 0\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"")
                    .append(bg).append("\" style=\"background:").append(bg).append(";border:2px solid ").append(border)
                    .append(";border-radius:999px\"><a href=\"").append(escape(b.url()))
                    .append("\" style=\"display:inline-block;padding:13px 26px;font-weight:800;font-size:15px;color:#0a0a0a;text-decoration:none\">")
                    .append(escape(b.label())).append("</a></td></tr></table></td>");
        }
        return sb.append("</tr></table></td></tr>").toString();
    }

    public static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private static String load(String name) {
        try (var in = EmailLayout.class.getResourceAsStream("/email/" + name)) {
            if (in == null) {
                throw new IllegalStateException("email/" + name + " is missing from the classpath");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read email/" + name, e);
        }
    }
}
