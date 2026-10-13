"use client";

import { useState } from "react";
import { TableIcon } from "@/app/connect/icons";

/** The Airtable mark from /brands/airtable.png; falls back to a plain table glyph if the file is missing. */
export function AirtableLogo({ size = 34 }: { size?: number }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <TableIcon size={size} />;
  return <img src="/brands/airtable.png" width={size} height={size} alt="" style={{ borderRadius: 6, objectFit: "contain" }} onError={() => setBroken(true)} />;
}
