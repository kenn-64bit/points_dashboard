// `label ------- value`, with a dashed leader filling the space between.
export function KeyValueRow({
  label,
  value,
  emphasis = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 text-sm">
      <span className={emphasis ? "font-extrabold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span aria-hidden className="min-w-4 flex-1 border-b-2 border-dashed border-line" />
      <span className={`tabular-nums text-foreground ${emphasis ? "font-extrabold" : "font-bold"}`}>{value}</span>
    </div>
  );
}
