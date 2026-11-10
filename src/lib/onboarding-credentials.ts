export type OnboardingCredentials = {
  email: string;
  temporaryPassword: string;
  employeeId: string;
};

export function credentialsFromOnboardResult(result: {
  employeeId: string;
  email?: string;
  temporaryPassword: string | null;
}): OnboardingCredentials | null {
  if (!result.temporaryPassword) return null;
  const email = result.email?.trim();
  if (!email) return null;
  return {
    email,
    temporaryPassword: result.temporaryPassword,
    employeeId: result.employeeId,
  };
}

export function formatCredentialsForCopy(credentials: OnboardingCredentials): string {
  return `E-mail : ${credentials.email}\nMot de passe temporaire : ${credentials.temporaryPassword}`;
}

/** Empêche une double soumission pendant le traitement ou tant que la modale est ouverte. */
export function canSubmitOnboardForm(options: {
  pending: boolean;
  credentialsVisible: boolean;
}): boolean {
  return !options.pending && !options.credentialsVisible;
}
