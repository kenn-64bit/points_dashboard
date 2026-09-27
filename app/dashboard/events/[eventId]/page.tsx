import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePageUser } from "@/lib/auth/dal";
import { EventWorkspace } from "@/components/dashboard/EventWorkspace";
import { ErrorState } from "@/components/common/ErrorState";
import { buttonClasses } from "@/components/common/Button";
import { loadWeekPoints } from "@/lib/weekPoints";
import { loadEventWeeks } from "@/lib/eventData";
import { isValidUUID } from "@/lib/validation";
import { getCurrentWeekMonday } from "@/lib/week";
import type { Event, PointsTableRow } from "@/types";

export const dynamic = "force-dynamic";

async function loadEvent(eventId: string): Promise<{ event: Event } | { error: string } | { notFound: true }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").select("*").eq("event_id", eventId).maybeSingle();
    if (error) throw error;
    if (!data) return { notFound: true };
    return { event: data as Event };
  } catch (err) {
    // Logged here; the page shows a generic message rather than raw DB text.
    console.error(err);
    return { error: "Couldn't load this event. Please try again." };
  }
}

async function loadWeeks(eventId: string): Promise<string[]> {
  try {
    return await loadEventWeeks(eventId);
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Server-rendered first week, so the table arrives with the page. The client
// refetches only if its local "current week" differs (see EventWorkspace).
async function loadInitialPoints(eventId: string, weekDate: string): Promise<PointsTableRow[] | null> {
  try {
    return await loadWeekPoints(eventId, weekDate);
  } catch (err) {
    console.error(err);
    return null;
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  await requirePageUser();
  const { eventId } = await params;
  if (!isValidUUID(eventId)) notFound();

  const initialWeek = getCurrentWeekMonday();
  const [result, weeks, initialRows] = await Promise.all([
    loadEvent(eventId),
    loadWeeks(eventId),
    loadInitialPoints(eventId, initialWeek),
  ]);

  if ("notFound" in result) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className={buttonClasses("ghost", "mb-4")}>
        ← Back to events
      </Link>
      {"error" in result ? (
        <ErrorState message={result.error} />
      ) : (
        <EventWorkspace event={result.event} weeks={weeks} initialWeek={initialWeek} initialRows={initialRows} />
      )}
    </div>
  );
}
