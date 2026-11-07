import { cn } from "@/lib/utils";

export function UserAvatar({
  initials,
  size = "md",
  className,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs";
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[var(--aster-navy)] font-semibold text-white",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
