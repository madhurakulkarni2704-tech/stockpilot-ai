import { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Empty, Modal, Pagination, Spinner, StatusBadge } from "../components/ui";
import { money } from "../lib/format";

const EMPTY = { name: "", sku: "", category: "", price: "", cost: "", quantity: 0, reorderLevel: 10, supplier: "", unit: "pcs", description: "" };

export default function Products() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: "", category: "", status: "", sort: "-createdAt", page: 1 });
  const [searchText, setSearchText] = useState("");
  const [editing, setEditing] = useState(null); // "new" | product
  const [stockFor, setStockFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Debounce typing so we do not call the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchText.trim() ? f : { ...f, search: searchText.trim(), page: 1 })), 350);
    return () => clearTimeout(t);
  }, [searchText]);

  const load = useCallback(async () => {
    try {
      const params = { limit: 10 };
      Object.entries(filters).forEach(([k, v]) => v !== "" && (params[k] = v));
      const [list, cats] = await Promise.all([api.get("/products", { params }), api.get("/products/categories")]);
      setData(list.data);
      setCategories(cats.data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));

  const remove = async () => {
    try {
      await api.delete(`/products/${confirmDelete._id}`);
      toast.success(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Products</h1>
          <p className="muted">Add items, receive and remove stock, and keep details up to date.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing("new")}>Add product</button>
      </header>

      <div className="toolbar">
        <input className="grow" placeholder="Search by name, SKU or supplier" value={searchText} onChange={(e) => setSearchText(e.target.value)} aria-label="Search products" />
        <select value={filters.category} onChange={setFilter("category")} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter("status")} aria-label="Stock status">
          <option value="">Any stock level</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select value={filters.sort} onChange={setFilter("sort")} aria-label="Sort">
          <option value="-createdAt">Newest first</option>
          <option value="name">Name A-Z</option>
          <option value="-name">Name Z-A</option>
          <option value="quantity">Stock low to high</option>
          <option value="-quantity">Stock high to low</option>
          <option value="price">Price low to high</option>
          <option value="-price">Price high to low</option>
        </select>
      </div>

      <div className="card flush">
        {!data ? <Spinner /> : data.items.length === 0 ? (
          <Empty
            title="No products match"
            hint={filters.search || filters.category || filters.status ? "Try clearing the search or filters." : "Add your first product to get started."}
            action={<button className="btn primary" onClick={() => setEditing("new")}>Add product</button>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Product</th><th>Category</th><th>Price</th><th>In stock</th><th>Status</th><th className="right">Actions</th></tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p._id}>
                      <td><strong>{p.name}</strong><div className="muted small mono">{p.sku}{p.supplier ? ` · ${p.supplier}` : ""}</div></td>
                      <td>{p.category}</td>
                      <td className="mono">{money(p.price)}</td>
                      <td className="mono">{p.quantity} <span className="muted">{p.unit}</span></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="right nowrap">
                        <button className="btn ghost sm" onClick={() => setStockFor(p)}>Update stock</button>{" "}
                        <button className="btn ghost sm" onClick={() => setEditing(p)}>Edit</button>
                        {user.role === "admin" && <>{" "}<button className="btn danger sm" onClick={() => setConfirmDelete(p)}>Delete</button></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {stockFor && <StockForm product={stockFor} onClose={() => setStockFor(null)} onSaved={() => { setStockFor(null); load(); }} />}
      {confirmDelete && (
        <Modal title="Delete product" onClose={() => setConfirmDelete(null)}>
          <p>Delete <strong>{confirmDelete.name}</strong> and its stock history? This cannot be undone.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn danger solid" onClick={remove}>Delete product</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !product;
  const [form, setForm] = useState(product ? { ...EMPTY, ...product } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const writeWithAI = async () => {
    if (form.name.trim().length < 2) return setError("Enter a product name first so the AI has something to write about.");
    setError("");
    setAiBusy(true);
    try {
      const { data } = await api.post("/ai/describe", { name: form.name.trim(), category: form.category.trim() || undefined });
      setForm((f) => ({ ...f, description: data.description, category: f.category.trim() ? f.category : data.category }));
      toast.success(data.source === "claude" ? "Description written by Claude" : "Description written from built-in templates");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const body = {
      name: form.name, sku: form.sku, category: form.category || undefined, description: form.description,
      price: form.price, cost: form.cost === "" ? 0 : form.cost, reorderLevel: form.reorderLevel === "" ? 0 : form.reorderLevel,
      supplier: form.supplier, unit: form.unit || undefined,
    };
    if (isNew) body.quantity = form.quantity === "" ? 0 : form.quantity;
    try {
      if (isNew) await api.post("/products", body);
      else await api.put(`/products/${product._id}`, body);
      toast.success(isNew ? "Product added" : "Product updated");
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? "Add product" : "Edit product"} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        <label className="span2">Name<input value={form.name} onChange={set("name")} required maxLength={120} /></label>
        <label>SKU<input value={form.sku} onChange={set("sku")} required minLength={2} className="mono" placeholder="ELEC-1010" /></label>
        <label>Category
          <input value={form.category} onChange={set("category")} list="cats" placeholder="e.g. Electronics" />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>Selling price (INR)<input type="number" min="0" step="0.01" value={form.price} onChange={set("price")} required /></label>
        <label>Cost price (INR)<input type="number" min="0" step="0.01" value={form.cost} onChange={set("cost")} /></label>
        {isNew && <label>Opening stock<input type="number" min="0" step="1" value={form.quantity} onChange={set("quantity")} /></label>}
        <label>Reorder level<input type="number" min="0" step="1" value={form.reorderLevel} onChange={set("reorderLevel")} /></label>
        <label>Unit<input value={form.unit} onChange={set("unit")} /></label>
        <label>Supplier<input value={form.supplier} onChange={set("supplier")} /></label>
        <div className="span2 field">
          <div className="row between">
            <label htmlFor="product-description">Description</label>
            <button type="button" className="btn ghost sm" onClick={writeWithAI} disabled={aiBusy}>{aiBusy ? "Writing..." : "Write with AI"}</button>
          </div>
          <textarea id="product-description" rows={3} value={form.description} onChange={set("description")} maxLength={1000} />
        </div>
        {!isNew && <p className="muted small span2">To change the quantity, use Update stock so the change is recorded in the history.</p>}
        {error && <div className="form-error span2" role="alert">{error}</div>}
        <div className="modal-actions span2">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving..." : isNew ? "Add product" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function StockForm({ product, onClose, onSaved }) {
  const toast = useToast();
  const [type, setType] = useState("in");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const preview = (() => {
    const q = Number(quantity);
    if (quantity === "" || Number.isNaN(q)) return null;
    return type === "in" ? product.quantity + q : type === "out" ? product.quantity - q : q;
  })();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post(`/products/${product._id}/stock`, { type, quantity, note: note || undefined });
      toast.success("Stock updated");
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Update stock: ${product.name}`} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <p className="muted">Current stock: <strong className="mono">{product.quantity} {product.unit}</strong></p>
        <div className="seg" role="radiogroup" aria-label="Type of change">
          {[["in", "Receive"], ["out", "Remove"], ["adjust", "Set count"]].map(([v, l]) => (
            <button type="button" key={v} className={type === v ? "on" : ""} onClick={() => setType(v)} role="radio" aria-checked={type === v}>{l}</button>
          ))}
        </div>
        <label>{type === "adjust" ? "Counted quantity" : "Quantity"}
          <input type="number" min={type === "adjust" ? 0 : 1} step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
        </label>
        <label>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={type === "in" ? "Supplier delivery" : type === "out" ? "Customer order" : "Monthly stock count"} /></label>
        {preview !== null && <p className={preview < 0 ? "form-error" : "muted"}>New stock level: <strong className="mono">{preview}</strong></p>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || (preview !== null && preview < 0)}>{busy ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
