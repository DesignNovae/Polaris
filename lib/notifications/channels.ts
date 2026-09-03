/**
 * Notification delivery.
 *
 * Deadline risk scoring already existed; delivery was in-app only, which means
 * it reached nobody who wasn't already looking. A missed scholarship deadline
 * is the highest-regret event in this product, so reminders have to leave the
 * building.
 *
 * Provider-thin on purpose. Each channel declares whether it is configured and
 * how to send; nothing above this file knows which vendor is behind it. With
 * nothing configured, sends are recorded as `skipped` rather than failing - a
 * development machine should not need an SMS gateway to exercise the scheduler.
 *
 * SMS before email is deliberate for this market: a Bangladeshi student checks
 * a text far more reliably than an inbox.
 */

export type Channel = "email" | "sms";

export type Message = {
  to: string;
  subject: string;
  /** Plain text. SMS uses this verbatim, so keep it short and self-contained. */
  body: string;
};

export type SendOutcome =
  | { status: "sent"; channel: Channel; providerId?: string }
  | { status: "skipped"; channel: Channel; reason: string }
  | { status: "failed"; channel: Channel; reason: string };

/* ── Email ────────────────────────────────────────────────────────────────
   Resend's REST API - one fetch, no SDK, no cold-start cost. Swapping in a
   different provider means changing this function and nothing else.
*/

function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL_FROM);
}

async function sendEmail(msg: Message): Promise<SendOutcome> {
  if (!emailConfigured()) {
    return { status: "skipped", channel: "email", reason: "not-configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.body,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { status: "failed", channel: "email", reason: `http-${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: "sent", channel: "email", providerId: data.id };
  } catch (err) {
    return {
      status: "failed",
      channel: "email",
      reason: err instanceof Error ? err.message : "unknown",
    };
  }
}

/* ── SMS ──────────────────────────────────────────────────────────────────
   Generic HTTP gateway, which is how the Bangladeshi providers (SSL Wireless,
   Banglalink, Robi) all expose sending. Configure the endpoint and the
   parameter names rather than hard-coding one vendor.
*/

function smsConfigured(): boolean {
  return Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);
}

/** Bangladeshi mobile numbers, normalised to the 880XXXXXXXXXX form. */
export function normaliseBdPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^880\d{10}$/.test(digits)) return digits;
  if (/^0\d{10}$/.test(digits)) return `88${digits}`;
  if (/^\d{10}$/.test(digits) && digits.startsWith("1")) return `880${digits}`;
  return null;
}

async function sendSms(msg: Message): Promise<SendOutcome> {
  if (!smsConfigured()) {
    return { status: "skipped", channel: "sms", reason: "not-configured" };
  }
  const to = normaliseBdPhone(msg.to);
  if (!to) {
    return { status: "skipped", channel: "sms", reason: "unusable-number" };
  }
  try {
    const res = await fetch(process.env.SMS_API_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.SMS_API_KEY,
        senderid: process.env.SMS_SENDER_ID ?? "Polaris",
        msisdn: to,
        // Gateways charge per 160-character segment; one segment per reminder.
        smsbody: msg.body.slice(0, 160),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { status: "failed", channel: "sms", reason: `http-${res.status}` };
    }
    return { status: "sent", channel: "sms" };
  } catch (err) {
    return {
      status: "failed",
      channel: "sms",
      reason: err instanceof Error ? err.message : "unknown",
    };
  }
}

export function isChannelConfigured(channel: Channel): boolean {
  return channel === "email" ? emailConfigured() : smsConfigured();
}

export async function send(channel: Channel, msg: Message): Promise<SendOutcome> {
  return channel === "email" ? sendEmail(msg) : sendSms(msg);
}
