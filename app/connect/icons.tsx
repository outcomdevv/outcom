// Small generic glyphs for the Connect page (spreadsheet, output, tag, block). Drawn here, not brand marks.
type P = { size?: number };
const box = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const });

export function SheetIcon({ size = 28 }: P) {
  return <svg {...box(size)}><rect x="3" y="3" width="18" height="18" rx="4" fill="#1f9d63" /><path d="M3 9.5h18M3 15h18M9.5 9.5V21" stroke="#fff" strokeWidth="1.6" /></svg>;
}
export function OutputIcon({ size = 28 }: P) {
  return <svg {...box(size)}><rect x="3" y="3" width="18" height="18" rx="4" fill="#6c55d9" /><path d="M13 6.5 8.5 13h3l-.5 4.5L15.5 11h-3z" fill="#fff" /></svg>;
}
export function TagIcon({ size = 28 }: P) {
  return <svg {...box(size)}><rect x="3" y="3" width="18" height="18" rx="4" fill="#b77a18" /><path d="M7.5 12.2V8.5h3.7l5 5-3.7 3.7z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="9.7" cy="10.4" r=".9" fill="#fff" /></svg>;
}
export function BlockIcon({ size = 28 }: P) {
  return <svg {...box(size)}><rect x="3" y="3" width="18" height="18" rx="4" fill="#8a8d93" /><path d="M8 12h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
export function RecordIcon({ size = 28 }: P) {
  return <svg {...box(size)}><rect x="3" y="3" width="18" height="18" rx="4" fill="#2f6fe0" /><path d="M8 12.3l2.6 2.6L16 9.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
