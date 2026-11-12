export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}

/** "Tilawah <hello@example.com>" → { name, email } */
export function parseSender(from: string): { name: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { name: 'Tilawah', email: from.trim() };
  const name = match[1] ?? '';
  return { name: name === '' ? 'Tilawah' : name, email: match[2] ?? from };
}

/** Brevo transactional email over HTTPS (works on every Railway plan; SMTP is not used). */
export class BrevoEmail implements EmailPort {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseSender(this.from),
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });
    if (!response.ok) {
      // Brevo's error body has no secrets, but never include the recipient in logs.
      throw new Error(`Brevo rejected the email (HTTP ${response.status})`);
    }
  }
}

/** Development only: prints the email so links can be clicked. The recipient is masked. */
export class ConsoleEmail implements EmailPort {
  constructor(private readonly enabled: boolean) {}

  send(message: EmailMessage): Promise<void> {
    if (this.enabled) {
      const masked = message.to.replace(/^(.).*(@.*)$/, '$1***$2');
      console.warn(`[email] to ${masked}: ${message.subject}\n${message.text}`);
    } else {
      console.warn('[email] EMAIL_TRANSPORT=none: email not sent');
    }
    return Promise.resolve();
  }
}

export const verificationEmail = (url: string): Omit<EmailMessage, 'to'> => ({
  subject: 'Confirm your email for Tilawah',
  text: `Assalamu alaikum,\n\nConfirm your email address by opening this link:\n${url}\n\nIf you did not create an account, ignore this email.`,
  html: `<p>Assalamu alaikum,</p><p>Confirm your email address:</p><p><a href="${url}">Confirm email</a></p><p>If you did not create an account, ignore this email.</p>`,
});

export const resetPasswordEmail = (url: string): Omit<EmailMessage, 'to'> => ({
  subject: 'Reset your Tilawah password',
  text: `Assalamu alaikum,\n\nReset your password with this link (valid for one hour):\n${url}\n\nIf you did not ask for this, ignore this email.`,
  html: `<p>Assalamu alaikum,</p><p>Reset your password (valid for one hour):</p><p><a href="${url}">Reset password</a></p><p>If you did not ask for this, ignore this email.</p>`,
});
