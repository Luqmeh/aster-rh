import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)] placeholder:text-[var(--aster-muted-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aster-accent)]/35 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
