import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function RemunerationPage() {
  return (
    <PlannedModulePage
      title="Rémunération et avantages"
      description="Consultation des éléments de rémunération et avantages sociaux."
      bullets={[
        "Bulletin de paie (lien vers système paie — non branché).",
        "Avantages (mutuelle, tickets, intéressement) selon politiques RH.",
        "Confidentialité stricte — hors périmètre de la démo actuelle.",
      ]}
    />
  );
}
