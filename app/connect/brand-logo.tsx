"use client";

import { useState } from "react";
import { TableIcon } from "@/app/connect/icons";
import { brandColor, brandUrl, initials } from "@/lib/brand-logos";

/** The Airtable mark from /brands/airtable.png; falls back to a plain table glyph if the file is missing. */
export function AirtableLogo({ size = 34 }: { size?: number }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <TableIcon size={size} />;
  return <img src="/brands/airtable.png" width={size} height={size} alt="" style={{ borderRadius: 6, objectFit: "contain" }} onError={() => setBroken(true)} />;
}

/** A tool or app logo by id, with a coloured initials badge when no logo is available. */
export function BrandLogo({ id, label, size = 30 }: { id: string; label: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const url = brandUrl(id);
  if (!url || broken) {
    return <span aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size / 4), background: brandColor(id), color: "#fff", display: "inline-grid", placeItems: "center", fontWeight: 800, fontSize: Math.round(size * 0.4), flex: "none" }}>{initials(label)}</span>;
  }
  return <img src={url} width={size} height={size} alt="" referrerPolicy="no-referrer" style={{ objectFit: "contain", flex: "none" }} onError={() => setBroken(true)} />;
}
