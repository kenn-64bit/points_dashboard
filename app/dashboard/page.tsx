import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePageUser } from "@/lib/auth/dal";
import { EventsList } from "@/components/dashboard/EventsList";
import { ErrorState } from "@/components/common/ErrorState";
import type { Event } from "@/types";

export const dynamic = "force-dynamic";

async function loadEvents(): Promise<{ events: Event[] } | { error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return { events: (data ?? []) as Event[] };
  } catch (err) {
    // Logged here; the page shows a generic message rather than raw DB text.
    console.error(err);
    return { error: "Couldn't load events. Please try again." };
  }
}

export default async function DashboardPage() {
  await requirePageUser();
  const result = await loadEvents();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Events</h1>
      {"error" in result ? <ErrorState message={result.error} /> : <EventsList events={result.events} />}
    </div>
  );
}
