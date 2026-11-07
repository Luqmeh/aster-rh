import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-[var(--aster-navy)] text-white",
        secondary: "bg-[var(--aster-surface-2)] text-[var(--aster-ink)]",
        success: "bg-[var(--aster-success-bg)] text-[var(--aster-success)]",
        warning: "bg-[var(--aster-warning-bg)] text-[var(--aster-warning)]",
        danger: "bg-[var(--aster-danger-bg)] text-[var(--aster-danger)]",
        outline:
          "border border-[var(--aster-border-strong)] text-[var(--aster-muted)]",
        accent: "bg-[var(--aster-accent-bg)] text-[var(--aster-accent)]",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
