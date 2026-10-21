"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Reliability, Evidence and the shareable Proof report are views of the same proof, so they share one menu item. */
export default function ReportsTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/reliability", label: "Reliability", hint: "Did the results happen?" },
    { href: "/evidence", label: "Evidence", hint: "The proof behind each finding" },
    { href: "/proof", label: "Proof report", hint: "A report to share with a client" },
  ];
  return (
    <div className="reports-tabs" role="tablist" aria-label="Reports">
      {tabs.map((t) => <Link key={t.href} href={t.href} role="tab" aria-selected={pathname === t.href} className={pathname === t.href ? "active" : ""}><b>{t.label}</b><small>{t.hint}</small></Link>)}
    </div>
  );
}
