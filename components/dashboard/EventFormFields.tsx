"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_TYPES, EVENT_TYPE_LABELS } from "@/types";
import type { Event, EventType } from "@/types";
import { Label, inputClasses } from "@/components/common/Field";
import { MenuItem, MenuList, MenuPanel, SelectTrigger } from "@/components/common/Select";
import { EventTypeIcon, PASS_CLASSES, eventTypeOf } from "@/components/dashboard/eventType";
import { MAX_EVENT_DESCRIPTION_LENGTH } from "@/lib/validation";

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
    event_name: values.name.trim(),
    event_type: values.type,
    description: values.description.trim() || null,
  };
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
        <Label htmlFor="event-name">Event name</Label>
        <input
          id="event-name"
          autoFocus
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          disabled={disabled}
          placeholder="e.g. September Gaming Night"
          className={inputClasses}
        />
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
          <span className="text-xs tabular-nums text-muted-foreground">
            {values.description.length}/{MAX_EVENT_DESCRIPTION_LENGTH}
          </span>
        </div>
        <textarea
          id="event-description"
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          disabled={disabled}
          maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
          rows={3}
          placeholder="What's this event about?"
          className={`${inputClasses} resize-none`}
        />
      </div>
    </>
  );
}
