import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { authConfig } from "@/auth.config";
import {
  findAccountByEmail,
  findAccountByExternalSubject,
  touchLastLogin,
} from "@/infrastructure/auth/account-store";
import { verifyPassword } from "@/infrastructure/auth/password";
import {
  assertLoginRateLimit,
  clearLoginRateLimit,
} from "@/infrastructure/auth/rate-limit";
import { resolveAuthFeatureFlags } from "@/infrastructure/auth/types";

const flags = resolveAuthFeatureFlags();

const providers: NextAuthConfig["providers"] = [];

if (flags.credentialsEnabled) {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Identifiants ASTER",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const rateKey = `login:${email}`;
        assertLoginRateLimit(rateKey);

        const account = await findAccountByEmail(email);
        if (
          !account ||
          !account.isActive ||
          account.authProvider !== "credentials" ||
          !account.passwordHash
        ) {
          return null;
        }

        const valid = await verifyPassword(password, account.passwordHash);
        if (!valid) return null;

        clearLoginRateLimit(rateKey);
        await touchLastLogin(account.id);

        return {
          id: account.id,
          email: account.email,
          role: account.role,
          employeeId: account.employeeId,
          authProvider: "credentials" as const,
        };
      },
    }),
  );
}

if (flags.entraEnabled) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
      authorization: {
        params: {
          scope: "openid profile email offline_access User.Read",
        },
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "microsoft-entra-id") {
        const email = user.email?.trim().toLowerCase();
        const subject = account.providerAccountId;
        if (!email || !subject) return false;

        const bySubject = await findAccountByExternalSubject(subject);
        const byEmail = bySubject ?? (await findAccountByEmail(email));
        if (!byEmail || !byEmail.isActive) {
          // Pas d'auto-inscription / pas d'auto-attribution de rôle.
          return false;
        }
        user.id = byEmail.id;
        (user as { role?: string }).role = byEmail.role;
        (user as { employeeId?: string }).employeeId = byEmail.employeeId;
        (user as { authProvider?: string }).authProvider = "entra_id";
        await touchLastLogin(byEmail.id);
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role;
        token.employeeId = (user as { employeeId?: string }).employeeId;
        token.authProvider = (user as { authProvider?: string }).authProvider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        (session.user as { role?: string }).role = String(token.role ?? "");
        (session.user as { employeeId?: string }).employeeId = String(
          token.employeeId ?? "",
        );
        (session.user as { authProvider?: string }).authProvider = String(
          token.authProvider ?? "credentials",
        );
      }
      return session;
    },
  },
});
