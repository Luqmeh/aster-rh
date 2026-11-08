import type { NextAuthConfig } from "next-auth";

/**
 * Config Auth.js partagée (edge-compatible) — providers lourds dans auth.ts.
 * trustHost: requis sur Vercel (hôte dérivé de la requête).
 * AUTH_SECRET obligatoire en runtime ; AUTH_URL recommandé (URL canonique HTTPS).
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
  // Aligne Edge middleware et handlers Node sur les cookies `__Secure-*` (Vercel HTTPS).
  useSecureCookies:
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.authProvider = user.authProvider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        session.user.role = token.role ? String(token.role) : undefined;
        session.user.employeeId = token.employeeId
          ? String(token.employeeId)
          : undefined;
        session.user.authProvider = token.authProvider
          ? String(token.authProvider)
          : undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
