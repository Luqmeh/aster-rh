import { PlannedModulePage } from "@/components/modules/planned-module-page";

export default function MobilitePage() {
  return (
    <PlannedModulePage
      title="Mobilité interne"
      description="Offres internes et candidatures de mobilité."
      bullets={[
        "Publication d'offres internes (RH).",
        "Candidature collaborateur et suivi.",
        "Visibilité manager selon les règles de confidentialité RH.",
      ]}
    />
  );
}
