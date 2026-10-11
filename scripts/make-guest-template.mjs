/**
 * 按「宴请名单终版」样式生成简易模板：桌号/姓名/人数/备注，每桌框线包裹。
 * 合计行为 SUM 公式；示例为百家姓+先生/女士，共 16 桌。
 * 运行：npm run template
 */
import ExcelJS from "exceljs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "public", "宴请名单模板.xlsx");

const thin = { style: "thin", color: { argb: "FF666666" } };
const medium = { style: "medium", color: { argb: "FF333333" } };
const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5E6C8" } };
const totalFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
const tipFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };

const SURNAMES =
  "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻苏潘葛范彭郎鲁韦昌马苗凤花方俞任袁柳唐薛雷贺罗毕郝安常乐于傅齐康伍余顾孟黄萧姚邵汪毛毛崔陆廖邢樊高夏蔡田胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴松井富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔汤殷".split(
    "",
  );

const REMARKS = ["领导", "领导", "朋友", "朋友", "朋友", "朋友", "同事", "同事", "家人", "家人", "亲戚", "亲戚", "同学", "同学", "邻里", "其他"];

function borderAll(med = false) {
  const b = med ? medium : thin;
  return { top: b, left: b, bottom: b, right: b };
}

function boxRange(ws, r1, c1, r2, c2) {
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: r === r1 ? medium : thin,
        left: c === c1 ? medium : thin,
        bottom: r === r2 ? medium : thin,
        right: c === c2 ? medium : thin,
      };
    }
  }
}

/** 确定性伪随机，保证每次生成模板名单一致。 */
function rnd(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeGuestName(rand, used) {
  let name = "";
  for (let k = 0; k < 40; k += 1) {
    const sur = SURNAMES[Math.floor(rand() * SURNAMES.length)];
    const title = rand() < 0.5 ? "先生" : "女士";
    name = `${sur}${title}`;
    if (!used.has(name)) break;
  }
  used.add(name);
  return name;
}

/** 生成一桌：若干行，人数合计约 10。 */
function makeTableGuests(tableNo, rand, used) {
  const remark = REMARKS[(tableNo - 1) % REMARKS.length];
  const guests = [];
  let total = 0;
  const target = 10;
  while (total < target) {
    const left = target - total;
    const count = left === 1 ? 1 : rand() < 0.45 ? 2 : 1;
    const take = Math.min(count, left);
    guests.push({ name: makeGuestName(rand, used), count: take, remark });
    total += take;
  }
  return guests;
}

/**
 * 写一桌：首行桌号；末行人数为 SUM 公式；桌号列合并。
 * @returns 下一空行行号
 */
function writeTable(ws, startRow, tableNo, guests) {
  const n = Math.max(guests.length, 1);
  const head = startRow;
  const lastGuest = startRow + n - 1;
  const totalRow = lastGuest + 1;

  for (let i = 0; i < n; i += 1) {
    const r = startRow + i;
    const g = guests[i] || { name: "", count: "", remark: "" };
    ws.getCell(r, 1).value = i === 0 ? tableNo : "";
    ws.getCell(r, 2).value = g.name;
    ws.getCell(r, 3).value = g.count === "" || g.count == null ? null : Number(g.count);
    ws.getCell(r, 4).value = g.remark;
    for (let c = 1; c <= 4; c += 1) {
      ws.getCell(r, c).alignment = {
        vertical: "middle",
        horizontal: c === 1 || c === 3 ? "center" : "left",
      };
    }
  }

  // 合计行：人数 = 上方人数列求和（算术公式，随填写自动变）
  ws.getCell(totalRow, 1).value = "";
  ws.getCell(totalRow, 2).value = "";
  ws.getCell(totalRow, 3).value = {
    formula: `SUM(C${head}:C${lastGuest})`,
    result: guests.reduce((s, g) => s + (Number(g.count) || 0), 0),
  };
  ws.getCell(totalRow, 4).value = "";
  for (let c = 1; c <= 4; c += 1) {
    ws.getCell(totalRow, c).fill = totalFill;
    ws.getCell(totalRow, c).alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell(totalRow, c).font = { color: { argb: "FF666666" }, size: 10 };
  }

  if (n > 1) ws.mergeCells(head, 1, lastGuest, 1);
  ws.getCell(head, 1).alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell(head, 1).font = { bold: true, size: 14 };

  boxRange(ws, head, 1, totalRow, 4);
  return totalRow + 2;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "wedding-seating";

  const ws = wb.addWorksheet("宴请名单", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 8;
  ws.getColumn(4).width = 10;

  ws.mergeCells(1, 1, 1, 4);
  const tip = ws.getCell(1, 1);
  tip.value =
    "按桌填写：桌号只写在该桌第一行；空一行换下一桌；末行「人数」为求和公式（改上面人数会自动合计）。以下 16 桌为示例，可改可删。";
  tip.fill = tipFill;
  tip.font = { size: 10, color: { argb: "FF5A3A10" } };
  tip.alignment = { vertical: "middle", wrapText: true };
  ws.getRow(1).height = 32;

  ["桌号", "姓名", "人数", "备注"].forEach((h, i) => {
    const cell = ws.getCell(2, i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderAll(true);
  });
  ws.getRow(2).height = 22;

  const rand = rnd(20261012);
  const used = new Set();
  let row = 3;
  for (let t = 1; t <= 16; t += 1) {
    row = writeTable(ws, row, t, makeTableGuests(t, rand, used));
  }

  const guide = wb.addWorksheet("填写说明");
  guide.columns = [{ width: 68 }];
  const lines = [
    ["填写说明"],
    [""],
    ["1. 四列：桌号、姓名、人数、备注。"],
    ["2. 一桌一块：桌号只写第一行，下面留空（已合并）。"],
    ["3. 人数填这一家几位（夫妻填 2）；末行合计为公式，勿手改。"],
    ["4. 备注写关系：领导 / 朋友 / 家人 等。"],
    ["5. 桌与桌之间空一行。"],
    ["6. 填完后点软件「导入 Excel」。"],
  ];
  lines.forEach((line, i) => {
    const cell = guide.getCell(i + 1, 1);
    cell.value = line[0];
    cell.font = i === 0 ? { bold: true, size: 14 } : { size: 12 };
  });

  await wb.xlsx.writeFile(outPath);
  console.log("wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
