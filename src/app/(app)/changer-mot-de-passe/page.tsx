import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--aster-ink)]">
          Changer le mot de passe
        </h1>
        <p className="mt-2 text-sm text-[var(--aster-muted)]">
          Votre compte a été provisionné avec un mot de passe temporaire. Vous
          devez en définir un nouveau avant d&apos;accéder à ASTER.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
