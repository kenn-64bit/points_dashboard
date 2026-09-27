"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_TYPES, EVENT_TYPE_LABELS } from "@/types";
import type { Event, EventType } from "@/types";
import { Label, inputClasses } from "@/components/common/Field";
import { MenuItem, MenuList, MenuPanel, SelectTrigger } from "@/components/common/Select";
import { EventTypeIcon, PASS_CLASSES, eventTypeOf } from "@/components/dashboard/eventType";
import { MAX_EVENT_DESCRIPTION_LENGTH, MAX_EVENT_NAME_LENGTH } from "@/lib/validation";
import { BLOCKED_CHARS_LABEL, cleanText, stripDisallowed } from "@/lib/text";

export interface EventFormValues {
  name: string;
  type: EventType;
  description: string;
}

export const EMPTY_EVENT_FORM: EventFormValues = { name: "", type: "other", description: "" };

export function eventFormValuesOf(event: Event): EventFormValues {
  return { name: event.event_name, type: eventTypeOf(event), description: event.description ?? "" };
}

// Request body for POST /api/events and PUT /api/events/[id].
export function eventFormPayload(values: EventFormValues) {
  return {
    event_name: cleanText(values.name),
    event_type: values.type,
    description: cleanText(values.description, { multiline: true }) || null,
  };
}

// Whether the form can be submitted: a name, within the limit once cleaned.
// (An older event can load with a name longer than today's limit.)
export function isEventFormValid(values: EventFormValues): boolean {
  const name = cleanText(values.name);
  return name.length > 0 && name.length <= MAX_EVENT_NAME_LENGTH;
}

function LengthCounter({ length, max }: { length: number; max: number }) {
  return (
    <span className={`text-xs tabular-nums ${length > max ? "font-bold text-danger" : "text-muted-foreground"}`}>
      {length}/{max}
    </span>
  );
}

function StrippedHint() {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {BLOCKED_CHARS_LABEL} and hidden characters aren&apos;t allowed.
    </p>
  );
}

function TypeSwatch({ type }: { type: EventType }) {
  return (
    <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-full ${PASS_CLASSES[type]}`}>
      <EventTypeIcon type={type} className="h-3.5 w-3.5" />
    </span>
  );
}

// Name, type and description inputs shared by the create and edit forms.
export function EventFormFields({
  values,
  onChange,
  disabled = false,
}: {
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
  disabled?: boolean;
}) {
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  // Which field last had characters removed as the user typed or pasted.
  const [strippedField, setStrippedField] = useState<"name" | "description" | null>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typeMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setTypeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeMenuOpen]);

  return (
    <>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="event-name">Event name</Label>
          <LengthCounter length={values.name.length} max={MAX_EVENT_NAME_LENGTH} />
        </div>
        <input
          id="event-name"
          autoFocus
          value={values.name}
          onChange={(e) => {
            const name = stripDisallowed(e.target.value);
            setStrippedField(name.length < e.target.value.normalize("NFC").length ? "name" : null);
            onChange({ ...values, name });
          }}
          disabled={disabled}
          maxLength={MAX_EVENT_NAME_LENGTH}
          placeholder="e.g. September Gaming Night"
          className={inputClasses}
        />
        {strippedField === "name" && <StrippedHint />}
      </div>

      <div>
        <Label>Event type</Label>
        <div ref={typeMenuRef} className="relative">
          <SelectTrigger
            open={typeMenuOpen}
            onClick={() => setTypeMenuOpen((o) => !o)}
            disabled={disabled}
            aria-label={`Event type: ${EVENT_TYPE_LABELS[values.type]}`}
            className="w-full justify-between rounded-field py-2.5 pl-2.5"
          >
            <span className="flex items-center gap-2.5">
              <TypeSwatch type={values.type} />
              {EVENT_TYPE_LABELS[values.type]}
            </span>
          </SelectTrigger>
          {typeMenuOpen && (
            <MenuPanel className="w-full">
              <MenuList>
                {EVENT_TYPES.map((type) => (
                  <MenuItem
                    key={type}
                    selected={type === values.type}
                    onSelect={() => {
                      onChange({ ...values, type });
                      setTypeMenuOpen(false);
                    }}
                  >
                    <TypeSwatch type={type} />
                    {EVENT_TYPE_LABELS[type]}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPanel>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="event-description">Description (optional)</Label>
          <LengthCounter length={values.description.length} max={MAX_EVENT_DESCRIPTION_LENGTH} />
        </div>
        <textarea
          id="event-description"
          value={values.description}
          onChange={(e) => {
            const description = stripDisallowed(e.target.value, { multiline: true });
            setStrippedField(description.length < e.target.value.normalize("NFC").replace(/\r\n/g, "\n").length ? "description" : null);
            onChange({ ...values, description });
          }}
          disabled={disabled}
          maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
          rows={3}
          placeholder="What's this event about?"
          className={`${inputClasses} resize-none`}
        />
        {strippedField === "description" && <StrippedHint />}
      </div>
    </>
  );
}
