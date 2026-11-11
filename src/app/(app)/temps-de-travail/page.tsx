import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function TempsDeTravailPage() {
  return (
    <PlannedModulePage
      title="Temps de travail"
      description="Module non opérationnel — suivi du temps de travail."
      bullets={[
        "Saisie et consultation du temps — à construire.",
        "Le suivi du travail un jour férié et de la récupération est déjà disponible via Calendrier RH / Administration.",
        "Pas d’intégration paie / CNSS dans ASTER.",
      ]}
    />
  );
}
