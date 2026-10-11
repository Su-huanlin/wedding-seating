import type { Guest, Hall, LayoutPlan, Party, Table, WeddingState } from "../types";
import { DEFAULT_SEATS, HALL_HEIGHT, HALL_WIDTH } from "../types";
import { createTable, ensureHallFits, layoutBanquet, normalizePlan } from "./layout";

export function buildParties(guests: Guest[]): Party[] {
  const groups = new Map<string, Guest[]>();
  for (const g of guests) {
    const list = groups.get(g.partyId) ?? [];
    list.push(g);
    groups.set(g.partyId, list);
  }
  const parties: Party[] = [];
  for (const [id, members] of groups) {
    const lead = members.find((m) => m.role === "lead") ?? members[0];
    parties.push({
      id,
      lead,
      members: [lead, ...members.filter((m) => m.id !== lead.id)],
      size: members.length,
      remark: lead.remark,
      groupId: lead.groupId,
      avoidPartyIds: [...new Set(members.flatMap((m) => m.avoidPartyIds))],
      rsvp: lead.rsvp,
      hasChild: members.some((m) => m.hasChild),
    });
  }
  return parties;
}

export function occupiedCount(tableId: string, guests: Guest[]): number {
  return guests.filter((g) => g.tableId === tableId).length;
}

export function remainingSeats(table: Table, guests: Guest[]): number {
  return table.seats - occupiedCount(table.id, guests);
}

function usedSeats(tableId: string, guests: Guest[]): Set<number> {
  return new Set(
    guests.filter((g) => g.tableId === tableId && g.seatIndex != null).map((g) => g.seatIndex as number),
  );
}

function firstConsecutive(used: Set<number>, size: number, seats: number): number {
  for (let start = 0; start < seats; start += 1) {
    let ok = true;
    for (let k = 0; k < size; k += 1) {
      if (used.has((start + k) % seats)) {
        ok = false;
        break;
      }
    }
    if (ok) return start;
  }
  return -1;
}

function emptySeats(used: Set<number>, seats: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < seats; i += 1) if (!used.has(i)) out.push(i);
  return out;
}

function conflicts(party: Party, tableId: string, guests: Guest[]): boolean {
  const seatedParties = new Set(guests.filter((g) => g.tableId === tableId).map((g) => g.partyId));
  if (party.avoidPartyIds.some((id) => seatedParties.has(id))) return true;
  for (const g of guests) {
    if (g.tableId !== tableId) continue;
    if (g.avoidPartyIds.includes(party.id)) return true;
  }
  return false;
}

function placeParty(party: Party, table: Table, guests: Guest[]): boolean {
  if (party.size > remainingSeats(table, guests)) return false;
  if (conflicts(party, table.id, guests)) return false;
  const used = usedSeats(table.id, guests);
  let start = firstConsecutive(used, party.size, table.seats);
  const slots =
    start >= 0
      ? party.members.map((_, i) => (start + i) % table.seats)
      : emptySeats(used, table.seats).slice(0, party.size);
  if (slots.length < party.size) return false;
  party.members.forEach((member, i) => {
    const g = guests.find((x) => x.id === member.id);
    if (!g) return;
    g.tableId = table.id;
    g.seatIndex = slots[i] ?? i;
  });
  return true;
}

function partiesOf(members: Guest[], order: Map<string, number>): Party[] {
  return buildParties(members)
    .filter((p) => p.rsvp !== "no")
    .sort((a, b) => (order.get(a.lead.id) ?? 0) - (order.get(b.lead.id) ?? 0));
}

function seatParty(party: Party, start: Table, guests: Guest[], seats: number, openNext: () => Table): Table {
  let table = start;
  if (party.size <= remainingSeats(table, guests) && placeParty(party, table, guests)) return table;
  if (party.size <= seats) {
    table = openNext();
    placeParty(party, table, guests);
    return table;
  }
  let pending = [...party.members];
  while (pending.length) {
    let space = remainingSeats(table, guests);
    if (space <= 0) {
      table = openNext();
      space = remainingSeats(table, guests);
    }
    const chunk = pending.slice(0, space);
    const used = usedSeats(table.id, guests);
    let seat = 0;
    for (const member of chunk) {
      while (used.has(seat)) seat += 1;
      const guest = guests.find((g) => g.id === member.id);
      if (guest) {
        guest.tableId = table.id;
        guest.seatIndex = seat;
        used.add(seat);
      }
      seat += 1;
    }
    pending = pending.slice(chunk.length);
  }
  return table;
}

function finishLayout(
  guests: Guest[],
  tables: Table[],
  hall: Hall,
  plan: LayoutPlan,
  seats: number,
): Pick<WeddingState, "guests" | "tables" | "hall"> {
  let nextTables = tables.length ? tables : [createTable([], hall, true, plan)];
  nextTables = layoutBanquet(nextTables, plan, hall);
  const spot = hall.spots?.[0];
  let nextHall = hall;
  if (spot) {
    const count = nextTables.filter((t) => (t.hallId || spot.id) === spot.id).length;
    const right = Math.max(plan.right, Math.max(0, count - plan.left));
    nextHall = {
      ...hall,
      spots: hall.spots.map((sp, index) => (index === 0 ? { ...sp, left: plan.left, right, seats } : { ...sp, seats: sp.seats || seats })),
    };
  }
  nextHall = ensureHallFits(nextTables, nextHall);
  return { guests, tables: nextTables, hall: nextHall };
}

export function autoAssign(state: WeddingState): Pick<WeddingState, "guests" | "tables" | "hall"> {
  const guests = state.guests.map((g) => ({ ...g, tableId: null, seatIndex: null, preferredTableNumbers: g.preferredTableNumbers ?? null }));
  const order = new Map(guests.map((g, i) => [g.id, i]));
  const firstSpot = state.hall.spots?.[0];
  const seats = firstSpot?.seats && firstSpot.seats > 0 ? firstSpot.seats : DEFAULT_SEATS;
  const plan = normalizePlan(firstSpot ? { left: firstSpot.left, right: firstSpot.right } : state.layoutPlan);
  let hall: Hall = {
    ...state.hall,
    width: HALL_WIDTH,
    height: HALL_HEIGHT,
    spots: (state.hall.spots ?? []).map((sp, index) => ({ ...sp, seats: index === 0 ? seats : sp.seats || DEFAULT_SEATS })),
  };
  const tables: Table[] = [];
  const used = new Set<number>();

  const openNumbered = (numbers: number[] | null, cursor: { n: number }, note: string) => {
    let number: number;
    if (numbers && cursor.n < numbers.length) number = numbers[cursor.n];
    else {
      const base = numbers?.length ? numbers[numbers.length - 1] : 0;
      number = base + Math.max(1, cursor.n - (numbers?.length ?? 0) + 1);
    }
    cursor.n += 1;
    while (used.has(number)) number += 1;
    used.add(number);
    const table = createTable(tables, hall, tables.length === 0, plan);
    table.number = number;
    table.numberLocked = true;
    table.note = note || "无备注";
    table.seats = seats;
    tables.push(table);
    return table;
  };

  const numbered = new Map<string, Guest[]>();
  const numberedOrder: string[] = [];
  const plain: Guest[] = [];
  for (const guest of guests) {
    if (guest.rsvp === "no") continue;
    if (guest.preferredTableNumbers?.length) {
      const key = `${guest.groupId}|${guest.preferredTableNumbers.join(",")}`;
      if (!numbered.has(key)) {
        numbered.set(key, []);
        numberedOrder.push(key);
      }
      numbered.get(key)?.push(guest);
    } else plain.push(guest);
  }
  numberedOrder.sort((a, b) => (order.get(numbered.get(a)?.[0].id ?? "") ?? 0) - (order.get(numbered.get(b)?.[0].id ?? "") ?? 0));

  for (const key of numberedOrder) {
    const members = numbered.get(key) ?? [];
    const numbers = members[0]?.preferredTableNumbers ?? null;
    const note = members.find((g) => g.remark)?.remark || "无备注";
    const cursor = { n: 0 };
    let table = openNumbered(numbers, cursor, note);
    for (const party of partiesOf(members, order)) {
      table = seatParty(party, table, guests, seats, () => openNumbered(numbers, cursor, note));
    }
  }

  const clusters: { parties: Party[]; first: number; label: string }[] = [];
  const byKey = new Map<string, { parties: Party[]; first: number; label: string }>();
  for (const party of partiesOf(plain, order)) {
    const label = party.remark || "无备注";
    const key = party.remark ? `备注:${party.remark}` : `空行:${party.groupId}`;
    const first = order.get(party.lead.id) ?? 0;
    let cluster = byKey.get(key);
    if (!cluster) {
      cluster = { parties: [], first, label };
      byKey.set(key, cluster);
      clusters.push(cluster);
    }
    cluster.first = Math.min(cluster.first, first);
    cluster.parties.push(party);
  }
  clusters.sort((a, b) => a.first - b.first);
  for (const cluster of clusters) {
    const cursor = { n: 0 };
    let current: Table | null = null;
    for (const party of cluster.parties) {
      if (!current) current = openNumbered(null, cursor, cluster.label);
      current = seatParty(party, current, guests, seats, () => openNumbered(null, cursor, cluster.label));
    }
  }

  return finishLayout(guests, tables, hall, plan, seats);
}

export function tableOf(guest: Guest, tables: Table[]): Table | undefined {
  return tables.find((t) => t.id === guest.tableId);
}
