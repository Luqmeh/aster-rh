/** Chemins autorisés tant que mustChangePassword est actif. */
export function isAllowedDuringPasswordChange(pathname: string): boolean {
  if (pathname === "/changer-mot-de-passe") return true;
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) return true;
  return false;
}
