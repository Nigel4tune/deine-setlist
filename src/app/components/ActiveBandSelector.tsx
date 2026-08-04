"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  getActiveBandId,
  getUserBands,
  setActiveBand,
  UserBand,
} from "../lib/band";

export default function ActiveBandSelector() {
  const [bands, setBands] = useState<UserBand[]>([]);
  const [activeBandId, setActiveBandIdState] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadBands();
  }, []);

  async function loadBands() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [userBands, selectedBandId] =
        await Promise.all([
          getUserBands(),
          getActiveBandId(),
        ]);

      setBands(userBands);
      setActiveBandIdState(selectedBandId);
    } catch (error) {
      console.error(
        "Bandauswahl konnte nicht geladen werden:",
        error,
      );

      setErrorMessage(
        "Die Bandauswahl konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeBand(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const newBandId = Number(event.target.value);

    if (
      !Number.isFinite(newBandId) ||
      newBandId === activeBandId ||
      isChanging
    ) {
      return;
    }

    setIsChanging(true);
    setErrorMessage("");

    try {
      await setActiveBand(newBandId);
      setActiveBandIdState(newBandId);

      // Alle geöffneten Admin-Daten mit der neuen Band laden.
      window.location.reload();
    } catch (error) {
      console.error(
        "Aktive Band konnte nicht gewechselt werden:",
        error,
      );

      setErrorMessage(
        "Die Band konnte nicht gewechselt werden.",
      );

      setIsChanging(false);
    }
  }

  if (loading) {
    return (
      <div className="mb-5 rounded-2xl border border-white/10 bg-zinc-900 px-5 py-4 text-sm text-zinc-400">
        Bandauswahl wird geladen …
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-950/40 px-5 py-4 text-sm text-red-200">
        {errorMessage}
      </div>
    );
  }

  if (bands.length === 0) {
    return (
      <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-950/30 px-5 py-4 text-sm text-amber-200">
        Für dein Konto wurde keine aktive Band gefunden.
      </div>
    );
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3">
      <label
        htmlFor="activeBand"
        className="shrink-0 text-sm font-bold text-zinc-400"
      >
        🎸 Aktive Band
      </label>

      <select
        id="activeBand"
        value={activeBandId ?? ""}
        onChange={(event) => void changeBand(event)}
        disabled={isChanging}
        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-bold text-white outline-none transition focus:border-red-500 disabled:cursor-wait disabled:text-zinc-500"
      >
        {bands.map((band) => (
          <option key={band.id} value={band.id}>
            {band.name}
          </option>
        ))}
      </select>

      {isChanging && (
        <span className="text-sm font-bold text-zinc-400">
          Wird gewechselt …
        </span>
      )}
    </div>
  );
}