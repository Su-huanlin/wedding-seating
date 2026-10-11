import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import HallView, { HallScene } from "./components/HallView";
import { LeftPanel, RightPanel } from "./components/Panels";
import PrintPack from "./components/PrintPack";
import TopBar, { MobileNav } from "./components/TopBar";
import { useWedding } from "./store";

const ExportCenter = lazy(() => import("./components/ExportCenter"));

export default function App() {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const guests = useWedding((s) => s.guests);
  const assignSeat = useWedding((s) => s.assignSeat);
  const unassign = useWedding((s) => s.unassign);
  const setSelectedGuest = useWedding((s) => s.setSelectedGuest);
  const theme = useWedding((s) => s.hall.theme);
  const tab = useWedding((s) => s.mobileTab);
  const ghostGuest = guests.find((g) => g.id === ghost?.id);

  useEffect(() => {
    document.body.classList.toggle("dragging-guest", Boolean(ghost));
    return () => document.body.classList.remove("dragging-guest");
  }, [ghost]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const state = useWedding.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        state.undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        state.redo();
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      if (mod) {
        const spot = state.hall.spots.find((sp) => sp.id === state.selectedHallId);
        if (!spot) return;
        if (state.hall.spots.length <= 1) {
          window.alert("至少保留一个厅。");
          return;
        }
        if (!window.confirm(`删除「${spot.name}」？该厅桌位上的来宾会回到待安排。`)) return;
        const result = state.removeHall(spot.id);
        if (result === "locked") window.alert("这个厅已锁定，先解锁再删。");
        return;
      }
      const tableId =
        state.selectedTableId ||
        [...state.tables]
          .filter((t) => t.hallId === state.selectedHallId)
          .sort((a, b) => b.number - a.number)
          .find((t) => !t.locked)?.id;
      if (!tableId) return;
      if (!window.confirm("删除这桌？桌上的来宾会回到待安排。")) return;
      const result = state.removeTable(tableId);
      if (result === "last") window.alert("每个厅至少保留一桌。");
      if (result === "locked") window.alert("桌子或厅已锁定，先解锁再删。");
      state.setSelectedTable(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onGuestPointerDown = (guestId: string, e: ReactPointerEvent) => {
    const state = useWedding.getState();
    const guest = state.guests.find((g) => g.id === guestId);
    const from = state.tables.find((t) => t.id === guest?.tableId);
    if (from?.hallId) state.setSelectedHall(from.hallId);
    const hallLocked = state.hall.spots.some((sp) => sp.id === from?.hallId && sp.locked);
    if (from?.locked || hallLocked) {
      setSelectedGuest(guestId);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const move = (ev: globalThis.PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      dragging = true;
      setGhost({ id: guestId, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      if (!dragging) {
        setSelectedGuest(guestId);
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const seat = el?.closest("[data-seat]");
      if (seat) {
        const raw = seat.getAttribute("data-seat") ?? "";
        const [tableId, idx] = raw.split(":");
        if (tableId) assignSeat(guestId, tableId, Number(idx));
        return;
      }
      if (el?.closest("[data-pool]")) unassign(guestId);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      <div className="app" data-theme={theme}>
        <TopBar onExport={() => setExportOpen(true)} />
        <div className="workspace" data-tab={tab}>
          <LeftPanel onGuestPointerDown={onGuestPointerDown} />
          <HallView onGuestPointerDown={onGuestPointerDown} />
          <RightPanel />
        </div>
        <MobileNav onExport={() => setExportOpen(true)} />
        {ghostGuest && ghost ? (
          <div className="guest-chip ghost" style={{ left: ghost.x, top: ghost.y }}>
            {ghostGuest.name}
          </div>
        ) : null}
        <div className="offscreen-hall" aria-hidden>
          <HallScene ref={exportRef} interactive={false} />
        </div>
        {exportOpen ? (
          <Suspense fallback={null}>
            <ExportCenter hallNode={exportRef.current} onClose={() => setExportOpen(false)} />
          </Suspense>
        ) : null}
      </div>
      <PrintPack />
    </>
  );
}
