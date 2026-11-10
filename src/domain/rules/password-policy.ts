export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; message: string };

const MIN_LENGTH = 10;

/**
 * Règles démo raisonnables pour mots de passe applicatifs ASTER.
 * (Pas une politique PKF inventée — hypothèse de démonstration.)
 */
export function validateNewPassword(
  newPassword: string,
  confirmation: string,
  options?: { currentPassword?: string },
): PasswordPolicyResult {
  if (!newPassword || !confirmation) {
    return {
      ok: false,
      message: "Le nouveau mot de passe et sa confirmation sont requis.",
    };
  }
  if (newPassword !== confirmation) {
    return {
      ok: false,
      message: "La confirmation ne correspond pas au nouveau mot de passe.",
    };
  }
  if (newPassword.length < MIN_LENGTH) {
    return {
      ok: false,
      message: `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`,
    };
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return {
      ok: false,
      message:
        "Le mot de passe doit contenir au moins une lettre et un chiffre.",
    };
  }
  if (
    options?.currentPassword &&
    newPassword === options.currentPassword
  ) {
    return {
      ok: false,
      message:
        "Le nouveau mot de passe doit être différent du mot de passe temporaire.",
    };
  }
  return { ok: true };
}
