import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EventWorkspace } from "@/components/dashboard/EventWorkspace";
import { DeleteEventButton } from "@/components/dashboard/DeleteEventButton";
import { ExportEventButton } from "@/components/dashboard/ExportEventButton";
import { ErrorState } from "@/components/common/ErrorState";
import { buttonClasses } from "@/components/common/Button";
import type { Event } from "@/types";

export const dynamic = "force-dynamic";

async function loadEvent(eventId: string): Promise<{ event: Event } | { error: string } | { notFound: true }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").select("*").eq("event_id", eventId).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { notFound: true };
    return { event: data as Event };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function loadWeeks(eventId: string): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("points")
      .select("week_date")
      .eq("event_id", eventId)
      .order("week_date", { ascending: false });
    if (error) return [];
    return [...new Set((data ?? []).map((row) => row.week_date as string))];
  } catch {
    return [];
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [result, weeks] = await Promise.all([loadEvent(eventId), loadWeeks(eventId)]);

  if ("notFound" in result) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className={buttonClasses("ghost", "mb-4")}>
        ← Back to events
      </Link>
      {"error" in result ? (
        <ErrorState message={result.error} />
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {result.event.event_name}
            </h1>
            <Link href={`/dashboard/events/${eventId}/leaderboard`} className={buttonClasses("secondary")}>
              Leaderboard
            </Link>
          </div>
          <EventWorkspace eventId={eventId} />
          <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
            <ExportEventButton eventId={eventId} weeks={weeks} />
            <DeleteEventButton eventId={eventId} eventName={result.event.event_name} />
          </div>
        </>
      )}
    </div>
  );
}
