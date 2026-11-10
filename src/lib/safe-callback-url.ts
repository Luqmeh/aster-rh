/**
 * Autorise uniquement des chemins relatifs internes ASTER.
 * Rejette les open-redirects (`//evil.com`, `/\`, `..`, protocoles…).
 */
export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/tableau-de-bord",
): string {
  const value = (raw ?? "").trim();
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://") || value.includes("\\")) return fallback;
  if (value.split("/").some((segment) => segment === "..")) return fallback;
  // Chemins applicatifs uniquement (pas de query/hash arbitraires vers l'extérieur)
  if (!/^\/[A-Za-z0-9/_?-]*$/.test(value)) return fallback;
  return value;
}
