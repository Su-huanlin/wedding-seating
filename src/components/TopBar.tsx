import { useEffect, useRef, useState } from "react";
import { parseExcelFile } from "../lib/excel";
import { statsFrom, useWedding } from "../store";

function CountField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(text));
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const next = Math.max(0, Math.min(15, n));
    setText(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label className="side-count">
      {label}
      <input
        type="number"
        min={0}
        max={15}
        inputMode="numeric"
        value={text}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export default function TopBar({ onExport }: { onExport: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const eventName = useWedding((s) => s.eventName);
  const theme = useWedding((s) => s.hall.theme);
  const past = useWedding((s) => s.past.length);
  const future = useWedding((s) => s.future.length);
  const setEventName = useWedding((s) => s.setEventName);
  const setTheme = useWedding((s) => s.setTheme);
  const spots = useWedding((s) => s.hall.spots);
  const selectedHallId = useWedding((s) => s.selectedHallId);
  const setSelectedHall = useWedding((s) => s.setSelectedHall);
  const setHallCounts = useWedding((s) => s.setHallCounts);
  const setHallSeats = useWedding((s) => s.setHallSeats);
  const loadGuests = useWedding((s) => s.loadGuests);
  const addTable = useWedding((s) => s.addTable);
  const createHall = useWedding((s) => s.createHall);
  const removeHall = useWedding((s) => s.removeHall);
  const tables = useWedding((s) => s.tables);
  const removeTable = useWedding((s) => s.removeTable);
  const undo = useWedding((s) => s.undo);
  const redo = useWedding((s) => s.redo);
  const [busy, setBusy] = useState(false);
  const [hallOpen, setHallOpen] = useState(false);
  const spot = spots.find((item) => item.id === selectedHallId) ?? null;

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const guests = await parseExcelFile(file);
      loadGuests(guests);
    } catch (err) {
      console.error(err);
      window.alert("表格读不出来，请确认是 Excel，且有「姓名」列。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="seal">囍</div>
        <input
          className="event-name"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          aria-label="宴席名称"
        />
      </div>
      <div className="seg">
        <button type="button" className={theme === "chinese" ? "on" : ""} onClick={() => setTheme("chinese")}>
          中式
        </button>
        <button type="button" className={theme === "western" ? "on" : ""} onClick={() => setTheme("western")}>
          西式
        </button>
      </div>
      <div className="side-plan">
        <label className="hall-pick">
          选厅
          <select
            aria-label="选择厅"
            value={selectedHallId ?? spots[0]?.id ?? ""}
            onChange={(e) => setSelectedHall(e.target.value)}
          >
            {spots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <CountField
          label="左侧"
          value={spot?.left ?? 8}
          disabled={!spot || spot.locked}
          onCommit={(n) => {
            if (!spot || spot.locked) return;
            setHallCounts(n, spot.right);
          }}
        />
        <CountField
          label="右侧"
          value={spot?.right ?? 8}
          disabled={!spot || spot.locked}
          onCommit={(n) => {
            if (!spot || spot.locked) return;
            setHallCounts(spot.left, n);
          }}
        />
        <CountField
          label="每桌"
          value={spot?.seats || 10}
          disabled={!spot || spot.locked}
          onCommit={(n) => {
            if (!setHallSeats(n)) window.alert(spot?.locked ? "这个厅已锁定。" : "请先点选一个厅。");
          }}
        />
      </div>
      <div className="topbar-actions">
        <input
          ref={fileRef}
          className="hidden-file"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
        <a className="btn ghost" href="/宴请名单模板.xlsx" download="宴请名单模板.xlsx">
          下载模板
        </a>
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          导入 Excel
        </button>
        <button type="button" className="btn" onClick={() => setHallOpen(true)}>
          开新厅
        </button>
        <button
          type="button"
          className="btn"
          disabled={!spot || spots.length <= 1}
          onClick={() => {
            if (!spot) return;
            if (!window.confirm(`删除「${spot.name}」？该厅桌位上的来宾会回到待安排。`)) return;
            const result = removeHall(spot.id);
            if (result === "last") window.alert("至少保留一个厅。");
            if (result === "locked") window.alert("这个厅已锁定，先解锁再删。");
          }}
        >
          删厅
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const result = addTable();
            if (result === "need-hall") window.alert("请先点选一个厅，再加桌。");
            if (result === "locked") window.alert("这个厅已锁定，先解开锁厅再加桌。");
            if (result === "full") window.alert("单厅最多 30 桌（左右各 15）。");
          }}
        >
          加桌
        </button>
        <button
          type="button"
          className="btn"
          disabled={!spot}
          onClick={() => {
            if (!spot) return;
            const mine = tables.filter((t) => t.hallId === spot.id).sort((a, b) => b.number - a.number);
            const victim = mine.find((t) => !t.locked) ?? mine[0];
            if (!victim) return;
            if (!window.confirm(`删除第 ${victim.number} 桌？桌上的来宾会回到待安排。`)) return;
            const result = removeTable(victim.id);
            if (result === "last") window.alert("每个厅至少保留一桌。");
            if (result === "locked") window.alert("桌子或厅已锁定，先解锁再删。");
          }}
        >
          删桌
        </button>
        <button type="button" className="btn ghost" disabled={!past} onClick={undo}>
          撤销
        </button>
        <button type="button" className="btn ghost" disabled={!future} onClick={redo}>
          重做
        </button>
        <button type="button" className="btn" onClick={onExport}>
          导出
        </button>
      </div>
      {hallOpen ? (
        <HallDialog
          index={spots.length + 1}
          onCancel={() => setHallOpen(false)}
          onCreate={(input) => {
            createHall(input);
            setHallOpen(false);
          }}
        />
      ) : null}
    </header>
  );
}

function HallDialog({
  index,
  onCancel,
  onCreate,
}: {
  index: number;
  onCancel: () => void;
  onCreate: (input: { name: string; left: number; right: number; seats: number }) => void;
}) {
  const [name, setName] = useState("");
  const [total, setTotal] = useState(16);
  const [left, setLeft] = useState(8);
  const [right, setRight] = useState(8);
  const [seats, setSeats] = useState(10);
  const clamp = (n: number) => Math.max(0, Math.min(15, Math.round(n) || 0));
  const applyTotal = (n: number) => {
    const next = Math.max(1, Math.min(30, Math.round(n) || 1));
    setTotal(next);
    setLeft(Math.ceil(next / 2));
    setRight(Math.floor(next / 2));
  };
  return (
    <div className="modal-back" onClick={onCancel}>
      <form
        className="modal hall-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const nextLeft = clamp(left);
          const nextRight = clamp(right);
          if (nextLeft + nextRight < 1) {
            window.alert("至少要有一桌。");
            return;
          }
          onCreate({ name, left: nextLeft, right: nextRight, seats: Math.max(1, Math.min(20, Math.round(seats) || 10)) });
        }}
      >
        <h2>开 {index} 号厅</h2>
        <p className="dialog-note">不填厅名时，图纸上就显示「{index}号厅」。单厅最多 30 桌，左右各不超过 15。</p>
        <label className="dialog-field">
          厅名
          <input value={name} placeholder={`${index}号厅`} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="dialog-field">
          每桌人数
          <input type="number" min={1} max={20} value={seats} onChange={(e) => setSeats(Math.max(1, Math.min(20, Number(e.target.value) || 10)))} />
        </label>
        <label className="dialog-field">
          桌数
          <input
            type="number"
            min={1}
            max={30}
            value={total}
            onChange={(e) => applyTotal(Number(e.target.value))}
          />
        </label>
        <div className="dialog-split">
          <label className="dialog-field">
            T 台左侧
            <input
              type="number"
              min={0}
              max={15}
              value={left}
              onChange={(e) => {
                const next = clamp(Number(e.target.value));
                setLeft(next);
                setTotal(next + right);
              }}
            />
          </label>
          <label className="dialog-field">
            T 台右侧
            <input
              type="number"
              min={0}
              max={15}
              value={right}
              onChange={(e) => {
                const next = clamp(Number(e.target.value));
                setRight(next);
                setTotal(left + next);
              }}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn primary">
            开这个厅
          </button>
        </div>
      </form>
    </div>
  );
}

export function MobileNav({ onExport }: { onExport: () => void }) {
  const tab = useWedding((s) => s.mobileTab);
  const setMobileTab = useWedding((s) => s.setMobileTab);
  const guests = useWedding((s) => s.guests);
  const tables = useWedding((s) => s.tables);
  const stats = statsFrom({ guests, tables });
  const items = [
    ["hall", "画布"],
    ["pool", `待安排 ${stats.pending}`],
    ["list", "名单"],
  ] as const;
  return (
    <nav className="mobile-nav mobile-only">
      {items.map(([id, label]) => (
        <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setMobileTab(id)}>
          {label}
        </button>
      ))}
      <button type="button" onClick={onExport}>
        导出
      </button>
    </nav>
  );
}
