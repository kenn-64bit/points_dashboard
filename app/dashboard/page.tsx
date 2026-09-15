import { getSupabaseAdmin } from "@/lib/supabase";
import { EventsList } from "@/components/dashboard/EventsList";
import { ErrorState } from "@/components/common/ErrorState";
import type { Event } from "@/types";

export const dynamic = "force-dynamic";

async function loadEvents(): Promise<{ events: Event[] } | { error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    if (error) return { error: error.message };
    return { events: (data ?? []) as Event[] };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export default async function DashboardPage() {
  const result = await loadEvents();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Events</h1>
      {"error" in result ? <ErrorState message={result.error} /> : <EventsList events={result.events} />}
    </div>
  );
}
