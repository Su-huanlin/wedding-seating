import { lookupRows, tableRoster } from "../lib/export";
import { useWedding } from "../store";

export default function PrintPack() {
  const eventName = useWedding((s) => s.eventName);
  const guests = useWedding((s) => s.guests);
  const tables = useWedding((s) => s.tables);
  const hall = useWedding((s) => s.hall);
  const state = { eventName, guests, tables, hall };
  const roster = tableRoster(state);
  const lookup = lookupRows(state);
  const chunks: (typeof lookup)[] = [];
  for (let i = 0; i < lookup.length; i += 32) chunks.push(lookup.slice(i, i + 32));
  return (
    <div className="print-root">
      <h1 className="print-title">{eventName} · 分桌名单</h1>
      {roster.map(({ table, names }) => (
        <section key={table.id} className="print-block">
          <h2>
            {table.number}号桌 · {table.note || "无备注"}（{names.length}/{table.seats}
            {names.length < table.seats ? ` · 未满桌，差${table.seats - names.length}人` : ""}）
          </h2>
          <table className="print-table">
            <tbody>
              {names.length ? (
                names.map((n, i) => (
                  <tr key={`${table.id}-${i}`}>
                    <td>{n}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>空桌</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ))}
      <h1 className="print-title print-break">{eventName} · 迎宾查桌</h1>
      {(chunks.length ? chunks : [[]]).map((rows, index) => (
        <table key={index} className="print-table print-lookup">
          <thead>
            <tr>
              <th>姓名</th>
              <th>桌号</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.table}</td>
                <td>{r.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
