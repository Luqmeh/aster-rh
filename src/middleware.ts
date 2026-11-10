import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { isAllowedDuringPasswordChange } from "@/infrastructure/auth/password-change-gate";

/**
 * Middleware edge-safe : instance Auth.js légère (auth.config uniquement).
 * Ne pas importer `@/auth` ici (Credentials + Prisma/bcrypt incompatibles Edge).
 *
 * Cause du loop Vercel corrigée : `getToken()` sans `secureCookie` ne lisait pas
 * `__Secure-authjs.session-token` en HTTPS, alors que `auth()` sur /connexion le lisait
 * → bascule infinie /connexion ↔ /tableau-de-bord.
 */
const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ["/connexion", "/api/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-aster-pathname", pathname);

  const isLoggedIn = Boolean(req.auth?.user);
  const mustChangePassword = Boolean(
    (req.auth?.user as { mustChangePassword?: boolean } | undefined)
      ?.mustChangePassword,
  );

  if (isPublic(pathname)) {
    if (isLoggedIn && pathname.startsWith("/connexion")) {
      const dest = mustChangePassword
        ? "/changer-mot-de-passe"
        : "/tableau-de-bord";
      return NextResponse.redirect(new URL(dest, req.nextUrl));
    }
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (!isLoggedIn) {
    const url = new URL("/connexion", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (mustChangePassword && !isAllowedDuringPasswordChange(pathname)) {
    return NextResponse.redirect(
      new URL("/changer-mot-de-passe", req.nextUrl),
    );
  }

  if (!mustChangePassword && pathname === "/changer-mot-de-passe") {
    return NextResponse.redirect(new URL("/tableau-de-bord", req.nextUrl));
  }

  const role = String(
    (req.auth?.user as { role?: string } | undefined)?.role ?? "",
  );
  if (
    pathname.startsWith("/administration") &&
    role !== "admin_rh" &&
    role !== "chef_de_projet"
  ) {
    return NextResponse.redirect(new URL("/tableau-de-bord", req.nextUrl));
  }
  if (
    pathname.startsWith("/annuaire") &&
    role !== "admin_rh" &&
    role !== "chef_de_projet"
  ) {
    return NextResponse.redirect(new URL("/profil", req.nextUrl));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
