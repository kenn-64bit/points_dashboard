export const inputClasses =
  "w-full rounded-field border border-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary-soft";

export function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold text-muted-foreground">
      {children}
    </label>
  );
}
