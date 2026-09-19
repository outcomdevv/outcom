"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };
type Reply = Message & { action?: string; path?: string | null };

const suggestions = [
  "Show me what needs attention",
  "Open my workflows",
  "Connect n8n",
  "What should I do first?",
  "What can you check?",
];

export default function OperatorAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"unknown" | "local" | "ai">("unknown");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey — I’m Operator. Tell me what you want to see or investigate and I’ll take you there." },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 30);
      }
      if (event.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(value = input) {
    const text = value.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history: next.slice(-8) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Assistant unavailable");
      setMode(data.mode === "local" || data.mode === "local-fallback" ? "local" : "ai");
      const reply: Reply = { role: "assistant", content: data.message || "Done." , action: data.action, path: data.path };
      setMessages((current) => [...current, reply]);
      if (data.action === "refresh") router.refresh();
      if (data.path) {
        setTimeout(() => {
          setOpen(false);
          router.push(data.path);
        }, 350);
      }
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className={`operator-fab ${open ? "active" : ""}`} onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30); }} aria-label="Open Outcom Operator">
      <span className="operator-spark"><img src="/outcom-operator.png" alt="" /></span><span>Ask Operator</span><kbd>⌘K</kbd>
    </button>

    {open && <div className="operator-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="operator-panel" role="dialog" aria-label="Outcom Operator">
        <header className="operator-header">
          <div className="operator-title"><span className="operator-avatar"><img src="/outcom-operator.png" alt="Operator" /></span><div><strong>Operator</strong><small>Outcom workspace assistant · {mode === "local" ? "Local mode" : mode === "ai" ? "AI mode" : "Ready"}</small></div></div>
          <button className="operator-close" onClick={() => setOpen(false)}>Esc</button>
        </header>
        <div className="operator-messages" ref={scrollRef}>
          {messages.map((message, index) => <div className={`operator-message ${message.role}`} key={`${index}-${message.content}`}><span>{message.content}</span>{message.role === "assistant" && index === messages.length - 1 && (message as Reply).path && <small>Opening it…</small>}</div>)}
          {busy && <div className="operator-message assistant typing"><span><i/> <i/> <i/></span></div>}
        </div>
        {messages.length === 1 && <div className="operator-suggestions">{suggestions.map((item) => <button key={item} onClick={() => send(item)}>{item}<span>→</span></button>)}</div>}
        <div className="operator-input-wrap">
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Ask Outcom to find, explain, or open something…" disabled={busy}/>
          <button onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send">↑</button>
        </div>
        <div className="operator-footer"><span>{mode === "local" ? "Local command mode is active — no Groq key required. Add Groq later for natural-language reasoning." : "AI can navigate and explain. Changes still require your confirmation."}</span><span>Ctrl / ⌘ K</span></div>
      </section>
    </div>}
  </>;
}
