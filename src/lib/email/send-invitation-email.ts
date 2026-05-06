import "server-only";

export type SendInvitationEmailInput = {
  to: string;
  invitationUrl: string;
  expiresAt: string;
};

export type SendInvitationEmailResult =
  | { ok: true }
  | {
      ok: false;
      code: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED";
      message: string;
    };

function isProbablyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createInvitationEmailText({
  invitationUrl,
  expiresAt,
}: {
  invitationUrl: string;
  expiresAt: string;
}) {
  return `Hello,

You have been invited to join GOThriveCoaching.

GOThriveCoaching is a coaching management platform that helps coaches and coachees track growth, goals, weekly reflections, and feedback.

Please open the link below to accept your invitation:
${invitationUrl}

This invitation expires on ${expiresAt}.

For your security, please do not share this link with others.

If you did not expect this invitation, you can safely ignore this email.

Thank you,
GOThriveCoaching Team`;
}

function createInvitationEmailHtml({
  invitationUrl,
  expiresAt,
}: {
  invitationUrl: string;
  expiresAt: string;
}) {
  const safeInvitationUrl = escapeHtml(invitationUrl);
  const safeExpiresAt = escapeHtml(expiresAt);

  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">You are invited to GOThriveCoaching</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
          Hello,
        </p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
          You have been invited to join GOThriveCoaching.
        </p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">
          GOThriveCoaching is a coaching management platform that helps coaches and coachees track growth, goals, weekly reflections, and feedback.
        </p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">
          Please use the button below to accept your invitation.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${safeInvitationUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:15px;font-weight:600;">
            Accept invitation
          </a>
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.7;word-break:break-all;">
          <a href="${safeInvitationUrl}" style="color:#1d4ed8;">${safeInvitationUrl}</a>
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">
          This invitation expires on ${safeExpiresAt}.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">
          For your security, please do not share this link with others.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">
          If you did not expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </div>
  </body>
</html>`.trim();
}

export async function sendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<SendInvitationEmailResult> {
  const to = input.to.trim().toLowerCase();
  const invitationUrl = input.invitationUrl.trim();
  const expiresAt = input.expiresAt.trim();

  if (!to || !isProbablyEmail(to) || !invitationUrl || !expiresAt) {
    return {
      ok: false,
      code: "EMAIL_SEND_FAILED",
      message: "Invitation email could not be sent.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !emailFrom) {
    return {
      ok: false,
      code: "EMAIL_NOT_CONFIGURED",
      message: "Email sending is not configured.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [to],
        subject: "You are invited to GOThriveCoaching",
        text: createInvitationEmailText({
          invitationUrl,
          expiresAt,
        }),
        html: createInvitationEmailHtml({
          invitationUrl,
          expiresAt,
        }),
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        code: "EMAIL_SEND_FAILED",
        message: "Invitation email could not be sent.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "EMAIL_SEND_FAILED",
      message: "Invitation email could not be sent.",
    };
  }
}
