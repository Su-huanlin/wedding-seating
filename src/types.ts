export type Theme = "chinese" | "western";
export type Rsvp = "yes" | "no" | "pending";
export type MobileTab = "hall" | "pool" | "list" | "export";

export interface Guest {
  id: string;
  name: string;
  role: "lead" | "companion";
  partyId: string;
  groupId: number;
  remark: string;
  rsvp: Rsvp;
  hasChild: boolean;
  avoidPartyIds: string[];
  tableId: string | null;
  seatIndex: number | null;
  preferredTableNumber: number | null;
  /** Excel 里写的桌号。「10、11、12」表示这一组人按顺序坐满这几桌。 */
  preferredTableNumbers: number[] | null;
}

export interface Table {
  id: string;
  number: number;
  numberLocked: boolean;
  locked: boolean;
  x: number;
  y: number;
  seats: number;
  isMain: boolean;
  note: string;
  hallId: string;
}

/** 画布上的一间厅，只是舞台和 T 台，不挡住桌子。 */
export interface HallSpot {
  id: string;
  name: string;
  x: number;
  y: number;
  locked: boolean;
  /** 这张图纸上，T 台左侧、右侧各几桌。 */
  left: number;
  right: number;
  /** 每桌几个座位。 */
  seats: number;
}

export interface Hall {
  width: number;
  height: number;
  theme: Theme;
  spots: HallSpot[];
}

/** T台左侧桌数、右侧桌数。每侧固定两列，先横排左边，再横排右边。 */
export interface LayoutPlan {
  left: number;
  right: number;
}

export interface WeddingState {
  eventName: string;
  guests: Guest[];
  tables: Table[];
  hall: Hall;
  layoutPlan: LayoutPlan;
}

export interface Party {
  id: string;
  lead: Guest;
  members: Guest[];
  size: number;
  remark: string;
  groupId: number;
  avoidPartyIds: string[];
  rsvp: Rsvp;
  hasChild: boolean;
}

export const DEFAULT_SEATS = 10;
export const HALL_WIDTH = 2400;
export const HALL_HEIGHT = 1100;
export const TABLE_RADIUS = 36;
export const SEAT_RADIUS = 0;
export const MIN_PRINT_PT = 8;
