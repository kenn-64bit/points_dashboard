// Olive summary tile for sums, split by a dashed rule.
export function TotalTile({
  value,
  label = "Total",
  className = "",
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-28 rounded-field bg-total px-4 py-2 text-total-foreground ${className}`}>
      <div className="text-xs font-bold">{label}</div>
      <div aria-hidden className="my-1 border-t border-dashed border-total-foreground/40" />
      <div className="text-right text-2xl font-extrabold leading-none tabular-nums">{value.toLocaleString("en-US")}</div>
    </div>
  );
}
