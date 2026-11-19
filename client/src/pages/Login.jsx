import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api";
import { Logo } from "../components/Layout";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <Logo />
        <h1>Know what is on the shelf, and what to order next.</h1>
        <p>
          Track stock across every product, see a full history of each change, and let the built-in forecast tell you
          which items will run out before your next delivery arrives.
        </p>
        <ul>
          <li>Live stock levels with low and out-of-stock alerts</li>
          <li>Reorder suggestions from 30 days of sales</li>
          <li>Ask questions about your inventory in plain English</li>
        </ul>
      </section>

      <section className="login-card">
        <div className="tabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
        </div>

        <form onSubmit={submit} className="stack">
          {mode === "register" && (
            <label>Full name
              <input value={form.name} onChange={set("name")} required minLength={2} autoComplete="name" />
            </label>
          )}
          <label>Email
            <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
          </label>
          <label>Password
            <input type="password" value={form.password} onChange={set("password")} required minLength={mode === "register" ? 6 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn primary" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>

        {mode === "login" && (
          <button className="link-btn" onClick={() => setForm({ ...form, email: "admin@demo.com", password: "Admin@123" })}>
            Fill in the demo admin login
          </button>
        )}
        {mode === "register" && <p className="muted small">The first account created becomes the admin. Later accounts are staff.</p>}
      </section>
    </div>
  );
}
