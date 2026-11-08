import type { NextAuthConfig } from "next-auth";

/**
 * Config Auth.js partagée (edge-compatible) — providers lourds dans auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  providers: [],
  trustHost: true,
} satisfies NextAuthConfig;
