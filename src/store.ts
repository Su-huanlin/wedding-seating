import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { companionName, isDefaultCompanionName, rowsToGuests } from "./lib/excel";
import { clone } from "./lib/ids";
import {
  alignHallSpots,
  applyHallCounts,
  createTable,
  DEFAULT_LEFT_TABLES,
  defaultHall,
  defaultLayoutPlan,
  ensureHallFits,
  fitTablesToPlan,
  growPlanEven,
  layoutBanquet,
  makeSpot,
  MAX_HALL_TABLES,
  normalizePlan,
  renumberByPosition,
  sheetMetrics,
  sheetPosition,
  sheetSize,
  sheetsFromWorld,
} from "./lib/layout";
import { autoAssign, occupiedCount } from "./lib/seating";
import type { Guest, MobileTab, Rsvp, Table, Theme, WeddingState } from "./types";

interface HistoryStore extends WeddingState {
  past: WeddingState[];
  future: WeddingState[];
  selectedGuestId: string | null;
  mobileTab: MobileTab;
  query: string;
  capture: () => void;
  undo: () => void;
  redo: () => void;
  setEventName: (name: string) => void;
  setTheme: (theme: Theme) => void;
  replaceGuests: (guests: Guest[]) => void;
  loadGuests: (guests: Guest[]) => void;
  addManualGuest: (input: {
    name: string;
    count: number;
    remark: string;
    hasChild: boolean;
    rsvp: Rsvp;
  }) => void;
  updateGuest: (id: string, patch: Partial<Pick<Guest, "name" | "remark" | "hasChild" | "rsvp">>) => void;
  removeParty: (partyId: string) => void;
  toggleAvoid: (partyA: string, partyB: string) => void;
  removeTable: (id: string) => "ok" | "locked" | "last" | "missing";
  removeHall: (id: string) => "ok" | "last" | "locked" | "missing";
  nudgeTable: (id: string, x: number, y: number) => void;
  toggleTableLock: (id: string) => void;
  setMainTable: (id: string) => void;
  toggleLockNumber: (id: string) => void;
  updateTableNote: (id: string, note: string) => void;
  renumber: () => void;
  autoSeat: () => void;
  assignSeat: (guestId: string, tableId: string, seatIndex: number) => void;
  unassign: (guestId: string) => void;
  setSelectedGuest: (id: string | null) => void;
  setMobileTab: (tab: MobileTab) => void;
  setQuery: (q: string) => void;
  selectedHallId: string | null;
  selectedTableId: string | null;
  setSelectedHall: (id: string | null) => void;
  setSelectedTable: (id: string | null) => void;
  setHallCounts: (left: number, right: number) => boolean;
  addTable: () => "ok" | "need-hall" | "locked" | "full";
  createHall: (input: { name: string; left: number; right: number; seats: number }) => void;
  setHallSeats: (seats: number) => boolean;
  nudgeHall: (id: string, dx: number, dy: number) => void;
  toggleHallLock: (id: string) => void;
  resetAll: () => void;
  layoutVersion: number;
}

function snap(s: WeddingState): WeddingState {
  return {
    eventName: s.eventName,
    guests: clone(s.guests),
    tables: clone(s.tables),
    hall: clone(s.hall),
    layoutPlan: clone(s.layoutPlan),
  };
}

function fresh(): WeddingState {
  const layoutPlan = defaultLayoutPlan();
  let hall = defaultHall();
  const spotId = hall.spots[0].id;
  const tables: WeddingState["tables"] = [];
  for (let i = 0; i < layoutPlan.left + layoutPlan.right; i += 1) {
    const table = createTable(tables, hall, i === 0, layoutPlan, spotId);
    table.note = "无备注";
    tables.push(table);
  }
  hall = ensureHallFits(tables, hall);
  return {
    eventName: "婚宴排桌",
    guests: [],
    tables,
    hall,
    layoutPlan,
  };
}

const empty = fresh();

export const useWedding = create<HistoryStore>()(
  persist(
    (set, get) => ({
      ...empty,
      past: [],
      future: [],
      selectedGuestId: null,
      selectedHallId: null,
      selectedTableId: null,
      mobileTab: "hall",
      query: "",
      layoutVersion: 0,
      capture: () =>
        set((s) => ({
          past: [...s.past, snap(s)].slice(-80),
          future: [],
        })),
      undo: () =>
        set((s) => {
          const prev = s.past[s.past.length - 1];
          if (!prev) return s;
          return {
            ...s,
            ...clone(prev),
            past: s.past.slice(0, -1),
            future: [snap(s), ...s.future].slice(0, 80),
          };
        }),
      redo: () =>
        set((s) => {
          const next = s.future[0];
          if (!next) return s;
          return {
            ...s,
            ...clone(next),
            future: s.future.slice(1),
            past: [...s.past, snap(s)].slice(-80),
          };
        }),
      setEventName: (eventName) => set({ eventName }),
      setTheme: (theme) => set((s) => ({ hall: { ...s.hall, theme } })),
      replaceGuests: (guests) => {
        get().capture();
        set({ guests });
      },
      loadGuests: (guests) => {
        get().capture();
        const layoutPlan = normalizePlan(get().layoutPlan);
        const next = autoAssign({
          eventName: get().eventName,
          guests,
          tables: [],
          hall: get().hall,
          layoutPlan,
        });
        set({ guests: next.guests, tables: next.tables, hall: next.hall });
      },
      addManualGuest: (input) => {
        get().capture();
        const rows = rowsToGuests([
          {
            name: input.name.trim(),
            count: Math.max(1, input.count),
            remark: input.remark.trim(),
            hasChild: input.hasChild,
            rsvp: input.rsvp,
            tableNumbers: null,
            avoid: "",
            groupId: 99,
          },
        ]);
        set((s) => ({ guests: [...s.guests, ...rows] }));
      },
      updateGuest: (id, patch) => {
        get().capture();
        set((s) => {
          const current = s.guests.find((g) => g.id === id);
          if (!current) return s;
          const guests = s.guests.map((g) => {
            if (g.id === id) return { ...g, ...patch };
            if (
              g.partyId === current.partyId &&
              g.role === "companion" &&
              patch.name &&
              current.role === "lead" &&
              isDefaultCompanionName(current.name, g.name, s.guests.filter((x) => x.partyId === current.partyId).length)
            ) {
              const partyGuests = s.guests.filter((x) => x.partyId === current.partyId);
              const companions = partyGuests.filter((x) => x.role === "companion");
              const idx = companions.findIndex((c) => c.id === g.id) + 1;
              return { ...g, name: companionName(patch.name, idx, partyGuests.length) };
            }
            if (g.partyId === current.partyId && patch.remark != null) return { ...g, remark: patch.remark };
            if (g.partyId === current.partyId && patch.rsvp != null) return { ...g, rsvp: patch.rsvp };
            return g;
          });
          return { guests };
        });
      },
      removeParty: (partyId) => {
        get().capture();
        set((s) => ({
          guests: s.guests.filter((g) => g.partyId !== partyId),
          selectedGuestId: s.guests.find((g) => g.id === s.selectedGuestId)?.partyId === partyId ? null : s.selectedGuestId,
        }));
      },
      toggleAvoid: (partyA, partyB) => {
        if (partyA === partyB) return;
        get().capture();
        set((s) => ({
          guests: s.guests.map((g) => {
            if (g.partyId !== partyA && g.partyId !== partyB) return g;
            const other = g.partyId === partyA ? partyB : partyA;
            const has = g.avoidPartyIds.includes(other);
            return {
              ...g,
              avoidPartyIds: has ? g.avoidPartyIds.filter((id) => id !== other) : [...g.avoidPartyIds, other],
            };
          }),
        }));
      },
      setSelectedHall: (selectedHallId) => set({ selectedHallId, selectedTableId: null }),
      setSelectedTable: (selectedTableId) => set({ selectedTableId }),
      setHallCounts: (left, right) => {
        const current = get();
        const spot = current.hall.spots.find((sp) => sp.id === current.selectedHallId);
        if (!spot) return false;
        if (spot.locked) return false;
        const plan = normalizePlan({ left, right });
        get().capture();
        set((s) => {
          const applied = applyHallCounts(s.tables, s.guests, s.hall, spot.id, plan);
          const nextSpot = applied.hall.spots.find((sp) => sp.id === spot.id);
          const layoutPlan =
            s.hall.spots[0]?.id === spot.id && nextSpot
              ? { left: nextSpot.left, right: nextSpot.right }
              : s.layoutPlan;
          const spots = alignHallSpots(applied.hall.spots);
          const hall = ensureHallFits(applied.tables, { ...applied.hall, spots });
          return { tables: applied.tables, hall, layoutPlan };
        });
        return true;
      },
      addTable: () => {
        const current = get();
        const spot = current.hall.spots.find((sp) => sp.id === current.selectedHallId);
        if (!spot) return "need-hall";
        if (spot.locked) return "locked";
        const mine = current.tables.filter((t) => t.hallId === spot.id);
        if (mine.length >= MAX_HALL_TABLES) return "full";
        const capacity = spot.left + spot.right;
        const plan =
          mine.length < capacity
            ? normalizePlan({ left: spot.left, right: spot.right })
            : growPlanEven({ left: spot.left, right: spot.right });
        if (!plan) return "full";
        get().capture();
        set((s) => {
          const spots = s.hall.spots.map((sp) => (sp.id === spot.id ? { ...sp, left: plan.left, right: plan.right } : sp));
          const hall = { ...s.hall, spots };
          const table = createTable(s.tables, hall, false, plan, spot.id);
          table.note = "无备注";
          const tables = [...s.tables, table];
          const layoutPlan = s.hall.spots[0]?.id === spot.id ? plan : s.layoutPlan;
          return { tables, layoutPlan, hall: ensureHallFits(tables, hall) };
        });
        return "ok";
      },
      removeTable: (id) => {
        const s = get();
        const table = s.tables.find((t) => t.id === id);
        if (!table) return "missing";
        const spot = s.hall.spots.find((sp) => sp.id === table.hallId);
        if (!spot) return "missing";
        if (spot.locked || table.locked) return "locked";
        const mine = s.tables.filter((t) => t.hallId === spot.id);
        if (mine.length <= 1) return "last";
        const size = sheetSize({ left: spot.left || 8, right: spot.right || 8 });
        const onLeft = table.x < size.width / 2;
        let left = spot.left;
        let right = spot.right;
        if (onLeft && left > 0) left -= 1;
        else if (right > 0) right -= 1;
        else if (left > 0) left -= 1;
        const plan = normalizePlan({ left, right });
        if (plan.left + plan.right < 1) return "last";
        get().capture();
        set((st) => {
          const remaining = st.tables
            .filter((t) => t.hallId === spot.id && t.id !== id)
            .sort((a, b) => a.number - b.number)
            .map((t, index) => ({ ...t, ...sheetPosition(index, plan), hallId: spot.id }));
          const others = st.tables.filter((t) => t.hallId !== spot.id);
          const tables = [...others, ...remaining];
          const hall = {
            ...st.hall,
            spots: st.hall.spots.map((sp) => (sp.id === spot.id ? { ...sp, left: plan.left, right: plan.right } : sp)),
          };
          return {
            tables,
            hall: ensureHallFits(tables, hall),
            guests: st.guests.map((g) => (g.tableId === id ? { ...g, tableId: null, seatIndex: null } : g)),
            layoutPlan: st.hall.spots[0]?.id === spot.id ? plan : st.layoutPlan,
            selectedTableId: st.selectedTableId === id ? null : st.selectedTableId,
          };
        });
        return "ok";
      },
      removeHall: (id) => {
        const s = get();
        const spot = s.hall.spots.find((sp) => sp.id === id);
        if (!spot) return "missing";
        if (s.hall.spots.length <= 1) return "last";
        if (spot.locked) return "locked";
        get().capture();
        set((st) => {
          const gone = new Set(st.tables.filter((t) => t.hallId === id).map((t) => t.id));
          const tables = st.tables.filter((t) => t.hallId !== id);
          const spots = alignHallSpots(st.hall.spots.filter((sp) => sp.id !== id));
          const selectedHallId = st.selectedHallId === id ? spots[0]?.id ?? null : st.selectedHallId;
          return {
            tables,
            hall: ensureHallFits(tables, { ...st.hall, spots }),
            guests: st.guests.map((g) => (g.tableId && gone.has(g.tableId) ? { ...g, tableId: null, seatIndex: null } : g)),
            selectedHallId,
            selectedTableId: null,
          };
        });
        return "ok";
      },
      nudgeTable: (id, x, y) =>
        set((s) => {
          const current = s.tables.find((t) => t.id === id);
          if (!current || current.locked) return s;
          const spot = s.hall.spots.find((sp) => sp.id === current.hallId);
          const m = sheetMetrics({ left: spot?.left || 8, right: spot?.right || 8 });
          const nextX = Math.max(160, Math.min(m.width - 160, x));
          const nextY = Math.max(m.firstY - 20, Math.min(m.height - 180, y));
          const tables = s.tables.map((t) => (t.id === id ? { ...t, x: nextX, y: nextY } : t));
          return { tables, hall: ensureHallFits(tables, s.hall), selectedTableId: id };
        }),
      toggleTableLock: (id) => {
        get().capture();
        set((s) => ({
          tables: s.tables.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t)),
        }));
      },
      setMainTable: (id) => {
        get().capture();
        set((s) => ({
          tables: s.tables.map((t) => ({
            ...t,
            isMain: t.id === id,
            note: t.id === id ? t.note || "主桌" : t.isMain ? "" : t.note,
            numberLocked: t.id === id ? true : t.numberLocked,
          })),
        }));
      },
      toggleLockNumber: (id) => {
        get().capture();
        set((s) => ({
          tables: s.tables.map((t) => (t.id === id ? { ...t, numberLocked: !t.numberLocked } : t)),
        }));
      },
      updateTableNote: (id, note) => set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, note } : t)) })),
      renumber: () => {
        get().capture();
        set((s) => ({ tables: renumberByPosition(s.tables) }));
      },
      autoSeat: () => {
        get().capture();
        set((s) => {
          const next = autoAssign(s);
          return { ...next };
        });
      },
      assignSeat: (guestId, tableId, seatIndex) => {
        const current = get();
        const table = current.tables.find((t) => t.id === tableId);
        const mover = current.guests.find((g) => g.id === guestId);
        const lockedHall = (hallId?: string) => current.hall.spots.some((sp) => sp.id === hallId && sp.locked);
        if (!table || !mover || table.locked || lockedHall(table.hallId)) return;
        const from = current.tables.find((t) => t.id === mover.tableId);
        if (from?.locked || lockedHall(from?.hallId)) return;
        const occupant = current.guests.find((g) => g.tableId === tableId && g.seatIndex === seatIndex && g.id !== guestId);
        if (occupant) {
          const occupantTable = current.tables.find((t) => t.id === occupant.tableId);
          if (occupantTable?.locked) return;
        }
        get().capture();
        set((s) => {
          const guests = s.guests.map((g) => {
            if (g.id === mover.id) return { ...g, tableId, seatIndex };
            if (occupant && g.id === occupant.id) {
              return { ...g, tableId: mover.tableId, seatIndex: mover.seatIndex };
            }
            return g;
          });
          return { guests };
        });
      },
      unassign: (guestId) => {
        const current = get();
        const mover = current.guests.find((g) => g.id === guestId);
        if (!mover) return;
        const from = current.tables.find((t) => t.id === mover.tableId);
        if (from?.locked || current.hall.spots.some((sp) => sp.id === from?.hallId && sp.locked)) return;
        get().capture();
        set((s) => ({
          guests: s.guests.map((g) => (g.id === guestId ? { ...g, tableId: null, seatIndex: null } : g)),
        }));
      },
      setSelectedGuest: (selectedGuestId) => set({ selectedGuestId }),
      setMobileTab: (mobileTab) => set({ mobileTab }),
      setQuery: (query) => set({ query }),
      setHallSeats: (seats) => {
        const current = get();
        const spot = current.hall.spots.find((sp) => sp.id === current.selectedHallId);
        if (!spot || spot.locked) return false;
        const count = Math.max(1, Math.min(20, Math.round(seats) || 10));
        if (count === spot.seats) return true;
        get().capture();
        set((s) => ({
          hall: {
            ...s.hall,
            spots: s.hall.spots.map((sp) => (sp.id === spot.id ? { ...sp, seats: count } : sp)),
          },
          tables: s.tables.map((t) => (t.hallId === spot.id ? { ...t, seats: count } : t)),
        }));
        return true;
      },
      createHall: ({ name, left, right, seats }) => {
        const plan = normalizePlan({ left, right });
        const seatCount = Math.max(1, Math.min(20, Math.round(seats) || 10));
        get().capture();
        set((s) => {
          const spots = s.hall.spots?.length ? s.hall.spots : [makeSpot(1)];
          const index = spots.length + 1;
          const spot = makeSpot(index, 80, 48, plan, seatCount);
          spot.name = name.trim() || `${index}号厅`;
          let tables = [...s.tables];
          const aligned = alignHallSpots([...spots, spot]);
          let hall = { ...s.hall, spots: aligned };
          for (let i = 0; i < plan.left + plan.right; i += 1) {
            const table = createTable(tables, hall, false, plan, spot.id);
            table.note = "无备注";
            tables.push(table);
          }
          hall = ensureHallFits(tables, hall);
          return { tables, hall, selectedHallId: spot.id, selectedTableId: null };
        });
      },
      nudgeHall: (id, dx, dy) =>
        set((s) => {
          const spot = s.hall.spots.find((sp) => sp.id === id);
          if (!spot || spot.locked || (dx === 0 && dy === 0)) return s;
          const spots = s.hall.spots.map((sp) =>
            sp.id === id ? { ...sp, x: sp.x + dx, y: sp.y + dy } : sp,
          );
          return { hall: ensureHallFits(s.tables, { ...s.hall, spots }) };
        }),
      toggleHallLock: (id) => {
        get().capture();
        set((s) => ({
          hall: {
            ...s.hall,
            spots: s.hall.spots.map((sp) => (sp.id === id ? { ...sp, locked: !sp.locked } : sp)),
          },
        }));
      },
      resetAll: () => {
        const next = fresh();
        set({ ...next, past: [], future: [], selectedGuestId: null });
      },
    }),
    {
      name: "wedding-seating-v1",
      storage: createJSONStorage(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        return {
          getItem: (name) => localStorage.getItem(name),
          setItem: (name, value) => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => localStorage.setItem(name, value), 400);
          },
          removeItem: (name) => localStorage.removeItem(name),
        };
      }),
      partialize: (s) => ({
        eventName: s.eventName,
        guests: s.guests,
        tables: s.tables,
        hall: s.hall,
        layoutPlan: s.layoutPlan,
        layoutVersion: s.layoutVersion,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const version = state.layoutVersion ?? 0;
        const needsLayout = version < 2;
        const needsSpots = !state.hall?.spots?.length || state.tables?.some((t) => !t.hallId);
        const needsSheets = version < 4;
        const needsStageClear = version < 12;
        if (!needsLayout && !needsSpots && !needsSheets && !needsStageClear) return;
        const existing = state.tables ?? [];
        const guests = state.guests ?? [];
        const bare = guests.length === 0 && existing.length <= 1;
        const left = Math.min(DEFAULT_LEFT_TABLES, Math.max(existing.length, 1));
        const plan = bare
          ? normalizePlan(state.layoutPlan)
          : normalizePlan({ left, right: Math.max(0, existing.length - left) });
        const hall = state.hall?.spots?.length
          ? state.hall
          : { ...(state.hall ?? defaultHall()), spots: [makeSpot(1)] };
        setTimeout(() => {
          let nextTables = existing;
          let nextHall = hall;
          let layoutPlan = state.layoutPlan ?? plan;
          if (needsLayout) {
            const fitted = bare
              ? fitTablesToPlan(existing, guests, hall, plan)
              : {
                  tables: layoutBanquet(existing, plan, hall),
                  hall: ensureHallFits(layoutBanquet(existing, plan, hall), hall),
                };
            nextTables = fitted.tables.map((t) => ({ ...t, hallId: t.hallId || fitted.hall.spots[0]?.id || "hall-1" }));
            const placed = sheetsFromWorld(nextTables, fitted.hall.spots, plan);
            nextTables = placed.tables;
            nextHall = ensureHallFits(nextTables, { ...fitted.hall, spots: placed.spots });
            layoutPlan = plan;
          } else if (needsSheets || needsSpots) {
            const spot = nextHall.spots?.[0] ?? makeSpot(1);
            const spots = (nextHall.spots?.length ? nextHall.spots : [spot]).map((sp) => ({
              ...sp,
              left: sp.left ?? plan.left,
              right: sp.right ?? plan.right,
            }));
            nextTables = nextTables.map((t) => ({ ...t, hallId: t.hallId || spots[0].id }));
            const placed = sheetsFromWorld(nextTables, spots, layoutPlan);
            nextTables = placed.tables;
            nextHall = ensureHallFits(nextTables, { ...nextHall, spots: placed.spots });
          }
          if (needsStageClear) {
            const spots = alignHallSpots(
              (nextHall.spots?.length ? nextHall.spots : [makeSpot(1)]).map((sp) => ({
                ...sp,
                ...normalizePlan({ left: sp.left, right: sp.right }),
              })),
            );
            nextHall = { ...nextHall, spots };
            nextTables = nextTables.map((table) => {
              const spot = spots.find((sp) => sp.id === table.hallId) ?? spots[0];
              if (!spot) return table;
              const mine = nextTables.filter((t) => t.hallId === spot.id).sort((a, b) => a.number - b.number);
              const at = Math.max(0, mine.findIndex((t) => t.id === table.id));
              return { ...table, ...sheetPosition(at, { left: spot.left, right: spot.right }), hallId: spot.id };
            });
            nextHall = ensureHallFits(nextTables, nextHall);
          }
          useWedding.setState({
            layoutPlan,
            layoutVersion: 12,
            tables: nextTables,
            hall: nextHall,
          });
        }, 0);
      },
    },
  ),
);

export function statsFrom(s: { guests: Guest[]; tables: Table[] }) {
  const seated = s.guests.filter((g) => g.tableId).length;
  return {
    people: s.guests.length,
    seated,
    pending: s.guests.length - seated,
    tables: s.tables.length,
    child: s.guests.filter((g) => g.hasChild).length,
    full: s.tables.filter((t) => occupiedCount(t.id, s.guests) >= t.seats).length,
  };
}
