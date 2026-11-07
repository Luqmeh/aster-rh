import { PlannedBanner } from "@/components/ui/planned-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export function PlannedModulePage({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader title={title} description={description} />
      <PlannedBanner moduleName={title} />
      <Card>
        <CardHeader>
          <CardTitle>Périmètre cible</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {bullets.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm leading-relaxed text-[var(--aster-muted)]"
              >
                <span
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--aster-accent)]"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
