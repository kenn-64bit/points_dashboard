import { EVENT_TYPES, EVENT_TYPE_LABELS } from "@/types";
import type { Event, EventType } from "@/types";

// Card fill + ink per event type (tokens in globals.css). Written out in full
// so Tailwind can see every class name.
export const PASS_CLASSES: Record<EventType, string> = {
  game_night: "bg-pass-game-night text-pass-game-night-ink",
  tournament: "bg-pass-tournament text-pass-tournament-ink",
  challenge: "bg-pass-challenge text-pass-challenge-ink",
  giveaway: "bg-pass-giveaway text-pass-giveaway-ink",
  community: "bg-pass-community text-pass-community-ink",
  other: "bg-pass-other text-pass-other-ink",
};

// Events created before types existed (or an unknown value) read as "other".
export function eventTypeOf(event: Pick<Event, "event_type">): EventType {
  return EVENT_TYPES.includes(event.event_type) ? event.event_type : "other";
}

export function EventTypePill({ type, className = "" }: { type: EventType; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${PASS_CLASSES[type]} ${className}`}>
      {EVENT_TYPE_LABELS[type]}
    </span>
  );
}

const ICON_PATHS: Record<EventType, React.ReactNode> = {
  game_night: (
    <>
      <path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.9 4a2.5 2.5 0 0 1-4.3 1.1L14 16h-4l-1.7 2a2.5 2.5 0 0 1-4.3-1.1l-.9-4A4 4 0 0 1 7 8Z" />
      <path d="M8 10.5v3.5M6.25 12.25h3.5" />
      <circle cx="15.5" cy="11.25" r="0.6" fill="currentColor" />
      <circle cx="17.25" cy="13.25" r="0.6" fill="currentColor" />
    </>
  ),
  tournament: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.5a2.75 2.75 0 0 0 2.9 4.1M16 6h2.5a2.75 2.75 0 0 1-2.9 4.1" />
      <path d="M12 13v4M9 20h6M10 17h4v3h-4z" />
    </>
  ),
  challenge: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.5 4 2.5 4H6" />
    </>
  ),
  giveaway: (
    <>
      <path d="M4.5 10.5h15V20h-15zM3.5 7.5h17v3h-17zM12 7.5V20" />
      <path d="M12 7.5c-1.5-3-5-3.2-5-1.25S10 7.5 12 7.5Zm0 0c1.5-3 5-3.2 5-1.25S14 7.5 12 7.5Z" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M15.5 14.1a4.5 4.5 0 0 1 5 4.9" />
    </>
  ),
  other: <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />,
};

export function EventTypeIcon({ type, className = "h-5 w-5" }: { type: EventType; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {ICON_PATHS[type]}
    </svg>
  );
}
