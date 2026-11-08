import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

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

  const isLoggedIn = Boolean(req.auth?.user);

  if (isPublic(pathname)) {
    if (isLoggedIn && pathname.startsWith("/connexion")) {
      return NextResponse.redirect(new URL("/tableau-de-bord", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const url = new URL("/connexion", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
