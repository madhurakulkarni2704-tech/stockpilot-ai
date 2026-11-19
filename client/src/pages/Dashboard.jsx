import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { errMsg } from "../api";
import { useToast } from "../context/ToastContext";
import { Spinner, StatusBadge, Empty } from "../components/ui";
import { dateTime, money, num, shortDay } from "../lib/format";

const COLORS = ["#0f766e", "#b7791f", "#3b6ea5", "#8a5a44", "#6b7c3f", "#7a6a9a"];

export default function Dashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [ai, setAi] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/dashboard/summary"), api.get("/ai/insights")])
      .then(([d, i]) => {
        setData(d.data);
        setAi(i.data);
      })
      .catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!data) return <Spinner label="Loading dashboard" />;
  const t = data.totals;
  const cards = [
    { label: "Products", value: num(t.products) },
    { label: "Units in stock", value: num(t.units) },
    { label: "Stock value", value: money(t.value), sub: `Cost ${money(t.cost)}` },
    { label: "Low stock", value: num(t.lowStock), tone: t.lowStock ? "amber" : "" },
    { label: "Out of stock", value: num(t.outOfStock), tone: t.outOfStock ? "red" : "" },
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">A live view of your stock, movement and risks.</p>
        </div>
        <Link to="/products" className="btn primary">Manage products</Link>
      </header>

      {ai && (
        <Link to="/insights" className={`ai-banner ${ai.summary.critical + ai.summary.high > 0 ? "alert" : ""}`}>
          <strong>AI forecast:</strong> {ai.headline}
          {ai.summary.totalSuggestedUnits > 0 && <span> Suggested reorder: {num(ai.summary.totalSuggestedUnits)} units (about {money(ai.summary.estimatedReorderCost)}).</span>}
          <span className="banner-link">View details</span>
        </Link>
      )}

      <section className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className={`card stat ${c.tone || ""}`}>
            <span className="muted">{c.label}</span>
            <strong className="mono">{c.value}</strong>
            {c.sub && <small className="muted">{c.sub}</small>}
          </div>
        ))}
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Stock movement, last 14 days</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e7e2" />
                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 12 }} interval={1} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip labelFormatter={shortDay} />
                <Legend />
                <Area type="monotone" dataKey="inbound" name="Received" stroke="#0f766e" fill="#0f766e" fillOpacity={0.18} />
                <Area type="monotone" dataKey="outbound" name="Sold / removed" stroke="#b7791f" fill="#b7791f" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Stock value by category</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byCategory} dataKey="value" nameKey="category" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {data.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Needs attention</h3>
          {data.attention.length === 0 ? (
            <Empty title="Everything is above its reorder level" />
          ) : (
            <ul className="list">
              {data.attention.map((p) => (
                <li key={p._id}>
                  <div>
                    <strong>{p.name}</strong>
                    <div className="muted small mono">{p.sku}</div>
                  </div>
                  <div className="right">
                    <StatusBadge status={p.status} />
                    <div className="muted small">{p.quantity} left (reorder at {p.reorderLevel})</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Recent activity</h3>
          {data.recent.length === 0 ? (
            <Empty title="No stock activity yet" hint="Add a product, then receive or sell some stock." />
          ) : (
            <ul className="list">
              {data.recent.map((m) => (
                <li key={m._id}>
                  <div>
                    <strong>{m.product?.name || "Deleted product"}</strong>
                    <div className="muted small">{m.user?.name || "System"} · {dateTime(m.createdAt)}</div>
                  </div>
                  <div className={`delta mono ${m.delta >= 0 ? "pos" : "neg"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
