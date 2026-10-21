"use client";
export default function PrintButton() {
  return <button type="button" className="proof-print" onClick={() => window.print()}>Save as PDF</button>;
}
