import { useEffect } from "react";

export function Spinner({ label = "Loading" }) {
  return (
    <div className="center-pad" role="status">
      <div className="spinner" />
      <span className="muted">{label}...</span>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS = {
  in_stock: ["In stock", "green"],
  low_stock: ["Low stock", "amber"],
  out_of_stock: ["Out of stock", "red"],
};
export function StatusBadge({ status }) {
  const [label, tone] = STATUS[status] || STATUS.in_stock;
  return <span className={`badge ${tone}`}>{label}</span>;
}

const RISK = { critical: ["Critical", "red"], high: ["High", "amber"], medium: ["Watch", "blue"], low: ["Healthy", "green"] };
export function RiskBadge({ risk }) {
  const [label, tone] = RISK[risk] || RISK.low;
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Pagination({ page, pages, total, onChange }) {
  return (
    <div className="pagination">
      <span className="muted">{total} result{total === 1 ? "" : "s"}</span>
      <div className="row gap">
        <button className="btn ghost sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span className="muted">Page {page} of {pages}</span>
        <button className="btn ghost sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}
