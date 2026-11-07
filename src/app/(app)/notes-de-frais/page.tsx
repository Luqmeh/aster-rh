import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function NotesDeFraisPage() {
  return (
    <PlannedModulePage
      title="Notes de frais"
      description="Circuit de saisie et validation des frais professionnels."
      bullets={[
        "Saisie collaborateur avec pièces jointes.",
        "Validation manager puis RH / comptabilité.",
        "Préparation d'export vers la paie ou l'ERP.",
      ]}
    />
  );
}
