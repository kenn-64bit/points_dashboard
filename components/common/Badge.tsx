type Tone = "neutral" | "accent" | "danger" | "inverse";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-foreground",
  accent: "bg-gradient-to-br from-accent-from to-accent-to text-accent-foreground",
  danger: "bg-danger-soft text-danger",
  inverse: "bg-foreground text-background",
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
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
