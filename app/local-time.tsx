"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** Shows a time in the viewer's own time zone. The server renders UTC first, then the browser swaps in local time. */
export default function LocalTime({ iso, fallback = "Unknown time" }: { iso?: string | null; fallback?: string }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : fallback; },
    () => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? `${d.toLocaleString("en-US", { timeZone: "UTC" })} UTC` : fallback; },
  );
  return <time dateTime={iso ?? undefined}>{text}</time>;
}
