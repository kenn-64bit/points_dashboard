import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePageUser } from "@/lib/auth/dal";
import { EventWorkspace } from "@/components/dashboard/EventWorkspace";
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
  await requirePageUser();
  const { eventId } = await params;
  const [result, weeks] = await Promise.all([loadEvent(eventId), loadWeeks(eventId)]);

  if ("notFound" in result) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className={buttonClasses("ghost", "mb-4")}>
        ← Back to events
      </Link>
      {"error" in result ? (
        <ErrorState message={result.error} />
      ) : (
        <EventWorkspace event={result.event} weeks={weeks} />
      )}
    </div>
  );
}
