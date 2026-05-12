type EmailResult = {
  sent: boolean;
  provider: "resend" | "not_configured";
  id?: string;
  error?: string;
};

type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  bcc?: string | string[];
};

function parseRecipients(value: string | string[] | undefined) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : value.split(",");
  return raw.map((item) => item.trim()).filter(Boolean);
}

export async function sendOpsEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SECURE_SMART_NOTIFY_FROM || "Secure Smart <info@securesmart.tech>";
  const replyTo = message.replyTo || process.env.SECURE_SMART_REPLY_TO || "info@securesmart.tech";
  const to = parseRecipients(message.to);
  const bcc = parseRecipients(message.bcc);

  if (!apiKey) {
    return { sent: false, provider: "not_configured", error: "RESEND_API_KEY is not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: [replyTo],
        ...(bcc.length ? { bcc } : {}),
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    const responseText = await response.text().catch(() => "");
    let responseJson: { id?: string } | null = null;
    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseJson = null;
    }

    if (!response.ok) {
      return { sent: false, provider: "resend", error: responseText || `HTTP ${response.status}` };
    }

    return { sent: true, provider: "resend", id: responseJson?.id };
  } catch (error) {
    return { sent: false, provider: "resend", error: error instanceof Error ? error.message : "Unknown email error" };
  }
}
