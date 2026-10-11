import { useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { buildParties } from "../lib/seating";
import { lookupRows } from "../lib/export";
import { statsFrom, useWedding } from "../store";
import type { Rsvp } from "../types";
import GuestChip from "./GuestChip";

export function LeftPanel({
  onGuestPointerDown,
}: {
  onGuestPointerDown: (guestId: string, e: ReactPointerEvent) => void;
}) {
  const guests = useWedding((s) => s.guests);
  const tables = useWedding((s) => s.tables);
  const stats = statsFrom({ guests, tables });
  const addManualGuest = useWedding((s) => s.addManualGuest);
  const selectedGuestId = useWedding((s) => s.selectedGuestId);
  const setSelectedGuest = useWedding((s) => s.setSelectedGuest);
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [remark, setRemark] = useState("");
  const [hasChild, setHasChild] = useState(false);
  const [rsvp, setRsvp] = useState<Rsvp>("yes");
  const pool = guests.filter((g) => !g.tableId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addManualGuest({ name, count, remark, hasChild, rsvp });
    setName("");
    setCount(1);
    setRemark("");
    setHasChild(false);
    setRsvp("yes");
  };

  return (
    <aside className="side side-left">
      <div className="stats">
        <div className="stat">
          <b>{stats.people}</b>
          <span>来宾座位</span>
        </div>
        <div className="stat">
          <b>{stats.seated}</b>
          <span>已入座</span>
        </div>
        <div className="stat">
          <b>{stats.pending}</b>
          <span>待安排</span>
        </div>
        <div className="stat">
          <b>{stats.tables}</b>
          <span>婚桌</span>
        </div>
      </div>

      <div className="panel-title">添加来宾</div>
      <form className="form-grid" onSubmit={submit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名 / 称呼" />
        <input
          type="number"
          min={1}
          max={12}
          value={count}
          onChange={(e) => setCount(Number(e.target.value) || 1)}
          placeholder="人数"
        />
        <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="备注（相同备注优先同桌）" />
        <select value={rsvp} onChange={(e) => setRsvp(e.target.value as Rsvp)}>
          <option value="yes">到场</option>
          <option value="pending">待定</option>
          <option value="no">未到</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={hasChild} onChange={(e) => setHasChild(e.target.checked)} />
          带小孩（不占座）
        </label>
        <button className="btn primary" type="submit">
          加入待安排
        </button>
      </form>

      <div className="panel-title">待安排</div>
      <div className={`pool ${pool.length ? "" : "empty"}`} data-pool="1">
        {pool.length === 0 ? "空着。把来宾拖到这里即取消入座。" : null}
        {pool.map((g) => (
          <GuestChip
            key={g.id}
            guest={g}
            selected={selectedGuestId === g.id}
            onClick={() => setSelectedGuest(g.id)}
            onPointerDown={(e) => onGuestPointerDown(g.id, e)}
          />
        ))}
      </div>
    </aside>
  );
}

export function RightPanel() {
  const guests = useWedding((s) => s.guests);
  const tables = useWedding((s) => s.tables);
  const query = useWedding((s) => s.query);
  const setQuery = useWedding((s) => s.setQuery);
  const selectedGuestId = useWedding((s) => s.selectedGuestId);
  const setSelectedGuest = useWedding((s) => s.setSelectedGuest);
  const updateGuest = useWedding((s) => s.updateGuest);
  const removeParty = useWedding((s) => s.removeParty);
  const toggleAvoid = useWedding((s) => s.toggleAvoid);
  const selected = guests.find((g) => g.id === selectedGuestId);
  const parties = buildParties(guests);
  const rows = lookupRows({ eventName: "", guests, tables, hall: { width: 0, height: 0, theme: "chinese", spots: [] } }).filter(
    (r) => !query || r.name.includes(query) || r.table.includes(query),
  );

  return (
    <aside className="side side-right">
      {selected ? (
        <div className="guest-editor">
          <div className="panel-title">改名</div>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              value={selected.name}
              aria-label="来宾姓名"
              onChange={(e) => updateGuest(selected.id, { name: e.target.value })}
            />
            <input
              value={selected.remark}
              onChange={(e) => updateGuest(selected.id, { remark: e.target.value })}
              placeholder="备注"
            />
            <select
              value={selected.rsvp}
              onChange={(e) => updateGuest(selected.id, { rsvp: e.target.value as Rsvp })}
            >
              <option value="yes">到场</option>
              <option value="pending">待定</option>
              <option value="no">未到</option>
            </select>
            <label className="check">
              <input
                type="checkbox"
                checked={selected.hasChild}
                onChange={(e) => updateGuest(selected.id, { hasChild: e.target.checked })}
              />
              带小孩（不占座）
            </label>
            <button type="button" className="btn" onClick={() => removeParty(selected.partyId)}>
              删除这一拨
            </button>
          </form>
        </div>
      ) : (
        <p className="panel-note">点来宾姓名，在这里改名</p>
      )}
      <div className="panel-title">按桌号</div>
      <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜姓名 / 桌号" />
      <div>
        {rows.map((r, i) => {
          const showHead = i === 0 || rows[i - 1]?.table !== r.table;
          return (
            <div key={r.id}>
              {showHead ? <div className="table-head">{r.table}</div> : null}
              <div className="list-row">
                <button
                  type="button"
                  className={selectedGuestId === r.id ? "link on" : "link"}
                  onClick={() => setSelectedGuest(r.id)}
                >
                  {r.name}
                  {r.remark ? <em> {r.remark}</em> : null}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selected ? (
        <>
          <div className="panel-title">避开同桌</div>
          <div className="avoid-list">
            {parties
              .filter((p) => p.id !== selected.partyId)
              .map((p) => {
                const on = selected.avoidPartyIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={on ? "on" : ""}
                    onClick={() => toggleAvoid(selected.partyId, p.id)}
                  >
                    {p.lead.name}
                  </button>
                );
              })}
          </div>
        </>
      ) : null}
    </aside>
  );
}
