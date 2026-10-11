import { forwardRef, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { sheetSize } from "../lib/layout";
import { useWedding } from "../store";
import HallSheet from "./HallSheet";
import RoundTable from "./RoundTable";

interface SceneProps {
  interactive: boolean;
  scaleRef?: { current: number };
  onGuestPointerDown?: (guestId: string, e: ReactPointerEvent) => void;
  onUserMoved?: () => void;
}

export const HallScene = forwardRef<HTMLDivElement, SceneProps>(function HallScene(
  { interactive, scaleRef, onGuestPointerDown, onUserMoved },
  ref,
) {
  const tables = useWedding((s) => s.tables);
  const guests = useWedding((s) => s.guests);
  const hall = useWedding((s) => s.hall);
  const selectedGuestId = useWedding((s) => s.selectedGuestId);
  const nudgeTable = useWedding((s) => s.nudgeTable);
  const capture = useWedding((s) => s.capture);
  const setSelectedGuest = useWedding((s) => s.setSelectedGuest);
  const toggleTableLock = useWedding((s) => s.toggleTableLock);
  const removeTable = useWedding((s) => s.removeTable);
  const nudgeHall = useWedding((s) => s.nudgeHall);
  const toggleHallLock = useWedding((s) => s.toggleHallLock);
  const selectedHallId = useWedding((s) => s.selectedHallId);
  const setSelectedHall = useWedding((s) => s.setSelectedHall);
  const setSelectedTable = useWedding((s) => s.setSelectedTable);
  const selectedTableId = useWedding((s) => s.selectedTableId);
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);

  const onTablePointerDown = (id: string, e: ReactPointerEvent) => {
    if (!interactive) return;
    if ((e.target as HTMLElement).closest(".guest-chip, .table-card")) return;
    e.preventDefault();
    e.stopPropagation();
    const table = useWedding.getState().tables.find((t) => t.id === id);
    if (table) {
      setSelectedHall(table.hallId);
      setSelectedTable(table.id);
    }
    const hallLocked = useWedding.getState().hall.spots.some((sp) => sp.id === table?.hallId && sp.locked);
    if (!table || table.locked || hallLocked) return;
    onUserMoved?.();
    capture();
    drag.current = { id, x: e.clientX, y: e.clientY };
    const move = (ev: globalThis.PointerEvent) => {
      if (!drag.current) return;
      const s = scaleRef?.current || 1;
      const dx = (ev.clientX - drag.current.x) / s;
      const dy = (ev.clientY - drag.current.y) / s;
      drag.current = { id, x: ev.clientX, y: ev.clientY };
      const t = useWedding.getState().tables.find((x) => x.id === id);
      if (!t) return;
      nudgeTable(id, t.x + dx, t.y + dy);
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onHallPointerDown = (id: string, e: ReactPointerEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    const spot = useWedding.getState().hall.spots?.find((s) => s.id === id);
    if (!spot || spot.locked) return;
    onUserMoved?.();
    capture();
    let lastX = e.clientX;
    let lastY = e.clientY;
    const move = (ev: globalThis.PointerEvent) => {
      const s = scaleRef?.current || 1;
      const dx = (ev.clientX - lastX) / s;
      const dy = (ev.clientY - lastY) / s;
      lastX = ev.clientX;
      lastY = ev.clientY;
      nudgeHall(id, dx, dy);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const spots = hall.spots?.length ? hall.spots : [];
  const showHallLock = spots.length > 1;

  return (
    <div
      ref={ref}
      className={`hall theme-${hall.theme}`}
      style={{ width: hall.width, height: hall.height }}
    >
      {spots.map((spot) => {
        const mine = tables.filter((t) => (t.hallId || spots[0]?.id) === spot.id);
        return (
          <HallSheet
            key={spot.id}
            spot={spot}
            theme={hall.theme}
            selected={interactive && selectedHallId === spot.id}
            showLock={showHallLock}
            onSelect={() => setSelectedHall(spot.id)}
            onDragStart={(e) => onHallPointerDown(spot.id, e)}
            onToggleLock={() => toggleHallLock(spot.id)}
          >
            {mine.map((table) => {
              const hallLocked = spot.locked;
              return (
                <RoundTable
                  key={table.id}
                  table={table}
                  guests={guests}
                  selectedGuestId={selectedGuestId}
                  selected={interactive && selectedTableId === table.id}
                  seatsOpen={interactive && !table.locked && !hallLocked}
                  canRemove={interactive && !table.locked && !hallLocked && mine.length > 1}
                  onSelectGuest={setSelectedGuest}
                  onGuestPointerDown={onGuestPointerDown ?? (() => undefined)}
                  onTablePointerDown={onTablePointerDown}
                  onToggleLock={toggleTableLock}
                  onRemove={(id) => {
                    if (!window.confirm("删除这桌？桌上的来宾会回到待安排。")) return;
                    const result = removeTable(id);
                    if (result === "last") window.alert("每个厅至少保留一桌。");
                    if (result === "locked") window.alert("桌子或厅已锁定，先解锁再删。");
                  }}
                />
              );
            })}
          </HallSheet>
        );
      })}
    </div>
  );
});

export default function HallView({
  onGuestPointerDown,
}: {
  onGuestPointerDown: (guestId: string, e: ReactPointerEvent) => void;
}) {
  const guests = useWedding((s) => s.guests);
  const tableCount = useWedding((s) => s.tables.length);
  const hall = useWedding((s) => s.hall);
  const selectedHallId = useWedding((s) => s.selectedHallId);
  const setSelectedHall = useWedding((s) => s.setSelectedHall);
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current) return;
    const id = hall.spots?.[0]?.id;
    if (!id) return;
    if (!useWedding.getState().selectedHallId) setSelectedHall(id);
    picked.current = true;
  }, [hall.spots, setSelectedHall]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const [cam, setCam] = useState({ x: 24, y: 24, scale: 1 });
  const scaleRef = useRef(cam.scale);
  scaleRef.current = cam.scale;
  const pan = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      moved.current = true;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setCam((c) => {
        const factor = e.deltaY > 0 ? 0.92 : 1.09;
        const scale = Math.min(2.8, Math.max(0.05, c.scale * factor));
        return {
          scale,
          x: mx - ((mx - c.x) / c.scale) * scale,
          y: my - ((my - c.y) / c.scale) * scale,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const seenHall = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sel = selectedHallId ?? null;
    if (seenHall.current !== sel) {
      moved.current = false;
      seenHall.current = sel;
    }
    const frame = () => {
      if (moved.current) return true;
      const rect = el.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) return false;
      const state = useWedding.getState();
      const spots = state.hall.spots?.length ? state.hall.spots : [];
      if (!spots.length) return false;
      // 一屏装下全部厅纸（多厅时一起缩），不再只框当前厅导致缩不小
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const sp of spots) {
        const size = sheetSize({ left: sp.left || 8, right: sp.right || 8 });
        minX = Math.min(minX, sp.x);
        minY = Math.min(minY, sp.y);
        maxX = Math.max(maxX, sp.x + size.width);
        maxY = Math.max(maxY, sp.y + size.height);
      }
      const totalW = Math.max(1, maxX - minX);
      const totalH = Math.max(1, maxY - minY);
      const scale = Math.min(1.05, (rect.width - 40) / totalW, (rect.height - 40) / totalH);
      const x = Math.round((rect.width - totalW * scale) / 2 - minX * scale);
      const y = Math.round((rect.height - totalH * scale) / 2 - minY * scale);
      setCam((c) => (c.scale === scale && c.x === x && c.y === y ? c : { scale, x, y }));
      return true;
    };
    if (frame()) return;
    const observer = new ResizeObserver(() => {
      if (frame()) observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedHallId, hall.width, hall.height, tableCount]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest(".no-pan")) return;
    e.preventDefault();
    moved.current = true;
    pan.current = { px: e.clientX, py: e.clientY, cx: cam.x, cy: cam.y };
    const move = (ev: globalThis.PointerEvent) => {
      const start = pan.current;
      if (!start) return;
      const x = start.cx + (ev.clientX - start.px);
      const y = start.cy + (ev.clientY - start.py);
      setCam((c) => (c.x === x && c.y === y ? c : { ...c, x, y }));
    };
    const up = () => {
      pan.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="canvas-col">
      <div
        ref={viewportRef}
        className="hall-viewport"
        onPointerDown={onPointerDown}
      >
        <div
          className="hall-camera"
          style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})` }}
        >
          <HallScene
            interactive
            scaleRef={scaleRef}
            onGuestPointerDown={onGuestPointerDown}
            onUserMoved={() => {
              moved.current = true;
            }}
          />
        </div>
      </div>
      {guests.length === 0 && tableCount <= 1 ? (
        <div className="drop-hero">
          <strong>导入宴请名单开始排桌</strong>
          <p>可先「下载模板」填写，再点「导入 Excel」。空行会当作分组。</p>
        </div>
      ) : null}
      <div className="hint">拖空白看场地 · 拖厅纸挪整厅 · 拖圆桌挪桌子 · 滚轮缩放</div>
    </div>
  );
}
