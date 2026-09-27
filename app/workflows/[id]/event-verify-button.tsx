"use client";

import { useState } from "react";

export function EventVerifyButton({ eventId, initialState }: { eventId: string; initialState: "verified" | "finding" }) {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function verify() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/verify`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Verification failed.");
      setState(body.verified ? "verified" : "finding");
      setMessage(body.verified ? "Verified" : "Finding remains open");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="event-verify-control">
      <span className={state === "verified" ? "badge healthy" : "badge unknown"}>{state === "verified" ? "Verified" : "Finding"}</span>
      <button type="button" className="text-button" onClick={verify} disabled={loading}>
        {loading ? "Checking…" : "Verify again"}
      </button>
      {message && message !== "Verified" && <small>{message}</small>}
    </span>
  );
}
