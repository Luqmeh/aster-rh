import type { EmailPort } from "@/infrastructure/email/types";

/** Adaptateur mock — journalise uniquement, n'envoie aucun message réel. */
export const mockEmail: EmailPort = {
  async send(message) {
    console.info("[ASTER DEMO EMAIL]", {
      to: message.to,
      subject: message.subject,
      preview: message.body.slice(0, 120),
    });
    return { queued: true, provider: "mock-email" };
  },
};
