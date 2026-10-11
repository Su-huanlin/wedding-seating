import type { Guest, Rsvp } from "../types";
import { uid } from "./ids";

export interface IngestRow {
  name: string;
  count: number;
  rsvp: Rsvp;
  remark: string;
  hasChild: boolean;
  tableNumbers: number[] | null;
  avoid: string;
  groupId: number;
}

/** 「10」「10、11、12」「10-12」都当成要按顺序坐满的桌号。 */
export function parseTableNumbers(v: unknown): number[] | null {
  const raw = cell(v);
  if (!raw) return null;
  const nums: number[] = [];
  for (const part of raw.split(/[、,，;；/\s]+/).map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*[-~到至]\s*(\d+)$/);
    if (range) {
      let a = Number(range[1]);
      let b = Number(range[2]);
      if (a > b) [a, b] = [b, a];
      for (let n = a; n <= b && nums.length < 40; n += 1) nums.push(n);
      continue;
    }
    const n = Number(part);
    if (Number.isFinite(n) && n > 0) nums.push(Math.round(n));
  }
  return nums.length ? nums : null;
}

function cell(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function norm(v: unknown): string {
  return cell(v).toLowerCase().replace(/\s+/g, "");
}

function parseCount(v: unknown): number {
  const n = Number(cell(v));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(12, Math.round(n));
}

function parseRsvp(v: unknown): Rsvp {
  const s = norm(v);
  if (!s) return "yes";
  if (/^(否|未到|不到|缺席|no|n|0|false)$/.test(s)) return "no";
  if (/待定|不确定|pending|\?/.test(s)) return "pending";
  return "yes";
}

function parseChild(v: unknown): boolean {
  const s = norm(v);
  if (!s) return false;
  return /是|有|带|yes|y|1|true|小孩/.test(s);
}

function headerIndex(headers: string[]): Record<string, number> {
  const found: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    if (n.includes("姓名") || n === "name" || n.includes("名字")) found.name = i;
    else if (n.includes("人数") || n === "count" || n.includes("人数")) found.count = i;
    else if (n.includes("是否到") || n.includes("到场") || n.includes("rsvp")) found.rsvp = i;
    else if (n.includes("小孩") || n.includes("带孩") || n.includes("child")) found.child = i;
    else if (n.includes("避开") || n.includes("avoid") || n.includes("不同桌")) found.avoid = i;
    else if (n.includes("桌号") || n.includes("桌次") || n === "table") found.table = i;
    else if (n.includes("备注") || n.includes("remark") || n.includes("note") || n.includes("分组")) found.remark = i;
  });
  return found;
}

export function companionName(leadName: string, index: number, size: number): string {
  if (size === 2) return `${leadName}家属`;
  return `${leadName}家属${index}`;
}

export function isDefaultCompanionName(leadName: string, companion: string, size: number): boolean {
  if (size === 2) return companion === `${leadName}家属`;
  return companion.startsWith(`${leadName}家属`);
}

function blockKey(row: IngestRow): string {
  return `${row.groupId}|${row.tableNumbers?.join(",") ?? ""}`;
}

/** 同一桌里没写备注的人，跟上这一桌已经写过的备注，避免被拆成「无备注」。 */
function fillBlockRemarks(rows: IngestRow[]): void {
  let i = 0;
  while (i < rows.length) {
    const key = blockKey(rows[i]);
    let j = i + 1;
    while (j < rows.length && blockKey(rows[j]) === key) j += 1;
    const remark = rows.slice(i, j).find((row) => row.remark)?.remark ?? "";
    if (remark) {
      for (let k = i; k < j; k += 1) if (!rows[k].remark) rows[k].remark = remark;
    }
    i = j;
  }
}

export function rowsToGuests(rows: IngestRow[]): Guest[] {
  const guests: Guest[] = [];
  for (const row of rows) {
    const partyId = uid("p");
    const lead: Guest = {
      id: uid("g"),
      name: row.name,
      role: "lead",
      partyId,
      groupId: row.groupId,
      remark: row.remark,
      rsvp: row.rsvp,
      hasChild: row.hasChild,
      avoidPartyIds: [],
      tableId: null,
      seatIndex: null,
      preferredTableNumber: row.tableNumbers?.[0] ?? null,
      preferredTableNumbers: row.tableNumbers ? [...row.tableNumbers] : null,
    };
    guests.push(lead);
    for (let i = 1; i < row.count; i += 1) {
      guests.push({
        id: uid("g"),
        name: companionName(row.name, i, row.count),
        role: "companion",
        partyId,
        groupId: row.groupId,
        remark: row.remark,
        rsvp: row.rsvp,
        hasChild: false,
        avoidPartyIds: [],
        tableId: null,
        seatIndex: null,
        preferredTableNumber: row.tableNumbers?.[0] ?? null,
        preferredTableNumbers: row.tableNumbers ? [...row.tableNumbers] : null,
      });
    }
  }
  return guests;
}

export function parseGrid(grid: unknown[][]): Guest[] {
  if (!grid.length) return [];
  let headerRow = 0;
  for (let i = 0; i < Math.min(grid.length, 8); i += 1) {
    const joined = (grid[i] ?? []).map(norm).join("");
    if (joined.includes("姓名") || joined.includes("name")) {
      headerRow = i;
      break;
    }
  }
  const headers = (grid[headerRow] ?? []).map((h) => cell(h));
  const col = headerIndex(headers);
  const nameCol = col.name ?? 1;
  const rows: IngestRow[] = [];
  let groupId = 1;
  let pendingBreak = false;
  let carriedNumbers: number[] | null = null;
  let carriedRemark = "";

  for (let r = headerRow + 1; r < grid.length; r += 1) {
    const line = grid[r] ?? [];
    const name = cell(line[nameCol]);
    const allEmpty = line.every((v) => cell(v) === "");
    if (!name || allEmpty) {
      if (rows.length) pendingBreak = true;
      carriedNumbers = null;
      carriedRemark = "";
      continue;
    }
    if (pendingBreak) {
      groupId += 1;
      pendingBreak = false;
      carriedNumbers = null;
      carriedRemark = "";
    }
    const parsedNumbers = parseTableNumbers(col.table != null ? line[col.table] : "");
    if (parsedNumbers) {
      const same = carriedNumbers?.join(",") === parsedNumbers.join(",");
      carriedNumbers = parsedNumbers;
      if (!same) carriedRemark = "";
    }
    let remark = col.remark != null ? cell(line[col.remark]) : "";
    if (!remark && carriedRemark) remark = carriedRemark;
    if (remark) carriedRemark = remark;
    rows.push({
      name,
      count: parseCount(col.count != null ? line[col.count] : 1),
      rsvp: parseRsvp(col.rsvp != null ? line[col.rsvp] : ""),
      remark,
      hasChild: parseChild(col.child != null ? line[col.child] : ""),
      tableNumbers: carriedNumbers ? [...carriedNumbers] : null,
      avoid: col.avoid != null ? cell(line[col.avoid]) : "",
      groupId,
    });
  }
  fillBlockRemarks(rows);

  const guests = rowsToGuests(rows);
  const leadByName = new Map<string, Guest>();
  for (const g of guests) {
    if (g.role === "lead") leadByName.set(g.name, g);
  }
  rows.forEach((row) => {
    if (!row.avoid) return;
    const lead = leadByName.get(row.name);
    if (!lead) return;
    const names = row.avoid.split(/[，,、;；]/).map((s) => s.trim()).filter(Boolean);
    for (const n of names) {
      const other = leadByName.get(n);
      if (other && other.partyId !== lead.partyId) {
        lead.avoidPartyIds = [...new Set([...lead.avoidPartyIds, other.partyId])];
        other.avoidPartyIds = [...new Set([...other.avoidPartyIds, lead.partyId])];
      }
    }
  });
  for (const g of guests) {
    if (g.role === "companion") {
      const lead = guests.find((x) => x.partyId === g.partyId && x.role === "lead");
      if (lead) g.avoidPartyIds = [...lead.avoidPartyIds];
    }
  }
  return guests;
}

export async function parseExcelFile(file: File | ArrayBuffer): Promise<Guest[]> {
  const XLSX = await import("xlsx");
  const buf = file instanceof File ? await file.arrayBuffer() : file;
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  return parseGrid(grid);
}
