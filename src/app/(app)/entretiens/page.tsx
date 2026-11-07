import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function EntretiensPage() {
  return (
    <PlannedModulePage
      title="Entretiens et performance"
      description="Campagnes d'entretiens annuels et suivi des objectifs."
      bullets={[
        "Planification des entretiens manager / collaborateur.",
        "Formulaires d'évaluation alignés sur le process RH.",
        "Historique et plans de développement.",
      ]}
    />
  );
}
