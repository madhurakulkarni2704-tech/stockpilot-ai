import { useEffect, useRef, useState } from "react";
import api, { errMsg } from "../api";
import { useToast } from "../context/ToastContext";
import { Empty, RiskBadge, Spinner } from "../components/ui";
import { money, num } from "../lib/format";

const TREND = { rising: "Rising", falling: "Falling", stable: "Steady", none: "No sales" };
const SUGGESTIONS = ["What should I reorder this week?", "Which items are out of stock?", "Which products sell fastest?", "What is my total inventory value?", "Show value by category"];

export default function Insights() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [onlyAction, setOnlyAction] = useState(true);

  useEffect(() => {
    api.get("/ai/insights").then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!data) return <Spinner label="Analysing sales" />;
  const rows = onlyAction ? data.items.filter((i) => i.suggestedReorder > 0 || i.risk === "critical" || i.risk === "high") : data.items;
  const s = data.summary;
  const a = data.assumptions;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>AI insights</h1>
          <p className="muted">{data.headline}</p>
        </div>
      </header>

      <section className="stat-grid four">
        <div className={`card stat ${s.critical ? "red" : ""}`}><span className="muted">Critical</span><strong className="mono">{s.critical}</strong><small className="muted">Out or under 3 days left</small></div>
        <div className={`card stat ${s.high ? "amber" : ""}`}><span className="muted">Runs out before delivery</span><strong className="mono">{s.high}</strong><small className="muted">Under {a.LEAD_TIME_DAYS} days left</small></div>
        <div className="card stat"><span className="muted">Suggested units to order</span><strong className="mono">{num(s.totalSuggestedUnits)}</strong></div>
        <div className="card stat"><span className="muted">Estimated reorder cost</span><strong className="mono">{money(s.estimatedReorderCost)}</strong></div>
      </section>

      <div className="card flush">
        <div className="card-head">
          <div>
            <h3>Reorder forecast</h3>
            <p className="muted small">Based on 30 days of sales, weighted towards the last 15 days. Assumes a {a.LEAD_TIME_DAYS}-day supplier lead time and {a.COVER_DAYS} days of cover per order.</p>
          </div>
          <label className="check"><input type="checkbox" checked={onlyAction} onChange={(e) => setOnlyAction(e.target.checked)} /> Only items needing action</label>
        </div>
        {rows.length === 0 ? (
          <Empty title="Nothing needs reordering" hint="Every product has enough stock for the coming weeks." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>Risk</th><th>In stock</th><th>Sells per day</th><th>Days left</th><th>Demand</th><th>Order</th><th>Est. cost</th></tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.productId}>
                    <td><strong>{i.name}</strong><div className="muted small">{i.reason}</div></td>
                    <td><RiskBadge risk={i.risk} /></td>
                    <td className="mono">{i.quantity}</td>
                    <td className="mono">{i.avgDailyDemand}</td>
                    <td className="mono">{i.daysLeft === null ? "-" : i.daysLeft}</td>
                    <td>{TREND[i.trend]}</td>
                    <td className="mono"><strong>{i.suggestedReorder || "-"}</strong></td>
                    <td className="mono">{i.suggestedReorder ? money(i.estimatedCost) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Assistant />
    </>
  );
}

function Assistant() {
  const toast = useToast();
  const [messages, setMessages] = useState([{ role: "ai", text: "Ask me about your stock. I answer using your live inventory data." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { api.get("/ai/status").then((r) => setStatus(r.data)).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages]);

  const ask = async (question) => {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await api.post("/ai/assistant", { question: q });
      setMessages((m) => [...m, { role: "ai", text: data.answer, source: data.source }]);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card assistant">
      <div className="card-head">
        <h3>Inventory assistant</h3>
        <span className="muted small">{status?.llmEnabled ? `Powered by Claude (${status.model})` : "Using built-in rule-based answers"}</span>
      </div>
      <div className="chat" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="bubble ai muted">Thinking...</div>}
        <div ref={endRef} />
      </div>
      <div className="chips">
        {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about stock, value, reorders..." maxLength={500} aria-label="Ask the assistant" />
        <button className="btn primary" disabled={busy || input.trim().length < 2}>Ask</button>
      </form>
    </div>
  );
}
