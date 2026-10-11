import type { Guest, Table, WeddingState } from "../types";
import { HALL_HEIGHT, HALL_WIDTH, MIN_PRINT_PT } from "../types";
import { NAME_CHIP_PX, normalizePlan, sheetMetrics, sheetPosition, tableScaleForPlan } from "./layout";
import { buildParties } from "./seating";

type ExportState = Pick<WeddingState, "eventName" | "guests" | "tables" | "hall">;

export interface Paper {
  id: "a4p" | "a4l" | "a3p" | "a3l" | "a2p" | "a2l";
  mmW: number;
  mmH: number;
  label: string;
}

export const PAPERS: Paper[] = [
  { id: "a4p", mmW: 210, mmH: 297, label: "A4 竖版" },
  { id: "a4l", mmW: 297, mmH: 210, label: "A4 横版" },
  { id: "a3p", mmW: 297, mmH: 420, label: "A3 竖版" },
  { id: "a3l", mmW: 420, mmH: 297, label: "A3 横版" },
  { id: "a2p", mmW: 420, mmH: 594, label: "A2 竖版" },
  { id: "a2l", mmW: 594, mmH: 420, label: "A2 横版" },
];

export function namePointSize(hallW: number, hallH: number, paper: Paper, chipPx = NAME_CHIP_PX): number {
  const margin = 8;
  const usableW = paper.mmW - margin * 2;
  const usableH = paper.mmH - margin * 2;
  const scale = Math.min(usableW / hallW, usableH / hallH);
  const mm = chipPx * scale;
  return mm / 0.352778;
}

export function recommendPaper(hallW = HALL_WIDTH, hallH = HALL_HEIGHT, chipPx = NAME_CHIP_PX): Paper {
  return PAPERS.find((p) => namePointSize(hallW, hallH, p, chipPx) >= MIN_PRINT_PT) ?? PAPERS[PAPERS.length - 1];
}

/** 按厅桌数估算导出姓名字号（已含单桌自适应缩放）。 */
export function planChipPx(left: number, right: number): number {
  const scale = tableScaleForPlan({ left, right });
  return Math.max(12, Math.round(NAME_CHIP_PX * scale));
}

function rsvpLabel(v: Guest["rsvp"]): string {
  if (v === "no") return "未到";
  if (v === "pending") return "待定";
  return "是";
}

export function buildExcelAoA(state: ExportState): string[][] {
  const parties = buildParties(state.guests);
  const rows: string[][] = [["桌号", "姓名", "人数", "是否到", "备注", "带小孩"]];
  for (const p of parties) {
    const tableIds = new Set(p.members.map((m) => m.tableId));
    if (tableIds.size > 1) {
      for (const m of p.members) {
        const table = state.tables.find((t) => t.id === m.tableId);
        rows.push([
          table ? String(table.number) : "",
          m.name,
          "1",
          rsvpLabel(m.rsvp),
          m.remark,
          m.hasChild ? "是" : "",
        ]);
      }
      continue;
    }
    const table = state.tables.find((t) => t.id === p.lead.tableId);
    rows.push([
      table ? String(table.number) : "",
      p.lead.name,
      String(p.size),
      rsvpLabel(p.rsvp),
      p.remark,
      p.hasChild ? "是" : "",
    ]);
  }
  return rows;
}

export async function downloadExcel(state: ExportState): Promise<void> {
  const XLSX = await import("xlsx");
  const aoa = buildExcelAoA(state);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "宴请名单");
  XLSX.writeFile(wb, `${state.eventName || "宴请名单"}.xlsx`);
}

export async function hallToPng(node: HTMLElement, pixelRatio = 3): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(node, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: getComputedStyle(node).backgroundColor || "#4a141c",
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** 导出时忽略拖动，按桌号把圆桌摆回 T 台两侧，并套用当前桌数的自适应缩放。 */
function balanceSheet(clone: HTMLElement, state: ExportState): { width: number; height: number } {
  const left = Number(clone.dataset.left) || 8;
  const right = Number(clone.dataset.right) || 8;
  const nodes = [...clone.querySelectorAll<HTMLElement>("[data-table-id]")];
  const ordered = nodes
    .map((el) => ({ el, table: state.tables.find((t) => t.id === el.dataset.tableId) }))
    .filter((item): item is { el: HTMLElement; table: Table } => Boolean(item.table))
    .sort((a, b) => a.table.number - b.table.number);
  const plan = normalizePlan({ left, right: Math.max(right, Math.max(0, ordered.length - left)) });
  const metrics = sheetMetrics(plan);
  ordered.forEach(({ el }, index) => {
    const pos = sheetPosition(index, plan);
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
  });
  clone.style.width = `${metrics.width}px`;
  clone.style.height = `${metrics.height}px`;
  clone.style.setProperty("--table-scale", String(metrics.scale));
  clone.dataset.tableScale = metrics.scale.toFixed(3);
  return { width: metrics.width, height: metrics.height };
}

export async function hallsToPdf(root: HTMLElement, state: ExportState, paper?: Paper): Promise<void> {
  const sheets = [...root.querySelectorAll<HTMLElement>(".hall-sheet")];
  if (!sheets.length) {
    await hallToPdf(root, state, paper);
    return;
  }
  const { jsPDF } = await import("jspdf");
  const { toPng } = await import("html-to-image");
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-32000px;top:0;background:#fffaf4;";
  document.body.appendChild(host);
  const first = sheets[0];
  const chosen = paper ?? recommendPaper(first.offsetWidth || 2580, first.offsetHeight || 1800);
  let pdf: InstanceType<typeof jsPDF> | null = null;
  try {
    for (const sheet of sheets) {
      const clone = sheet.cloneNode(true) as HTMLElement;
      clone.style.position = "relative";
      clone.style.left = "0";
      clone.style.top = "0";
      clone.style.transform = "none";
      clone.style.margin = "0";
      host.appendChild(clone);
      const balanced = balanceSheet(clone, state);
      const w = balanced.width;
      const h = balanced.height;
      const png = await toPng(clone, {
        pixelRatio: 1.5,
        cacheBust: true,
        backgroundColor: "#fffaf4",
        width: w,
        height: h,
      });
      const page = paper ?? recommendPaper(w, h);
      if (!pdf) {
        pdf = new jsPDF({
          orientation: page.mmW >= page.mmH ? "landscape" : "portrait",
          unit: "mm",
          format: [page.mmW, page.mmH],
          compress: true,
        });
      } else {
        pdf.addPage([page.mmW, page.mmH], page.mmW >= page.mmH ? "landscape" : "portrait");
      }
      const margin = 8;
      const maxW = page.mmW - margin * 2;
      const maxH = page.mmH - margin * 2;
      const scale = Math.min(maxW / w, maxH / h);
      const dw = w * scale;
      const dh = h * scale;
      pdf.addImage(png, "PNG", (page.mmW - dw) / 2, (page.mmH - dh) / 2, dw, dh, undefined, "FAST");
      host.removeChild(clone);
    }
  } finally {
    host.remove();
  }
  pdf?.save(`${state.eventName || "婚宴平面图"}-${chosen.label}.pdf`);
}

export async function hallToPdf(node: HTMLElement, state: ExportState, paper?: Paper): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const chosen = paper ?? recommendPaper(state.hall.width, state.hall.height);
  const png = await hallToPng(node, chosen.id.startsWith("a4") ? 3 : 2.4);
  const pdf = new jsPDF({
    orientation: chosen.mmW >= chosen.mmH ? "landscape" : "portrait",
    unit: "mm",
    format: [chosen.mmW, chosen.mmH],
    compress: true,
  });
  const margin = 8;
  const maxW = chosen.mmW - margin * 2;
  const maxH = chosen.mmH - margin * 2;
  const imgW = state.hall.width;
  const imgH = state.hall.height;
  const scale = Math.min(maxW / imgW, maxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (chosen.mmW - w) / 2;
  const y = (chosen.mmH - h) / 2;
  pdf.addImage(png, "PNG", x, y, w, h, undefined, "FAST");
  pdf.save(`${state.eventName || "婚宴平面图"}-${chosen.label}.pdf`);
}

export function lookupRows(state: ExportState): { id: string; name: string; table: string; remark: string; tableNum: number; seat: number }[] {
  return state.guests
    .map((g) => {
      const table = state.tables.find((t) => t.id === g.tableId);
      return {
        id: g.id,
        name: g.name,
        table: table ? `${table.number}号 · ${table.note || "无备注"}` : "待安排",
        remark: g.remark,
        tableNum: table ? table.number : 9999,
        seat: g.seatIndex ?? 999,
      };
    })
    .sort((a, b) => a.tableNum - b.tableNum || a.seat - b.seat || a.name.localeCompare(b.name, "zh"));
}

export function tableRoster(state: ExportState): { table: Table; names: string[] }[] {
  return [...state.tables]
    .sort((a, b) => a.number - b.number)
    .map((table) => ({
      table,
      names: state.guests
        .filter((g) => g.tableId === table.id)
        .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
        .map((g) => (g.hasChild ? `${g.name}（带小孩）` : g.name)),
    }));
}
