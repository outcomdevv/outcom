"use client";

import { useState } from "react";
import { TableIcon } from "@/app/connect/icons";
import { initials, logoChain } from "@/lib/brand-logos";

/** The Airtable mark from /brands/airtable.png; falls back to a plain table glyph if the file is missing. */
export function AirtableLogo({ size = 34 }: { size?: number }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <TableIcon size={size} />;
  return <img src="/brands/airtable.png" width={size} height={size} alt="" style={{ borderRadius: 6, objectFit: "contain" }} onError={() => setBroken(true)} />;
}

/** A tool or app logo by id. Tries the real logo sources in order and shows a plain grey badge only if none loads. */
export function BrandLogo({ id, label, size = 30 }: { id: string; label: string; size?: number }) {
  const chain = logoChain(id);
  const [index, setIndex] = useState(0);
  if (index >= chain.length) {
    return <span aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size / 4), background: "var(--soft, #eef0f3)", color: "var(--muted, #6b7280)", border: "1px solid var(--line, #d9dde3)", display: "inline-grid", placeItems: "center", fontWeight: 800, fontSize: Math.round(size * 0.4), flex: "none" }}>{initials(label)}</span>;
  }
  return <img key={chain[index]} src={chain[index]} width={size} height={size} alt="" referrerPolicy="no-referrer" style={{ objectFit: "contain", flex: "none" }} onError={() => setIndex(i => i + 1)} />;
}
