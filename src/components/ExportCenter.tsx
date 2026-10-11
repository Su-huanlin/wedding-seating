import { useMemo, useState } from "react";
import { sheetSize } from "../lib/layout";
import {
  downloadDataUrl,
  downloadExcel,
  hallsToPdf,
  hallToPng,
  namePointSize,
  planChipPx,
  recommendPaper,
  PAPERS,
  type Paper,
} from "../lib/export";
import { MIN_PRINT_PT } from "../types";
import { useWedding } from "../store";

interface Props {
  hallNode: HTMLElement | null;
  onClose: () => void;
}

export default function ExportCenter({ hallNode, onClose }: Props) {
  const eventName = useWedding((s) => s.eventName);
  const guests = useWedding((s) => s.guests);
  const tables = useWedding((s) => s.tables);
  const hall = useWedding((s) => s.hall);
  const state = { eventName, guests, tables, hall };
  const sheetBox = useMemo(() => {
    const sizes = (hall.spots?.length ? hall.spots : [{ left: 8, right: 8 }]).map((sp) =>
      sheetSize({ left: sp.left || 8, right: sp.right || 8 }),
    );
    return {
      w: Math.max(...sizes.map((s) => s.width)),
      h: Math.max(...sizes.map((s) => s.height)),
    };
  }, [hall.spots]);
  const chipPx = useMemo(() => {
    const spots = hall.spots?.length ? hall.spots : [{ left: 8, right: 8 }];
    return Math.min(...spots.map((sp) => planChipPx(sp.left || 8, sp.right || 8)));
  }, [hall.spots]);
  const paperGuess = useMemo(() => recommendPaper(sheetBox.w, sheetBox.h, chipPx), [sheetBox, chipPx]);
  const [paper, setPaper] = useState<Paper>(PAPERS[0]);
  const [paperTouched, setPaperTouched] = useState(false);
  const activePaper = paperTouched ? paper : paperGuess;
  const [busy, setBusy] = useState("");
  const pointSize = namePointSize(sheetBox.w, sheetBox.h, activePaper, chipPx);
  const tooSmall = pointSize < MIN_PRINT_PT;

  const png = async () => {
    if (!hallNode) return;
    setBusy("正在出图…");
    try {
      const url = await hallToPng(hallNode, 3);
      downloadDataUrl(url, `${state.eventName}-平面图.png`);
    } finally {
      setBusy("");
    }
  };

  const pdf = async () => {
    if (!hallNode) return;
    if (tooSmall && !window.confirm(`当前「${activePaper.label}」上姓名大约 ${pointSize.toFixed(1)} pt，可能看不清。建议改用 ${paperGuess.label}。仍要继续导出吗？`)) {
      return;
    }
    setBusy("正在生成 PDF…");
    try {
      await hallsToPdf(hallNode, state, activePaper);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>导出与打印</h2>
        <p style={{ color: "#e8d7b8", marginTop: 0 }}>
          每个厅单独一页。桌位按厅纸重新摆正，并按该厅桌数自适应放大/缩小单桌（含人名、备注）。
          当前「{activePaper.label}」上姓名大约 {pointSize.toFixed(1)} pt
          {tooSmall
            ? `，偏小看不清，请改用更大纸张（建议 ${paperGuess.label}）`
            : "，清晰度足够"}
          。
        </p>
        <div className="export-grid">
          <label className="check">
            纸张
            <select
              value={activePaper.id}
              onChange={(e) => {
                setPaperTouched(true);
                setPaper(PAPERS.find((p) => p.id === e.target.value) ?? activePaper);
              }}
            >
              {PAPERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.id === paperGuess.id ? "（建议）" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn primary" disabled={!!busy} onClick={() => void png()}>
            下载高清平面图 PNG
          </button>
          <button type="button" className="btn" disabled={!!busy} onClick={() => void pdf()}>
            下载平面图 PDF
          </button>
          <button type="button" className="btn" onClick={() => void downloadExcel(state)}>
            导出 Excel 名单（含桌号）
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            打印按桌名单 + 查桌表
          </button>
        </div>
        {busy ? <p>{busy}</p> : null}
        <button type="button" className="btn ghost" onClick={onClose} style={{ marginTop: 12 }}>
          关闭
        </button>
      </div>
    </div>
  );
}
