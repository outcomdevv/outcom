"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The layout is not rendered again when you move between pages, so a count printed by the layout goes stale.
 * This reads the count again after every page change.
 */
export default function OpenFindings({ initial, variant }: { initial: number; variant: "badge" | "status" }) {
  const pathname = usePathname();
  const [count, setCount] = useState(initial);
  useEffect(() => {
    let stop = false;
    fetch("/api/findings/count", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!stop && j && typeof j.open === "number") setCount(j.open); })
      .catch(() => {});
    return () => { stop = true; };
  }, [pathname]);
  if (variant === "badge") return count > 0 ? <em className="nav-count">{count}</em> : null;
  return <>{count ? `${count} finding${count === 1 ? "" : "s"} need attention` : "All protected outcomes healthy"}</>;
}
