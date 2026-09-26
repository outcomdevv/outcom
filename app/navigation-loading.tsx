"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LoadingScreen from "@/app/loading-screen";

export default function NavigationLoading() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Node | null;
      const element = target instanceof Element ? target : target?.parentElement;
      const link = element?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setLoading(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!loading) return null;
  return <div className="outcom-navigation-loading"><LoadingScreen message="Outcom is opening the workspace" subtext="Loading the next view" /></div>;
}
