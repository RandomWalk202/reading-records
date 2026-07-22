# 阅读记录

一个展示微信读书书架与划线的阅读记录网站。数据通过本地同步脚本写入 Supabase，网页只读取数据库（不会把 API Key 暴露在浏览器里）。

## 使用

直接用浏览器打开 `index.html` 即可。线上版本可以部署到 GitHub Pages。

如果想通过本地服务器访问，也可以运行：

```bash
python3 -m http.server 4173
```

然后打开 `http://localhost:4173`。

## 同步微信读书

1. 准备微信读书 Agent API Key，并设置环境变量：

```bash
export WEREAD_API_KEY=wrk-xxxxxxxx
```

或在 `.env` 中配置（见 `.env.example`）。

2. 在项目根目录运行：

```bash
node scripts/sync-weread.mjs
```

脚本会拉取书架（`/shelf/sync`）、阅读进度（`/book/getprogress`）、阅读统计（`/readdata/detail`，本周/本月/今年）和每本书的全部划线（`/book/bookmarklist`，默认同步全部）。同步时会删除微信读书书架里已不存在的书籍及其划线、读后感记录。网页卡片默认展示 2 条，点【查看全部划线】弹层会按书名拉取完整列表。书架按「在读 / 读完 / 想读」分组：在读显示进度，暂无划线的书归入想读。

若只想同步每本书最近若干条（减小数据库体积），可设置：

```bash
export WEREAD_HIGHLIGHTS_PER_BOOK=20
node scripts/sync-weread.mjs
```

设为 `0` 或不设置则同步全部划线。

### 每天自动同步（macOS）

1. 把密钥写到项目根目录的 `.env`（不要提交到 git）：

```bash
cp .env.example .env
# 编辑 .env，填入 WEREAD_API_KEY=wrk-...
```

2. 安装定时任务（默认每天 **10:00** 执行一次）：

```bash
chmod +x scripts/install-daily-sync.sh scripts/sync-weread-daily.sh
./scripts/install-daily-sync.sh install
```

3. 立即试跑一次（可选）：

```bash
./scripts/sync-weread-daily.sh
tail -20 logs/sync-weread.log
```

卸载定时任务：`./scripts/install-daily-sync.sh uninstall`  
查看是否已安装：`./scripts/install-daily-sync.sh status`

定时任务实际在 `~/Library/Application Support/reading-records/` 运行（避免项目在桌面时 macOS 拦截 launchd）。日志见该目录下的 `logs/sync-weread.log`。修改项目 `.env` 后请再执行一次 `install` 以同步配置。

修改执行时间：编辑 `~/Library/LaunchAgents/com.reading-records.weread-sync.plist` 里的 `Hour` / `Minute`，然后执行 `install` 重装。

若安装时报 `node not found`，在终端执行 `which node`，把路径写入 `.env`：

```bash
NODE_BIN=/你电脑上/node的完整路径
```

（conda 用户可先 `conda install nodejs`，或只用 Homebrew 安装 Node。）

### 云端自动同步（Cloudflare + GitHub Actions）

适合电脑不常联网、人在外地的场景：由 **Cloudflare Workers Cron** 按时触发，**GitHub Actions** 在云端执行同步脚本。

**GitHub 一次性配置：**

1. 打开仓库网页：Settings → Secrets and variables → Actions → New repository secret
2. 名称填 `WEREAD_API_KEY`，值填你的 `wrk-...` 密钥（与本地 `.env` 相同）

**用手机 GitHub App 手动同步：**

1. 打开 **reading-records** 仓库
2. 点底部 **Actions**（操作）
3. 左侧选 **Sync WeRead**
4. 点 **Run workflow** → 再点绿色 **Run workflow**
5. 等约 30 秒出现绿色 ✓ 后，刷新阅读记录网页

### Cloudflare Workers Cron（自动定时）

项目已包含 Worker 配置：`workers/reading-records-cron/`。

定时任务（北京时间）：

- **每小时 :05**：轻量同步，用总体阅读时长快照差额，估算刚结束小时区间的阅读时长（存入 `weread_challenge` 中 `id=weread-hourly-v1`）
- **每天 08:10 / 14:10 / 21:10**：全量同步书架、划线、统计与挑战进度（同时也会更新小时差额）

GitHub Actions 同步保留相同节奏的 `schedule` 作为备份，避免 Cloudflare 触发失败时整天不同步。

小时数据是**估算值**（接口只有按天明细）：漏跑某小时时，差额可能合并进后续桶。

**一次性准备：**

1. 创建 GitHub fine-grained personal access token：
   - Repository access：只选 `RandomWalk202/reading-records`
   - Repository permissions：`Actions` 设为 `Read and write`
2. 登录 Cloudflare Wrangler 并设置 secret：

```bash
cd workers/reading-records-cron
npm install
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
```

`GITHUB_TOKEN` 填上一步创建的 GitHub token。

**部署 Worker：**

```bash
npm run deploy
```

当前 Worker 定时（北京时间）：

- **每小时 :05**：`Record Reading Hour`（小时差额）
- **每天 08:10 / 14:10 / 21:10**：`Sync WeRead` 全量同步

查看实时日志：

```bash
npm run tail
```

## 后端

- Supabase table：`weread_books`、`weread_highlights`、`weread_reading_stats`、`weread_challenge`（30 天阅读挑战进度；另用 `id=weread-hourly-v1` 存小时估算）、`weread_book_reviews`（读后感，仅弹窗展示）
- 阅读挑战：`weread_challenge.baseline_through_date` 及之前的 `daily_read_seconds` 为手动基准，同步只更新该日期之后的每日阅读数据
- 小时阅读：每小时用 overall `totalReadTime` 快照差额估算时段；网页「今日时段」图展示当天估算结果
- 当前版本为了方便共享，允许公开读取、写入（同步脚本使用）
