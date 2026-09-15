import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-accent-from to-accent-to text-accent-foreground hover:brightness-110",
  secondary: "border border-border bg-surface-muted text-foreground hover:bg-accent-soft",
  destructive: "bg-danger text-danger-foreground hover:brightness-110",
  ghost: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
};

export function buttonClasses(variant: Variant = "secondary", className = ""): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  return <button {...props} className={buttonClasses(variant, className)} />;
}
