import type { ReactNode } from "react";

type Props = { message?: string; subtext?: string; inline?: boolean; children?: ReactNode };

export default function LoadingScreen({ message = "Outcom is checking the outcome", subtext = "Preparing your workspace", inline = false, children }: Props) {
  if (inline) {
    return <span className="outcom-loading-inline" role="status" aria-live="polite"><span className="outcom-loading-mini-orb"><img src="/outcom-mascot.png" alt="" /></span><span>{children || message}</span></span>;
  }
  return <div className="outcom-loading" role="status" aria-live="polite"><div className="outcom-loading-orb"><img src="/outcom-mascot.png" alt="" /></div><strong>{message}<span className="loading-dots" aria-hidden="true">...</span></strong><small>{subtext}</small></div>;
}
