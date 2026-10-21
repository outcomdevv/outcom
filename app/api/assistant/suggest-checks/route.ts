import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { decryptSecret } from "@/lib/oauth";
import { MAX_DESCRIPTION, SUGGEST_SCHEMA, localSuggestions, sanitizeSuggestions, suggestionPrompt } from "@/lib/check-suggestions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let store;
  try { store = await getWorkspaceStore(); } catch { return NextResponse.json({ error: "Sign in required." }, { status: 401 }); }
  try {
    const body = await request.json().catch(() => ({}));
    const description = String(body.description ?? "").trim().slice(0, MAX_DESCRIPTION);
    if (description.length < 8) return NextResponse.json({ error: "Describe the workflow in a sentence or two." }, { status: 400 });

    const settings = await store.settings.get();
    const key = settings.groqApiKeyEncrypted ? decryptSecret(settings.groqApiKeyEncrypted) : null;
    if (!key) return NextResponse.json({ suggestions: localSuggestions(description), mode: "local" });

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: settings.groqModel || "openai/gpt-oss-120b",
          messages: [{ role: "system", content: "Return only the requested JSON object." }, { role: "user", content: suggestionPrompt(description) }],
          temperature: 0.1,
          response_format: { type: "json_schema", json_schema: { name: "check_suggestions", strict: true, schema: SUGGEST_SCHEMA } },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`AI provider ${response.status}`);
      const data = await response.json();
      const suggestions = sanitizeSuggestions(JSON.parse(data.choices?.[0]?.message?.content || "{}"));
      if (!suggestions.length) return NextResponse.json({ suggestions: localSuggestions(description), mode: "local", note: "The AI returned nothing usable, so these are the basic checks." });
      return NextResponse.json({ suggestions, mode: "groq" });
    } catch {
      return NextResponse.json({ suggestions: localSuggestions(description), mode: "local", note: "The AI provider did not answer, so these are the basic checks." });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not suggest checks." }, { status: 500 });
  }
}
