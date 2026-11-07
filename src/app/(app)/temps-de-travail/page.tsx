import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function TempsDeTravailPage() {
  return (
    <PlannedModulePage
      title="Temps de travail"
      description="Suivi du temps, distinction cadre / non-cadre."
      bullets={[
        "Saisie et consultation des temps pour les non-cadres.",
        "Visibilité forfait jours pour les cadres (selon guide RH).",
        "Exports pour contrôle de gestion / paie (intégration future).",
      ]}
    />
  );
}
