import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function FormationsPage() {
  return (
    <PlannedModulePage
      title="Formations"
      description="Catalogue, demandes et suivi du plan de formation."
      bullets={[
        "Catalogue interne et demandes collaborateur.",
        "Validation manager / RH et budget formation.",
        "Attestations et historique des parcours.",
      ]}
    />
  );
}
