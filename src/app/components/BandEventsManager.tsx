"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { createClient } from "../lib/client";

type BandEvent = {
  id: number;
  title: string | null;
  event_date: string;
  venue: string;
  location: string | null;
  ticket_url: string | null;
  is_visible: boolean;
};

export default function BandEventsManager({
  bandId,
}: {
  bandId: number;
}) {
  const [events, setEvents] = useState<BandEvent[]>([]);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [changingEventId, setChangingEventId] =
    useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("band_events")
      .select(
        "id, title, event_date, venue, location, ticket_url, is_visible",
      )
      .eq("band_id", bandId)
      .order("event_date", { ascending: true });

    if (error) {
      console.error(
        "Konzerte konnten nicht geladen werden:",
        error,
      );
      setErrorMessage(
        "Die Konzertliste konnte nicht geladen werden.",
      );
      setLoading(false);
      return;
    }

    setEvents((data ?? []) as BandEvent[]);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function addEvent() {
    if (!eventDate || !venue.trim() || isAdding) {
      return;
    }

    const parsedDate = new Date(eventDate);

    if (Number.isNaN(parsedDate.getTime())) {
      setErrorMessage(
        "Bitte gib ein gültiges Datum mit Uhrzeit ein.",
      );
      return;
    }

    setIsAdding(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("band_events")
      .insert({
        band_id: bandId,
        title: title.trim() || null,
        event_date: parsedDate.toISOString(),
        venue: venue.trim(),
        location: location.trim() || null,
        ticket_url: ticketUrl.trim() || null,
        is_visible: true,
      })
      .select(
        "id, title, event_date, venue, location, ticket_url, is_visible",
      )
      .single();

    if (error) {
      console.error(
        "Konzert konnte nicht hinzugefügt werden:",
        error,
      );
      setErrorMessage(
        "Das Konzert konnte nicht hinzugefügt werden.",
      );
      setIsAdding(false);
      return;
    }

    setEvents((currentEvents) =>
      [...currentEvents, data as BandEvent].sort(
        (a, b) =>
          new Date(a.event_date).getTime() -
          new Date(b.event_date).getTime(),
      ),
    );

    setTitle("");
    setEventDate("");
    setVenue("");
    setLocation("");
    setTicketUrl("");
    setSuccessMessage(
      "Das Konzert wurde hinzugefügt.",
    );
    setIsAdding(false);
  }

  async function toggleVisibility(
    bandEvent: BandEvent,
  ) {
    if (changingEventId !== null) {
      return;
    }

    setChangingEventId(bandEvent.id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("band_events")
      .update({
        is_visible: !bandEvent.is_visible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bandEvent.id)
      .eq("band_id", bandId);

    if (error) {
      setErrorMessage(
        "Die Sichtbarkeit konnte nicht geändert werden.",
      );
      setChangingEventId(null);
      return;
    }

    setEvents((currentEvents) =>
      currentEvents.map((currentEvent) =>
        currentEvent.id === bandEvent.id
          ? {
              ...currentEvent,
              is_visible: !currentEvent.is_visible,
            }
          : currentEvent,
      ),
    );

    setSuccessMessage(
      bandEvent.is_visible
        ? "Das Konzert wurde ausgeblendet."
        : "Das Konzert wird wieder öffentlich angezeigt.",
    );
    setChangingEventId(null);
  }

  async function deleteEvent(
    bandEvent: BandEvent,
  ) {
    if (
      changingEventId !== null ||
      !window.confirm(
        "Möchtest du dieses Konzert wirklich löschen?",
      )
    ) {
      return;
    }

    setChangingEventId(bandEvent.id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("band_events")
      .delete()
      .eq("id", bandEvent.id)
      .eq("band_id", bandId);

    if (error) {
      setErrorMessage(
        "Das Konzert konnte nicht gelöscht werden.",
      );
      setChangingEventId(null);
      return;
    }

    setEvents((currentEvents) =>
      currentEvents.filter(
        (currentEvent) =>
          currentEvent.id !== bandEvent.id,
      ),
    );
    setSuccessMessage(
      "Das Konzert wurde gelöscht.",
    );
    setChangingEventId(null);
  }

  function formatEventDate(value: string) {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl sm:p-8">
      <h2 className="text-2xl font-black">
        Kommende Konzerte
      </h2>

      <p className="mt-2 text-sm text-zinc-400">
        Trage Termine ein, die auf der öffentlichen
        Bandseite angezeigt werden sollen.
      </p>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 px-5 py-4 text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-2xl border border-green-500/40 bg-green-950/40 px-5 py-4 text-green-200">
          {successMessage}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          id="eventTitle"
          label="Veranstaltungstitel"
          value={title}
          onChange={setTitle}
          placeholder="Optional, z. B. Sommerfest"
        />

        <div>
          <label
            htmlFor="eventDate"
            className="text-sm font-bold text-zinc-300"
          >
            Datum und Uhrzeit
          </label>
          <input
            id="eventDate"
            type="datetime-local"
            value={eventDate}
            onChange={(event) =>
              setEventDate(event.target.value)
            }
            required
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-red-500"
          />
        </div>

        <Field
          id="eventVenue"
          label="Veranstaltungsort"
          value={venue}
          onChange={setVenue}
          placeholder="z. B. Roxy Concerts"
          required
        />

        <Field
          id="eventLocation"
          label="Ort oder Adresse"
          value={location}
          onChange={setLocation}
          placeholder="Optional, z. B. Flensburg"
        />

        <div className="sm:col-span-2">
          <label
            htmlFor="eventTicketUrl"
            className="text-sm font-bold text-zinc-300"
          >
            Ticketlink
          </label>
          <input
            id="eventTicketUrl"
            type="url"
            value={ticketUrl}
            onChange={(event) =>
              setTicketUrl(event.target.value)
            }
            placeholder="Optional, https://..."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void addEvent()}
          disabled={
            !eventDate ||
            !venue.trim() ||
            isAdding
          }
          className="rounded-2xl bg-red-600 px-6 py-4 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:col-span-2 sm:w-fit"
        >
          {isAdding
            ? "Konzert wird hinzugefügt …"
            : "Konzert hinzufügen"}
        </button>
      </div>

      <div className="mt-8 space-y-3">
        {loading ? (
          <div className="text-zinc-400">
            Konzertliste wird geladen …
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center text-zinc-500">
            Noch keine Konzerte eingetragen.
          </div>
        ) : (
          events.map((bandEvent) => {
            const isChanging =
              changingEventId === bandEvent.id;

            return (
              <article
                key={bandEvent.id}
                className={`rounded-2xl border p-5 ${
                  bandEvent.is_visible
                    ? "border-white/10 bg-black/20"
                    : "border-white/5 bg-black/10 opacity-60"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-white">
                      {bandEvent.title ||
                        bandEvent.venue}
                    </p>

                    <p className="mt-2 text-sm text-zinc-300">
                      📅{" "}
                      {formatEventDate(
                        bandEvent.event_date,
                      )}
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      📍 {bandEvent.venue}
                      {bandEvent.location
                        ? ` · ${bandEvent.location}`
                        : ""}
                    </p>

                    <p className="mt-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                      {bandEvent.is_visible
                        ? "Öffentlich sichtbar"
                        : "Ausgeblendet"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void toggleVisibility(
                          bandEvent,
                        )
                      }
                      disabled={isChanging}
                      className="rounded-xl bg-zinc-700 px-4 py-3 text-sm font-bold transition hover:bg-zinc-600 disabled:opacity-50"
                    >
                      {bandEvent.is_visible
                        ? "Ausblenden"
                        : "Einblenden"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteEvent(bandEvent)
                      }
                      disabled={isChanging}
                      className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
};

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-bold text-zinc-300"
      >
        {label}
      </label>

      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
        placeholder={placeholder}
      />
    </div>
  );
}