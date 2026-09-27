type Tone = "neutral" | "accent" | "primary" | "total" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-foreground",
  accent: "bg-accent text-accent-foreground",
  primary: "bg-primary-soft text-foreground",
  total: "bg-total text-total-foreground",
  danger: "bg-danger-soft text-danger-ink",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
