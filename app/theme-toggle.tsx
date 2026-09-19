"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("outcom-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const nextDark = saved ? saved === "dark" : prefersDark;
    setDark(nextDark);
    document.documentElement.classList.toggle("theme-dark", nextDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("theme-dark", next);
    window.localStorage.setItem("outcom-theme", next ? "dark" : "light");
  }

  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}><span aria-hidden="true">{dark ? "☀" : "☾"}</span><b>{dark ? "Light" : "Dark"}</b></button>;
}
