import {
  DEFAULT_SEATS,
  HALL_HEIGHT,
  HALL_WIDTH,
  TABLE_RADIUS,
  type Hall,
  type HallSpot,
  type LayoutPlan,
  type Table,
  type Theme,
} from "../types";
import { uid } from "./ids";

/** 基准列位（旧坐标参考）；实际由 sheetCols 按桌缩放重算。 */
export const SHEET_COLS = [380, 900, 1680, 2200] as const;
/** 舞台预留：桌心在此 y，备注在中心上方，不压舞台。 */
export const SHEET_FIRST_Y = 1000;
export const SHEET_ROW = 360;
export const SHEET_BOTTOM = 520;
export const SHEET_W = 2580;
export const HALL_GAP = 120;
export const MAX_SIDE_TABLES = 15;
export const MAX_HALL_TABLES = 30;
/**
 * 未缩放单桌占位（备注 + 席位 + 按钮）。
 * 行距用「整桌高 + 小缝」，空隙拿去放大桌子，而不是留空。
 */
const TABLE_FOOT_W = 300;
const TABLE_FOOT_H = 400;
/** 落座名芯片基准字号（px），供导出 pt 估算。 */
export const NAME_CHIP_PX = 20;

export function sheetRows(plan: LayoutPlan): number {
  return Math.max(Math.ceil(Math.max(0, plan.left) / 2), Math.ceil(Math.max(0, plan.right) / 2), 1);
}

/**
 * 单桌（含人名、备注）整体缩放：少桌明显放大填满落座区，多桌略收。
 * 看清人名优先；不重叠、不压红毯。
 */
export function tableScaleForPlan(plan: LayoutPlan): number {
  return sheetMetrics(plan).scale;
}

export function sheetMetrics(plan: LayoutPlan): {
  width: number;
  height: number;
  firstY: number;
  row: number;
  bottom: number;
  scale: number;
} {
  const rows = sheetRows(plan);
  const n = Math.max(1, plan.left + plan.right);
  // 8→1.85 · 16→1.55 · 24→1.18 · 30→1.02 —— 吃掉行间空白来放大字
  const target = Math.max(1.0, Math.min(1.9, 2.05 - (n - 8) * 0.045));

  // 宽度跟桌放大走，但不无无天际，方便多厅缩进一屏
  const width = Math.round(
    Math.min(3000, Math.max(SHEET_W, 4 * TABLE_FOOT_W * target + 480 + Math.max(0, rows - 5) * 24)),
  );
  const maxByWidth = (width - 200) / (4 * TABLE_FOOT_W);
  const scale = Math.max(1.0, Math.min(target, maxByWidth));

  const firstY = SHEET_FIRST_Y;
  // 只留一小缝，空隙都给单桌放大
  const row = Math.round(TABLE_FOOT_H * scale + 28);
  const bottom = Math.round(TABLE_FOOT_H * scale * 0.52 + 240);
  const height = firstY + Math.max(0, rows - 1) * row + bottom;
  return { width, height, firstY, row, bottom, scale };
}

export function sheetSize(plan: LayoutPlan): { width: number; height: number } {
  const m = sheetMetrics(plan);
  return { width: m.width, height: m.height };
}

/** 四列桌心 X：铺满左右落座带，中间红毯留空，不压毯。 */
export function sheetCols(width = SHEET_W, scale = 1): readonly [number, number, number, number] {
  const foot = TABLE_FOOT_W * Math.max(0.95, scale);
  // 红毯约 14%，左右落座带尽量铺满
  const aisle = Math.max(300, Math.round(width * 0.14));
  const pad = Math.max(70, Math.round(foot * 0.22));
  const band = (width - aisle) / 2;
  const minSpan = foot + 16;
  let c0 = Math.round(pad + foot / 2);
  let c1 = Math.round(band - pad - foot / 2);
  let c2 = Math.round(band + aisle + pad + foot / 2);
  let c3 = Math.round(width - pad - foot / 2);
  if (c1 - c0 < minSpan) {
    const mid = (c0 + c1) / 2;
    c0 = Math.round(mid - minSpan / 2);
    c1 = Math.round(mid + minSpan / 2);
  }
  if (c3 - c2 < minSpan) {
    const mid = (c2 + c3) / 2;
    c2 = Math.round(mid - minSpan / 2);
    c3 = Math.round(mid + minSpan / 2);
  }
  return [c0, c1, c2, c3] as const;
}

/** 图纸内部坐标：先左后右，每侧两列横排。 */
export function sheetPosition(index: number, plan: LayoutPlan = defaultLayoutPlan()): { x: number; y: number } {
  const leftSlots = Math.max(0, plan.left);
  const onLeft = index < leftSlots;
  const local = onLeft ? index : index - leftSlots;
  const row = Math.floor(local / 2);
  const col = local % 2;
  const m = sheetMetrics(plan);
  const cols = sheetCols(m.width, m.scale);
  return {
    x: onLeft ? cols[col] : cols[2 + col],
    y: m.firstY + row * m.row,
  };
}

/** 多厅横向紧挨平行，少留空隙，便于一屏装下。 */
export function alignHallSpots(spots: HallSpot[]): HallSpot[] {
  let x = 0;
  const y = 0;
  return spots.map((sp) => {
    const size = sheetSize({ left: sp.left || 8, right: sp.right || 8 });
    const next = { ...sp, x, y };
    x += size.width + HALL_GAP;
    return next;
  });
}

export function makeSpot(
  index: number,
  x = 0,
  y = 0,
  plan: LayoutPlan = { left: 8, right: 8 },
  seats = DEFAULT_SEATS,
): HallSpot {
  return {
    id: uid("h"),
    name: `${index}号厅`,
    x,
    y,
    locked: false,
    left: plan.left,
    right: plan.right,
    seats,
  };
}

export function defaultHall(theme: Theme = "chinese"): Hall {
  return { width: HALL_WIDTH, height: HALL_HEIGHT, theme, spots: [makeSpot(1)] };
}

export function normalizeHall(hall?: Partial<Hall> | null, theme: Theme = "chinese"): Hall {
  const next = defaultHall(hall?.theme || theme);
  return {
    width: hall?.width && hall.width > 0 ? hall.width : next.width,
    height: hall?.height && hall.height > 0 ? hall.height : next.height,
    theme: hall?.theme || theme,
    spots: hall?.spots?.length ? hall.spots : next.spots,
  };
}

/** 每侧两列。中线 1200 是 T 台，左右列间距留足人名。 */
export const COL_X = [300, 820, 1580, 2100] as const;
export const AISLE_CENTER = 1200;
export const FIRST_ROW_Y = 340;
export const ROW_GAP = 340;
export const DEFAULT_LEFT_TABLES = 8;
export const DEFAULT_RIGHT_TABLES = 8;

export function defaultLayoutPlan(): LayoutPlan {
  return { left: DEFAULT_LEFT_TABLES, right: DEFAULT_RIGHT_TABLES };
}

export function normalizePlan(plan?: Partial<LayoutPlan> | null): LayoutPlan {
  const clamp = (n: number | undefined, fallback: number) => {
    const value = Number(n);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(MAX_SIDE_TABLES, Math.round(value)));
  };
  let left = clamp(plan?.left, DEFAULT_LEFT_TABLES);
  let right = clamp(plan?.right, DEFAULT_RIGHT_TABLES);
  if (left + right < 1) left = 1;
  if (left + right > MAX_HALL_TABLES) {
    const overflow = left + right - MAX_HALL_TABLES;
    if (right >= left) right = Math.max(0, right - overflow);
    else left = Math.max(1, left - overflow);
  }
  return { left, right };
}

/** 单厅加桌时左右尽量均匀。 */
export function growPlanEven(plan: LayoutPlan): LayoutPlan | null {
  const left = plan.left;
  const right = plan.right;
  if (left + right >= MAX_HALL_TABLES) return null;
  if (left <= right && left < MAX_SIDE_TABLES) return normalizePlan({ left: left + 1, right });
  if (right < MAX_SIDE_TABLES) return normalizePlan({ left, right: right + 1 });
  if (left < MAX_SIDE_TABLES) return normalizePlan({ left: left + 1, right });
  return null;
}

/**
 * 序号从 0 起。先排满左侧两列：第 1 行靠外、靠 T 台，下一行继续。
 * 左侧桌数用完后，从右侧靠 T 台那一列重新从第一行往下排。
 */
export function banquetPosition(index: number, plan: LayoutPlan = defaultLayoutPlan()): { x: number; y: number } {
  const leftSlots = Math.max(0, plan.left);
  const onLeft = index < leftSlots;
  const local = onLeft ? index : index - leftSlots;
  const row = Math.floor(local / 2);
  const col = local % 2;
  return {
    x: onLeft ? COL_X[col] : COL_X[2 + col],
    y: FIRST_ROW_Y + row * ROW_GAP,
  };
}

function planForSpot(spot: HallSpot | undefined, fallback: LayoutPlan, count: number): LayoutPlan {
  const base = normalizePlan(spot ? { left: spot.left, right: spot.right } : fallback);
  if (count <= base.left + base.right) return base;
  return normalizePlan({ left: base.left, right: Math.max(0, count - base.left) });
}

/** 每张图纸内部重新落位。先左后右，桌号顺序不变。 */
export function layoutBanquet(tables: Table[], plan: LayoutPlan = defaultLayoutPlan(), hall?: Hall): Table[] {
  const fallbackId = hall?.spots?.[0]?.id || "hall-1";
  const placed = new Map<string, { x: number; y: number; hallId: string }>();
  const groups = new Map<string, Table[]>();
  for (const table of tables) {
    const hallId = table.hallId || fallbackId;
    const list = groups.get(hallId) ?? [];
    list.push(table);
    groups.set(hallId, list);
  }
  for (const [hallId, group] of groups) {
    const spot = hall?.spots?.find((s) => s.id === hallId);
    const local = planForSpot(spot, plan, group.length);
    const ordered = [...group].sort((a, b) => a.number - b.number);
    ordered.forEach((table, index) => {
      placed.set(table.id, { ...sheetPosition(index, local), hallId });
    });
  }
  return tables.map((table) => {
    const pos = placed.get(table.id);
    if (!pos) return { ...table, hallId: table.hallId || fallbackId };
    return { ...table, x: pos.x, y: pos.y, hallId: pos.hallId };
  });
}

/** 把旧的全场坐标收成每张厅纸自己的桌位，只在升级时跑一次。 */
export function sheetsFromWorld(
  tables: Table[],
  spots: HallSpot[],
  fallback: LayoutPlan,
): { tables: Table[]; spots: HallSpot[] } {
  const nextSpots = spots.map((spot, index) => {
    const mine = tables.filter((t) => t.hallId === spot.id);
    const left = Number.isFinite(spot.left) ? spot.left : fallback.left;
    const right = Number.isFinite(spot.right) ? spot.right : Math.max(fallback.right, Math.max(0, mine.length - left));
    return {
      ...spot,
      x: index * (SHEET_W + HALL_GAP),
      y: 0,
      left,
      right: Math.max(right, Math.max(0, mine.length - left)),
      seats: spot.seats && spot.seats > 0 ? spot.seats : DEFAULT_SEATS,
    };
  });
  const nextTables = tables.map((table) => {
    const spot = nextSpots.find((s) => s.id === table.hallId) ?? nextSpots[0];
    if (!spot) return table;
    const mine = tables.filter((t) => t.hallId === spot.id).sort((a, b) => a.number - b.number);
    const at = Math.max(0, mine.findIndex((t) => t.id === table.id));
    const local = planForSpot(spot, fallback, mine.length);
    return { ...table, ...sheetPosition(at, local), hallId: table.hallId || spot.id };
  });
  return { tables: nextTables, spots: nextSpots };
}

export function fitTablesToPlan(
  tables: Table[],
  guests: { tableId: string | null }[],
  hall: Hall,
  plan: LayoutPlan,
): { tables: Table[]; hall: Hall } {
  const normalized = normalizePlan(plan);
  let next = tables.map((t) => ({ ...t }));
  const target = normalized.left + normalized.right;
  const baseHall = { ...hall, width: HALL_WIDTH, height: HALL_HEIGHT };
  while (next.length < target) {
    const table = createTable(next, baseHall, next.length === 0, normalized);
    table.note = "无备注";
    next.push(table);
  }
  while (next.length > target) {
    const victim = [...next]
      .sort((a, b) => b.number - a.number)
      .find((t) => !t.locked && !guests.some((g) => g.tableId === t.id));
    if (!victim) break;
    next = next.filter((t) => t.id !== victim.id);
  }
  if (!next.length) {
    const table = createTable([], baseHall, true, normalized);
    table.note = "无备注";
    next = [table];
  }
  next = layoutBanquet(next, normalized, baseHall);
  return { tables: next, hall: ensureHallFits(next, baseHall) };
}

export function defaultMainTable(plan: LayoutPlan = defaultLayoutPlan(), hallId = "hall-1"): Table {
  const pos = sheetPosition(0, plan);
  return {
    id: uid("t"),
    number: 1,
    numberLocked: true,
    locked: false,
    x: pos.x,
    y: pos.y,
    seats: DEFAULT_SEATS,
    isMain: true,
    note: "",
    hallId,
  };
}

export function tablesOverlap(a: Table, b: Table, extra = 56): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < TABLE_RADIUS * 2 + extra;
}

export function nextTableSlot(tables: Table[], hall: Hall, plan: LayoutPlan = defaultLayoutPlan()): { x: number; y: number } {
  void hall;
  return banquetPosition(tables.length, plan);
}

export function createTable(
  tables: Table[],
  hall: Hall,
  isMain = false,
  plan: LayoutPlan = defaultLayoutPlan(),
  hallId?: string,
): Table {
  const spot = hall.spots?.find((s) => s.id === hallId) ?? hall.spots?.[0];
  const spotId = spot?.id || hallId || "hall-1";
  const mine = tables.filter((t) => (t.hallId || spotId) === spotId);
  const local = planForSpot(spot, plan, mine.length + 1);
  const pos = sheetPosition(mine.length, local);
  const used = new Set(tables.map((t) => t.number));
  let number = 1;
  while (used.has(number)) number += 1;
  return {
    id: uid("t"),
    number,
    numberLocked: isMain,
    locked: false,
    x: pos.x,
    y: pos.y,
    seats: spot?.seats && spot.seats > 0 ? spot.seats : DEFAULT_SEATS,
    isMain,
    note: "",
    hallId: spotId,
  };
}

/** 只改选中厅的左右桌数，其它厅的桌子不动。 */
export function applyHallCounts(
  tables: Table[],
  guests: { tableId: string | null }[],
  hall: Hall,
  spotId: string,
  plan: LayoutPlan,
): { tables: Table[]; hall: Hall } {
  const normalized = normalizePlan(plan);
  const spots = hall.spots.map((sp) => (sp.id === spotId ? { ...sp, left: normalized.left, right: normalized.right } : sp));
  let nextHall: Hall = { ...hall, spots };
  let mine = tables.filter((t) => t.hallId === spotId);
  const others = tables.filter((t) => t.hallId !== spotId);
  const target = normalized.left + normalized.right;
  while (mine.length < target) {
    const table = createTable([...others, ...mine], nextHall, false, normalized, spotId);
    table.note = "无备注";
    mine.push(table);
  }
  while (mine.length > target) {
    const victim = [...mine]
      .sort((a, b) => b.number - a.number)
      .find((t) => !t.locked && !guests.some((g) => g.tableId === t.id));
    if (!victim) break;
    mine = mine.filter((t) => t.id !== victim.id);
  }
  const fitted = planForSpot(
    nextHall.spots.find((sp) => sp.id === spotId),
    normalized,
    mine.length,
  );
  const ordered = [...mine].sort((a, b) => a.number - b.number);
  mine = ordered.map((table, index) => ({ ...table, ...sheetPosition(index, fitted), hallId: spotId }));
  nextHall = {
    ...nextHall,
    spots: nextHall.spots.map((sp) => (sp.id === spotId ? { ...sp, left: fitted.left, right: fitted.right } : sp)),
  };
  const all = [...others, ...mine];
  return { tables: all, hall: ensureHallFits(all, nextHall) };
}

export function ensureHallFits(tables: Table[], hall: Hall): Hall {
  const spots = (hall.spots?.length ? hall.spots : defaultHall(hall.theme).spots).map((sp) => ({
    ...sp,
    left: sp.left ?? DEFAULT_LEFT_TABLES,
    right: sp.right ?? DEFAULT_RIGHT_TABLES,
    seats: sp.seats && sp.seats > 0 ? sp.seats : DEFAULT_SEATS,
  }));
  // 画布紧包厅纸，不再垫一大块「底布」空白
  let maxX = 40;
  let maxY = 40;
  for (const spot of spots) {
    const size = sheetSize({ left: spot.left, right: spot.right });
    maxX = Math.max(maxX, spot.x + size.width + 24);
    maxY = Math.max(maxY, spot.y + size.height + 24);
  }
  void tables;
  return { ...hall, spots, width: Math.ceil(Math.max(maxX, HALL_WIDTH)), height: Math.ceil(Math.max(maxY, HALL_HEIGHT)) };
}

export function seatPoint(index: number, seats: number, radius = 196): { x: number; y: number; deg: number } {
  const angle = -Math.PI / 2 + (index / seats) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    deg: (angle * 180) / Math.PI,
  };
}

export function renumberByPosition(tables: Table[]): Table[] {
  const lockedNums = new Set(tables.filter((t) => t.numberLocked).map((t) => t.number));
  const free = tables.filter((t) => !t.numberLocked);
  const byRow = (a: Table, b: Table) => a.y - b.y || a.x - b.x;
  const freeIds = [
    ...free.filter((t) => t.x < AISLE_CENTER).sort(byRow),
    ...free.filter((t) => t.x >= AISLE_CENTER).sort(byRow),
  ].map((t) => t.id);
  let n = 1;
  const take = () => {
    while (lockedNums.has(n)) n += 1;
    const value = n;
    n += 1;
    return value;
  };
  const assigned = new Map<string, number>();
  for (const id of freeIds) assigned.set(id, take());
  return tables.map((t) => (t.numberLocked ? t : { ...t, number: assigned.get(t.id) ?? t.number }));
}
