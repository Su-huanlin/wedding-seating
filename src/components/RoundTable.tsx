import type { PointerEvent } from "react";
import type { Guest, Table } from "../types";
import { occupiedCount } from "../lib/seating";
import GuestChip from "./GuestChip";

interface Props {
  table: Table;
  guests: Guest[];
  selectedGuestId: string | null;
  selected?: boolean;
  onSelectGuest: (id: string | null) => void;
  onGuestPointerDown: (guestId: string, e: PointerEvent) => void;
  onTablePointerDown: (tableId: string, e: PointerEvent) => void;
  onToggleLock: (id: string) => void;
  onRemove?: (id: string) => void;
  seatsOpen?: boolean;
  canRemove?: boolean;
}

export default function RoundTable({
  table,
  guests,
  selectedGuestId,
  selected = false,
  onSelectGuest,
  onGuestPointerDown,
  onTablePointerDown,
  onToggleLock,
  onRemove,
  seatsOpen = true,
  canRemove = false,
}: Props) {
  const seated = guests.filter((g) => g.tableId === table.id);
  const count = occupiedCount(table.id, guests);
  const short = Math.max(0, table.seats - count);
  const label = table.note || "无备注";
  const warn = short > 0 && !table.locked;
  const mid = Math.ceil(table.seats / 2);
  const left = Array.from({ length: mid }, (_, i) => i);
  const right = Array.from({ length: table.seats - mid }, (_, i) => i + mid);

  const column = (indexes: number[]) =>
    indexes.map((i) => {
      const guest = seated.find((g) => g.seatIndex === i);
      return (
        <div
          key={i}
          className={guest ? "seat" : "seat empty"}
          data-seat={seatsOpen ? `${table.id}:${i}` : undefined}
        >
          {guest ? (
            <GuestChip
              guest={guest}
              large
              selected={selectedGuestId === guest.id}
              onClick={() => onSelectGuest(guest.id)}
              onPointerDown={(e) => onGuestPointerDown(guest.id, e)}
            />
          ) : (
            <span>空位</span>
          )}
        </div>
      );
    });

  return (
    <div
      className={`table-root no-pan${table.locked ? " is-locked" : ""}${selected ? " is-selected" : ""}`}
      data-table-id={table.id}
      style={{ left: table.x, top: table.y }}
    >
      <div className={warn ? "table-remark is-short" : "table-remark"}>
        <span>{label}</span>
        {short > 0 ? <span>未满桌</span> : null}
      </div>
      <div className="table-row">
        <div className="seat-col">{column(left)}</div>
        <div className="table-core no-pan">
          <div className="table-disk" onPointerDown={(e) => onTablePointerDown(table.id, e)}>
            <div>
              <strong>{table.number}</strong>
              <small>
                {count}/{table.seats}
              </small>
            </div>
            {table.locked ? <span className="lock-stamp">锁</span> : null}
          </div>
          <button
            type="button"
            className={table.locked ? "table-lock on" : "table-lock"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onToggleLock(table.id)}
          >
            {table.locked ? "已锁桌" : "锁桌"}
          </button>
          {canRemove && onRemove ? (
            <button
              type="button"
              className="table-lock table-remove"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemove(table.id)}
            >
              删桌
            </button>
          ) : null}
        </div>
        <div className="seat-col">{column(right)}</div>
      </div>
    </div>
  );
}
