export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

/**
 * Port e-mail — remplaçable par Microsoft Graph / SMTP entreprise.
 */
export interface EmailPort {
  send(message: EmailMessage): Promise<{ queued: true; provider: string }>;
}
