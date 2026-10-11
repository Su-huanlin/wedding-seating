# 婚宴排桌

浏览器里用的婚宴排桌工具：导入 Excel 名单、在厅纸上拖桌落座、多厅管理，并导出平面图 / PDF / 名单。

- **形态**：前端单页应用（React + Vite + TypeScript），数据存在本机浏览器，无需后端。
- **适合**：自己或司仪在电脑上排桌、导出打印；手机可打开查看与小改，精细排桌仍建议 PC。

在线演示（部署后把链接写在这里）：_待填_

---

## 功能一览

- Excel 导入来宾（桌号 / 姓名 / 人数 / 备注），提供简易模板下载
- 中式 / 西式厅纸底图；多厅；左右桌数、每桌人数可调（单厅最多 30 桌）
- 画布拖厅、拖桌、拖来宾入座；锁厅 / 锁桌；撤销重做
- 导出 PNG、PDF（A4～A2）、Excel 名单；浏览器打印按桌名单
- 桌数自适应缩放；纸张过小时提示换更大纸张
- 数据自动保存在浏览器 localStorage

---

## 环境要求

- [Node.js](https://nodejs.org/) 18 或以上（建议 LTS）
- 现代浏览器（Chrome / Edge / Safari / Firefox）

---

## 安装与启动

```bash
# 进入项目目录
cd wedding-seating

# 安装依赖
npm install

# 本地开发（默认 http://localhost:5173/ ）
npm run dev
```

其它常用命令：

```bash
npm run build      # 生产构建 → 输出到 dist/
npm run preview    # 本地预览构建结果
npm run template   # 重新生成 public/宴请名单模板.xlsx
```

---

## 怎么导入 Excel

1. 打开软件，点顶部 **「下载模板」**，得到 `宴请名单模板.xlsx`。
2. 按模板填写（或参照你自己的终版格式）：
   - 列：**桌号、姓名、人数、备注**
   - 一桌写一块：桌号只写在该桌第一行，下面几行桌号留空
   - 桌与桌之间空一行
   - 每桌末行「人数」为合计（模板里是求和公式）
3. 点 **「导入 Excel」**，选择填好的文件。
4. **注意**：再次导入会覆盖当前浏览器里的名单与桌位，请确认后再导。

模板里还有「填写说明」工作表，可对照查看。

---

## 怎么导出

点顶部 **「导出」**：

| 方式 | 说明 |
|------|------|
| 高清平面图 PNG | 画布出图 |
| 平面图 PDF | 每厅一页；可选 A4/A3/A2 横竖；字太小时会提示换大纸 |
| Excel 名单 | 含桌号的来宾表 |
| 打印按桌名单 | 浏览器打印查桌表 |

排桌结果以厅纸为准导出；PDF 会按桌号重新摆正，不跟画布上的随意拖动走。

---

## 数据存在哪里

- 使用 **浏览器 localStorage**（键名大致为 `wedding-seating-v1`）。
- **不会**上传到服务器；换电脑、换浏览器、清理站点数据都会丢失。
- 重要名单请自行保留 Excel 源文件，并及时导出平面图 / PDF 备份。

---

## 限制与说明

- 无账号、无云同步、无多人同时编辑。
- 单厅最多 **30 桌**（左右各不超过 15）。
- 桌数很多时，A4 可能看不清人名，请按导出提示改用 A3/A2。
- 手机端可浏览与简单操作；复杂排桌、导出建议在电脑上完成。
- 有 `manifest.json`，可「添加到主屏幕」，但当前 **未做完整离线 Service Worker**，断网后能力有限。

---

## 部署构建参数（Vercel / Netlify）

| 项 | 值 |
|----|-----|
| 安装命令 | `npm install`（一般可默认） |
| **构建命令** | `npm run build` |
| **输出目录** | `dist` |
| Node 版本 | 18+（建议 20） |
| 框架预设 | Vite（有则选 Vite；没有选 Other） |

---

## 用 Vercel 部署（推荐，免费）

1. 打开 [https://vercel.com](https://vercel.com)，用 **GitHub** 账号登录（Continue with GitHub）。
2. 点右上角 **Add New… → Project**。
3. 在列表里找到本仓库（如 `wedding-seating`），点 **Import**。  
   - 若看不到：点 **Adjust GitHub App Permissions**，勾选该仓库权限后刷新。
4. 配置（多数会自动填好）：
   - **Framework Preset**：`Vite`
   - **Build Command**：`npm run build`
   - **Output Directory**：`dist`
   - **Install Command**：`npm install`
5. 点 **Deploy**，等 1～2 分钟。
6. 成功后会得到形如 `https://xxx.vercel.app` 的公网地址。可用手机浏览器直接打开。

以后往 GitHub `main`/`master` 推送代码，Vercel 会自动重新部署。

---

## 用 Netlify 部署

1. 打开 [https://app.netlify.com](https://app.netlify.com)，用 **GitHub** 登录。
2. 点 **Add new site → Import an existing project**。
3. 选 **GitHub**，授权后选中本仓库。
4. 填写：
   - **Branch to deploy**：`master`（或 `main`）
   - **Build command**：`npm run build`
   - **Publish directory**：`dist`
5. 点 **Deploy site**。
6. 完成后在站点设置里可改成更短的域名（Domain settings）。

同样：推送到 GitHub 后会自动更新线上版本。

---

## 项目结构（简要）

```
wedding-seating/
├── public/                 # 静态资源、厅纸底图、Excel 模板
├── scripts/                # 底图处理、生成名单模板
├── src/
│   ├── components/         # 界面：厅纸、圆桌、顶栏、导出等
│   ├── lib/                # 布局、Excel、导出、分座逻辑
│   ├── store.ts            # 状态与 localStorage 持久化
│   └── App.tsx
├── package.json
└── vite.config.ts
```

---

## 许可证

私人项目 / 自用婚礼工具。若公开仓库，可自行补充许可证声明。
