import type { PointerEvent } from "react";
import type { Guest } from "../types";

interface ChipProps {
  guest: Guest;
  large?: boolean;
  selected?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
  onClick?: () => void;
}

export default function GuestChip({ guest, large, selected, onPointerDown, onClick }: ChipProps) {
  const cls = [
    "guest-chip",
    "no-pan",
    large ? "on-seat" : "",
    guest.rsvp === "pending" ? "pending" : "",
    guest.rsvp === "no" ? "no" : "",
    selected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={cls}
      data-guest={guest.id}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={`${guest.name}${guest.hasChild ? " · 带小孩（不占座）" : ""}${guest.remark ? ` · ${guest.remark}` : ""}`}
    >
      {guest.name}
      {guest.hasChild ? <span className="mark">童</span> : null}
    </div>
  );
}
