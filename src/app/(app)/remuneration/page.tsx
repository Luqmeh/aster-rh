import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function RemunerationPage() {
  return (
    <PlannedModulePage
      title="Rémunération et avantages"
      description="Consultation des éléments de rémunération et avantages sociaux."
      bullets={[
        "Consultation d’éléments de rémunération — module non opérationnel.",
        "Pas de génération de bulletins, paie ou CNSS dans ASTER.",
        "Intégrations SIRH / paie externes hors démonstration Conseil.",
      ]}
    />
  );
}
