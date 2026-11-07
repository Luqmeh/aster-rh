import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aster-accent)]/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--aster-navy)] text-white hover:bg-[var(--aster-navy-soft)]",
        secondary:
          "bg-[var(--aster-surface-2)] text-[var(--aster-ink)] hover:bg-[var(--aster-border)]",
        outline:
          "border border-[var(--aster-border-strong)] bg-white text-[var(--aster-ink)] hover:bg-[var(--aster-surface-2)]",
        ghost: "text-[var(--aster-ink)] hover:bg-[var(--aster-surface-2)]",
        danger: "bg-[var(--aster-danger)] text-white hover:opacity-90",
        accent:
          "bg-[var(--aster-accent)] text-white hover:bg-[var(--aster-accent-soft)]",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-[7px] px-2.5 text-xs",
        lg: "h-10 rounded-[9px] px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
