import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "../email.service";

describe("renderEmailTemplate", () => {
  it("renders the signup verification email from the file-backed welcome template", () => {
    const html = renderEmailTemplate("welcome-email.html", {
      GIVEN_NAME: "Ava",
      CTA_URL: "https://example.com/verify?token=abc123",
      CTA_LABEL: "Verify Email & Begin Journie",
      SUPPORT_EMAIL: "support@journi.com",
    });

    expect(html).toContain("Dear Ava,");
    expect(html).toContain("https://example.com/verify?token=abc123");
    expect(html).toContain("Verify Email &amp; Begin Journie");
  });

  it("escapes user-controlled values before injecting them into the HTML template", () => {
    const html = renderEmailTemplate("team-invite-email.html", {
      GIVEN_NAME: "<Sam>",
      INVITER_NAME: "Alex & Co",
      ORGANIZATION_NAME: 'Research "Lab"',
      ROLE: "admin",
      INVITE_URL: "https://example.com/invite?token=<unsafe>",
      SUPPORT_EMAIL: "support@journi.com",
    });

    expect(html).toContain("&lt;Sam&gt;");
    expect(html).toContain("Alex &amp; Co");
    expect(html).toContain("Research &quot;Lab&quot;");
    expect(html).toContain("https://example.com/invite?token=&lt;unsafe&gt;");
  });
});
