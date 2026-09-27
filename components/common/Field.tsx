export const inputClasses =
  "w-full rounded-field border border-control-border bg-control px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary-ink focus:ring-2 focus:ring-primary-soft";

export function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold text-muted-foreground">
      {children}
    </label>
  );
}

// Swap in for inputClasses while a field is invalid (pair with aria-invalid).
export const inputErrorClasses =
  "w-full rounded-field border border-danger-ink bg-danger-soft px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-danger-ink focus:ring-2 focus:ring-danger-soft";

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-bold text-danger-ink">
      {children}
    </p>
  );
}
