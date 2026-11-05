# LobeChat 本地部署交接文档

> 最后更新：2026-11-05 21:45
> 维护者交接用，按「能跑起来 → 能排查 → 能优化」三段组织。
>
> **本文档已脱敏**：`<用户名>`、`<你的邮箱>`、`<你的智谱密钥>` 均为占位符，使用时替换为实际值。机器相关的绝对路径同理。

---

## 一、一句话现状

LobeChat 完整开发环境已在本机跑通：前端 `http://localhost:3010`，后端 5 个容器（PostgreSQL / Redis / RustFS / SearXNG），数据库已迁移，已接入智谱免费模型。

---

## 二、环境与路径

| 项目 | 值 |
|---|---|
| 仓库路径 | `C:\Users\<用户名>\WorkBuddy\AI初始\lobehub` |
| 分支 / 版本 | `canary` @ `a64d5c9f84` |
| Node | v22.22.2 |
| pnpm | 12.4.1（由 corepack 锁定，**勿升级**） |
| bun | 1.4.4（`pnpm dev` 的编排脚本依赖它） |
| Docker | Docker Desktop，装在 `%LOCALAPPDATA%\Programs\DockerDesktop` |
| 内存 | 16 GB（**关键瓶颈**，见第七节） |

启动命令的 PATH 需要包含：
```
C:\Users\<用户名>\AppData\Local\Programs\DockerDesktop\resources\bin
```

---

## 三、服务清单

### 前端

| 服务 | 端口 | 说明 |
|---|---|---|
| Next.js | 3010 | 主应用（dev 模式，Turbopack） |
| Vite | 9876 | 认证/工作台等 SPA 子应用，**必须同时运行**，否则 `/signin` 报 500 |
| 生产模式 | 3210 | 仅 `pnpm start` 时使用 |

### 后端容器

| 容器 | 镜像 | 端口 | 数据卷 |
|---|---|---|---|
| lobe-postgres | paradedb/paradedb:latest-pg17 | 5432 | `lobehub_pgdata` |
| lobe-redis | redis:7-alpine | 6379 | `lobehub_redis_data` |
| lobe-rustfs | rustfs/rustfs:latest | 9000 / 9001 | `lobehub_rustfs-data` |
| lobe-searxng | searxng/searxng | 8180 | `lobehub_searxng` |
| lobe-network | alpine | 3210, 9000-9001 | — |

### 数据

| 项 | 值 |
|---|---|
| 数据库 | `lobechat` @ `localhost:5432`，用户 `postgres` |
| 表数量 | 232（已完成迁移） |
| S3 桶 | `lobe` @ `http://localhost:9000`（access: `admin`） |
| 已有账号 | `<你的邮箱>`（2026-11-05 18:32 创建） |

---

## 四、启动 / 停止（标准操作）

### 首次开机后启动

```bash
# 1. 手动点桌面 Docker Desktop 图标（GUI 无法命令行拉起）
#    等托盘图标稳定，约 1-2 分钟

# 2. 启动容器
docker start lobe-postgres lobe-redis lobe-rustfs lobe-searxng lobe-network

# 3. 启动应用
cd "C:/Users/<用户名>/WorkBuddy/AI初始/lobehub"
pnpm dev
```

### 停止

```bash
# 停应用：Ctrl+C 或杀掉 pnpm dev 进程
docker stop lobe-postgres lobe-redis lobe-rustfs lobe-searxng lobe-network
```

### 状态自检（一条命令全查）

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010/signin   # 期望 200
docker exec lobe-postgres pg_isready -U postgres -h 127.0.0.1             # 期望 accepting connections
```

---

## 五、日常使用

1. 浏览器打开 `http://localhost:3010`
2. 用 `<你的邮箱>` + 注册时设的密码**登录**（**不要再注册**，会提示邮箱已存在）
3. 模型选 **智谱 → `glm-4-flash-250414`**

### 模型说明

| 模型 | 状态 |
|---|---|
| `glm-4-flash-250414` | ✅ 实测正常，永久免费，**日常用这个** |
| `glm-4.7-flash` | ⚠️ 免费但常限流，报 `1305 该模型当前访问量过大` |
| `glm-4.7` / `glm-4.6` 等正式版 | ❌ 按量计费，免费额度用完会报余额不足 |

---

## 六、已做的非标准改动（重要，重装或换机必看）

### 1. 修改了 2 个依赖版本

项目原本硬编码 `xlsx` 指向 `https://cdn.sheetjs.com`（国内不可达，安装必失败），已改为 npm 官方 `^0.18.5`：

```
packages/eval-dataset-parser/package.json
packages/file-loaders/package.json     # "xlsx": "^0.18.5"
```

API 兼容（只用 `XLSX.read` / `sheet_to_json`）。**如执行 `git pull` 后被覆盖，需重新打这个补丁。**

### 2. Docker 后端改为 docker-vmm

`%APPDATA%\Docker\settings-store.json`：

```json
"EngineTypeWindows": "docker-vmm"
```

原因：本机 WSL 未安装，默认的 `wsl2` 后端起不来。

**副作用：`docker-vmm` 后端不支持 bind mount**，任何 `-v 主机路径` 都会让 docker CLI 崩溃。所以所有容器数据一律用**命名卷**，不要改回目录挂载。

### 3. Docker 镜像加速

`~/.docker/daemon.json` 已配三个国内镜像源（`docker.m.daocloud.io`、`dockerproxy.net`、`docker.1ms.run`）。Docker Hub 直连不通，靠这个拉镜像。

### 4. `.env` 配置

来源：`cp .env.example.development .env`，并追加：

```bash
ZHIPU_API_KEY=<你的智谱密钥，格式 xxxxxxxx.xxxxxxxx>
```

其余关键项（默认值即可跑通）：

```
APP_URL=http://localhost:3010
DATABASE_URL=postgresql://postgres:***@localhost:5432/lobechat
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000   S3_BUCKET=lobe   S3_ACCESS_KEY_ID=admin
S3_ENABLE_PATH_STYLE=1   S3_SET_ACL=0
```

> 注意：`S3_ENABLE_PATH_STYLE=1` 必须为 1，RustFS 不支持 virtual-host 风格。

---

## 七、已知问题与规避

### ① 内存是最大瓶颈（优先处理）

16 GB 内存，多个 node 进程 + Docker Linux VM 同时跑时，可用内存会掉到 2-3 GB，系统开始 `Memory Compression` 换页，表现为**整个系统卡顿、Vite 响应从 60ms 劣化到 2.8s**。

极端情况 Docker 引擎会被系统杀掉，表现为：

```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
ECONNREFUSED → 数据库查询全部失败 → 注册/登录 500
```

**规避**：跑之前关掉 QQ、Edge 等大内存程序（各占 1.1-1.2 GB）。可用内存保持在 4 GB 以上才算稳。

### ② 开发模式冷编译

每次重启 `pnpm dev` 后，**每个页面首次访问都要编译**，单个路由 10-77 秒，之后降到毫秒级。这是 dev 模式的固有代价，不是故障。

日志特征：
```
GET /trpc/lambda/config.getGlobalConfig 200 in 78s (next.js: 67s)
```
看到 `next.js: 60s+` 就是在编译，等待即可。

### ③ 远程市场接口拖慢首页

首页会并发请求 LobeHub 官方市场接口，国内约 1.9-2.6 秒：

```
https://market.lobehub.com/api/v1/agents
https://market.lobehub.com/api/v1/task-templates/recommendations
https://market.lobehub.com/api/connect/connections    ← 未登录时 401
```

如需去掉，可设 `NEXT_PUBLIC_MARKET_BASE_URL` / `MARKET_BASE_URL` 指向别处，代价是「助手市场」「技能市场」不可用。

### ④ 无害日志噪音

```
[Upstash QStash] client token is not set.
Failed to retrieve memory for topic: { errorType: 'InvalidProviderAPIKey' }
```

前者是定时任务队列没配（不影响聊天），后者是「记忆」功能用了没配 key 的服务商。都可以忽略。

### ⑤ Windows Defender 实时扫描

Defender 会实时扫描 `node_modules` 里的数十万文件，是编译慢的隐形原因。加排除可改善（需管理员 PowerShell，一次即可）：

```powershell
Add-MpPreference -ExclusionPath "C:\Users\<用户名>\WorkBuddy\AI初始\lobehub"
```

### ⑥ 仓库路径含中文

`AI初始` 是中文目录。目前运行正常，但**不要**用它做 Docker bind mount（本就不可用，见第六节）。若日后遇到诡异的编码/挂载问题，优先怀疑这一点。

---

## 八、排障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 网页打不开 / 连接被拒绝 | `pnpm dev` 进程没了 | 重新 `pnpm dev` |
| 页面 500，`/signin` 也 500 | Vite 子应用没起来 | 确认 9876 端口在监听，等 `VITE ready` |
| 注册/登录 500，日志 `ECONNREFUSED` | Docker 引擎死了 | 点 Docker 图标重启 → `docker start` 5 个容器 |
| 聊天报「服务器出现问题」 | 模型 key 无效或未配 | 查日志 `InvalidProviderAPIKey`；确认 `.env` 里 `ZHIPU_API_KEY` |
| 聊天报 `1305 访问量过大` | 免费模型限流 | 换 `glm-4-flash-250414`，或稍后重试 |
| `docker run -v` 直接把 CLI 搞崩 | 用了 bind mount | 改命名卷 |
| 拉镜像卡住 / EOF | Docker Hub 不通 | 确认 daemon.json 镜像源仍在 |
| `pnpm install` 卡在 sheetjs | xlsx 补丁被覆盖 | 重新改成 `^0.18.5` |

---

## 九、后续建议（按优先级）

1. **内存**：最有效的单点改善是加内存条到 32 GB。其次是养成关掉 QQ / Edge 的习惯。
2. **加 Defender 排除**：一条命令，编译速度提升明显（见第七节 ⑤）。
3. **生产构建**：等哪天不再改代码了再考虑。
   ```bash
   pnpm build     # 需 ≥8 GB 空闲内存，20-40 分钟
   pnpm start     # 端口 3210，毫秒级响应，无冷编译
   ```
   注意：`pnpm build` 会覆盖 `.next`，**必须先停掉 dev 服务**，两者不能共存。
4. **数据备份**：数据库和文件都在 Docker 命名卷里，重装 Docker 前务必导出：
   ```bash
   docker exec lobe-postgres pg_dump -U postgres lobechat > backup.sql
   ```

---

## 十、变更记录

| 时间 | 事项 |
|---|---|
| 2026-11-05 18:32 | 数据库迁移完成（232 表），创建账号 `<你的邮箱>` |
| 2026-11-05 18:56 | 接入智谱 API，实测 `glm-4-flash-250414` 可用 |
| 2026-11-05 19:20 | Docker 引擎因内存耗尽崩溃一次，重启恢复 |
| 2026-11-05 19:40 | 本文档建立 |
| 2026-11-05 20:50 | 首页改为极简布局 + 深紫主题（强制 dark） |
| 2026-11-05 21:15 | 全站品牌白标为「知序智枢」，替换 Logo 与全部图标 |
| 2026-11-05 21:35 | 首页问候语改为固定文案「您的私人AI助理」 |

---

## 十一、品牌白标（知序智枢）

品牌名与 Logo 的**唯一源头**是 `packages/business/const/src/branding.ts`，改这一个文件，全站文案、翻译、图标、版权、水印会同步生效。

```ts
export const BRANDING_NAME = '知序智枢';         // 产品名
export const BRANDING_LOGO_URL = '/branding/logo.png'; // Logo
export const BRANDING_INBOX_TITLE = '知序智枢';   // 默认助手（原 Lobe AI）名
export const ORG_NAME = '知序智枢';              // 组织名 / 版权 / 水印
export const LOBE_CHAT_CLOUD = '知序智枢云';
```

### 派生机制（不用手改，会自动跟着变）

| 位置 | 机制 |
|---|---|
| 全站文案里的 `LobeHub` / `LobeChat` / `Lobe AI` | `packages/locales/src/brandPostProcessor.ts` 在 `t()` 时实时替换 |
| 组件里的 Logo | `isCustomBranding = BRANDING_NAME !== 'LobeHub'` → 走 `Custom.tsx` 渲染自定义图 |
| 水印 / 版权 | `isCustomORG` → 直接显示 `ORG_NAME` 文本 |
| 内置 `lobehub` 服务商名 | `packages/model-bank/src/modelProviders/lobehub.ts` 改为 `BRANDING_NAME` |

### 已替换的静态文件

```
public/branding/logo.png          512×512 主 Logo（原件 logo.jpg）
public/branding/favicon-32.png    浏览器标签图标
public/branding/apple-touch-icon.png
public/apple-touch-icon.png
public/app-icons/*.png            PWA 图标（192/512，含 maskable）
public/favicon*.ico               全部 16 个 ico 变体（含进度/错误态）
public/og/*.webp                  分享预览图（1200×640，紫底 + Logo）
```

### 改动手改过的源码（4 处）

1. `src/app/[variants]/metadata.ts` — 自定义品牌时改用 PNG 图标组
2. `src/app/manifest.ts` — dev 分支名称/主题色改为知序智枢 + `#180b2b`
3. `src/spa/BootShell/AppShellSkeleton.tsx` — 骨架屏 Logo 换 `ProductLogo`
4. `plugins/vite/customBrandingLoadingScreen.ts` — 静态加载屏显示 Logo + 名称
5. `src/features/AuthShell/AuthContainer.tsx` — 登录页 Logo 改为图标+文字组合

### 换 Logo 的正确姿势

```bash
# 1. 替换原件
cp 新图.jpg public/branding/logo.jpg
# 2. 用 sharp 重新生成全部尺寸（脚本见 .workbuddy/memory 记录）
# 3. 重启 pnpm dev（vite 插件改动必须重启，纯图片替换不用）
```

### 未替换（有意保留）

`BRANDING_URL` / `SOCIAL_URL` / `BRANDING_EMAIL` 里的 lobehub.com 链接与邮箱保持原样——改成不存在的地址会让「帮助/隐私/条款/社群」入口直接失效。

