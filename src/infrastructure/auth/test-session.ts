import { employees } from "@/data/demo-seed";
import type { DemoRole } from "@/domain/types/hr";
import type { AuthSession } from "@/infrastructure/auth/types";

/** Session de test — ne pas utiliser en runtime. */
export function testSessionFor(
  employeeId: string,
  role: DemoRole,
): AuthSession {
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) throw new Error(`Employé démo introuvable: ${employeeId}`);
  return {
    userId: `user-${employeeId}`,
    email: employee.email,
    employee,
    role,
    authProvider: "credentials",
    isDemoMode: true,
  };
}
