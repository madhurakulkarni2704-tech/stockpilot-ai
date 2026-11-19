import { useEffect, useState } from "react";
import api, { errMsg } from "../api";
import { useToast } from "../context/ToastContext";
import { Empty, Pagination, Spinner } from "../components/ui";
import { dateTime } from "../lib/format";

const TYPE_LABEL = { in: "Received", out: "Removed", adjust: "Stock count" };

export default function Movements() {
  const toast = useToast();
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    const params = { page, limit: 15 };
    if (type) params.type = type;
    api.get("/movements", { params }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [type, page]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Stock history</h1>
          <p className="muted">Every change to every product, newest first.</p>
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Filter by type">
          <option value="">All changes</option>
          <option value="in">Received</option>
          <option value="out">Removed</option>
          <option value="adjust">Stock counts</option>
        </select>
      </header>

      <div className="card flush">
        {!data ? <Spinner /> : data.items.length === 0 ? (
          <Empty title="No movements found" hint="Receive or remove stock on the Products page to see it here." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>When</th><th>Product</th><th>Change</th><th>Type</th><th>Balance</th><th>By</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {data.items.map((m) => (
                    <tr key={m._id}>
                      <td className="nowrap">{dateTime(m.createdAt)}</td>
                      <td><strong>{m.product?.name || "Deleted product"}</strong><div className="muted small mono">{m.product?.sku}</div></td>
                      <td className={`mono delta ${m.delta >= 0 ? "pos" : "neg"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                      <td>{TYPE_LABEL[m.type]}</td>
                      <td className="mono">{m.balanceAfter}</td>
                      <td>{m.user?.name || "-"}</td>
                      <td className="muted">{m.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
