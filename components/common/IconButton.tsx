import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Tone = "neutral" | "danger";
type TooltipAlign = "center" | "end";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border border-border bg-surface-muted text-foreground hover:bg-accent-soft",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-danger-foreground",
};

function iconButtonClasses(tone: Tone, className: string): string {
  return `group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${TONE_CLASSES[tone]} ${className}`;
}

// The action's name, floating above the icon on hover or keyboard focus. The
// accessible name comes from aria-label, so this is visual only. `end` pins
// it to the icon's right edge for icons at the edge of the page.
function Tooltip({ label, align }: { label: string; align: TooltipAlign }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute bottom-full z-30 mb-2 translate-y-1 whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background opacity-0 shadow-panel transition-[opacity,translate] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${
        align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
      }`}
    >
      {label}
    </span>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: Tone;
  tooltipAlign?: TooltipAlign;
}

export function IconButton({
  label,
  tone = "neutral",
  tooltipAlign = "center",
  className = "",
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button {...props} type={type} aria-label={label} className={iconButtonClasses(tone, className)}>
      {children}
      <Tooltip label={label} align={tooltipAlign} />
    </button>
  );
}

export function IconLink({
  href,
  label,
  tone = "neutral",
  tooltipAlign = "center",
  className = "",
  children,
}: {
  href: string;
  label: string;
  tone?: Tone;
  tooltipAlign?: TooltipAlign;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-label={label} className={iconButtonClasses(tone, className)}>
      {children}
      <Tooltip label={label} align={tooltipAlign} />
    </Link>
  );
}
