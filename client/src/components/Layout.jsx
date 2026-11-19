import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/products", label: "Products" },
  { to: "/movements", label: "Stock history" },
  { to: "/insights", label: "AI insights" },
];

export function Logo() {
  return (
    <div className="logo">
      <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" rx="22" fill="#0f766e" />
        <path d="M25 38l25-13 25 13v26L50 77 25 64z M25 38l25 13 25-13 M50 51v26" fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
      </svg>
      <span>StockPilot <b>AI</b></span>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <strong>{user.name}</strong>
            <span>{user.role === "admin" ? "Admin" : "Staff"}</span>
          </div>
          <button className="btn ghost sm light" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
