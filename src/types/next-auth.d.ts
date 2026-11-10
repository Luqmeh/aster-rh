import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: string;
      employeeId?: string;
      authProvider?: string;
      mustChangePassword?: boolean;
    };
  }

  interface User {
    role?: string;
    employeeId?: string;
    authProvider?: string;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    employeeId?: string;
    authProvider?: string;
    mustChangePassword?: boolean;
  }
}
