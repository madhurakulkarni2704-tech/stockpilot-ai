const config = require("../config");

const isEnabled = () => Boolean(config.anthropicKey);

// Minimal Anthropic Messages API client (Node 18+ has global fetch).
async function complete({ system, prompt, maxTokens = 600 }) {
  if (!isEnabled()) throw new Error("LLM disabled");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": config.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) throw new Error("Empty LLM response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { isEnabled, complete };
