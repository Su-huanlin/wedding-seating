import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { sheetMetrics, tableScaleForPlan } from "../lib/layout";
import type { HallSpot, Theme } from "../types";

interface Props {
  spot: HallSpot;
  theme: Theme;
  selected: boolean;
  showLock: boolean;
  onSelect: () => void;
  onDragStart: (e: PointerEvent) => void;
  onToggleLock: () => void;
  children: ReactNode;
}

export default function HallSheet({
  spot,
  theme,
  selected,
  showLock,
  onSelect,
  onDragStart,
  onToggleLock,
  children,
}: Props) {
  const plan = { left: spot.left || 8, right: spot.right || 8 };
  const size = sheetMetrics(plan);
  const scale = tableScaleForPlan(plan);
  return (
    <div
      className={`hall-sheet no-pan theme-${theme}${selected ? " is-selected" : ""}${spot.locked ? " is-locked" : ""}`}
      data-left={plan.left}
      data-right={plan.right}
      data-table-scale={scale.toFixed(3)}
      style={
        {
          left: spot.x,
          top: spot.y,
          width: size.width,
          height: size.height,
          ["--table-scale"]: String(scale),
        } as CSSProperties
      }
      onPointerDown={(e) => {
        onSelect();
        if ((e.target as HTMLElement).closest(".table-root, button")) return;
        if (spot.locked) return;
        onDragStart(e);
      }}
    >
      <HallPlan theme={theme} name={spot.name} width={size.width} height={size.height} mark={spot.id} />
      {spot.locked ? <div className="hall-stamp">锁定</div> : null}
      {showLock ? (
        <button
          type="button"
          className={spot.locked ? "hall-lock on" : "hall-lock"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleLock}
        >
          {spot.locked ? "厅已锁" : "锁厅"}
        </button>
      ) : null}
      {children}
    </div>
  );
}

function HallPlan({
  theme,
  name,
  width,
  height,
  mark,
}: {
  theme: Theme;
  name: string;
  width: number;
  height: number;
  mark: string;
}) {
  const cn = theme === "chinese";
  const id = (mark.replace(/[^a-zA-Z0-9]/g, "") || "hall") + (cn ? "c" : "w");
  const src = cn ? "/halls/chinese.png?v=15" : "/halls/western.png?v=15";
  const face = cn ? "STKaiti, KaiTi, STSong, SimSun, serif" : "Georgia, Palatino, 'Times New Roman', serif";
  const cx = width / 2;
  const ink = cn ? "#5c1c28" : "#5c3c48";
  const soft = cn ? "rgba(92, 28, 40, 0.78)" : "rgba(92, 60, 72, 0.72)";
  return (
    <svg className="hall-drawing" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      <defs>
        <filter id={`${id}-soft`} x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* 顶对齐裁切，舞台始终在上；不再盖整纸洗色，让大理石底图露出来 */}
      <image href={src} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMin slice" />

      <g filter={`url(#${id}-soft)`}>
        <rect
          x={cx - (cn ? 200 : 230)}
          y={28}
          width={cn ? 400 : 460}
          height={cn ? 70 : 64}
          rx={cn ? 10 : 26}
          fill={cn ? "rgba(255, 248, 240, 0.86)" : "rgba(255, 252, 250, 0.82)"}
        />
      </g>
      <text x={cx} y={cn ? 64 : 60} textAnchor="middle" fontSize={cn ? 32 : 28} fill={ink} fontFamily={face}>
        {name}
      </text>
      <text
        x={cx}
        y={cn ? 90 : 84}
        textAnchor="middle"
        fontSize={12}
        letterSpacing={cn ? 7 : 4}
        fill={soft}
        fontFamily={face}
      >
        {cn ? "礼宴厅" : "BALLROOM"}
      </text>

      <g filter={`url(#${id}-soft)`}>
        <ellipse
          cx={cx}
          cy={height - 102}
          rx={cn ? 150 : 170}
          ry={cn ? 38 : 42}
          fill={cn ? "rgba(255, 246, 236, 0.82)" : "rgba(255, 250, 248, 0.8)"}
        />
      </g>
      <text
        x={cx}
        y={height - 96}
        textAnchor="middle"
        fontSize={cn ? 18 : 16}
        letterSpacing={cn ? 5 : 3}
        fill={soft}
        fontFamily={face}
      >
        {cn ? "迎宾大门" : "ENTRANCE"}
      </text>
    </svg>
  );
}
