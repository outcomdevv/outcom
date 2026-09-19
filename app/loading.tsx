export default function Loading() {
  return <div className="outcom-loading" role="status" aria-live="polite"><div className="outcom-loading-orb"><img src="/outcom-mascot.png" alt="" /></div><strong>Outcom is checking the outcome<span className="loading-dots" aria-hidden="true">...</span></strong><small>Preparing your workspace</small></div>;
}
