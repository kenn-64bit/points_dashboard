import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
  secondary: "border border-control-border bg-control text-foreground hover:bg-accent-soft",
  destructive: "bg-danger text-danger-foreground shadow-sm hover:brightness-110",
  ghost: "text-muted-foreground hover:bg-accent-soft hover:text-foreground",
};

export function buttonClasses(variant: Variant = "secondary", className = ""): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-[background-color,color,filter,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${VARIANT_CLASSES[variant]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  return <button {...props} className={buttonClasses(variant, className)} />;
}
