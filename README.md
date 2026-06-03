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

脚本会拉取书架（`/shelf/sync`）、阅读进度（`/book/getprogress`）、阅读统计（`/readdata/detail`，本周/本月/今年）和最近若干条划线（`/book/bookmarklist`，默认每本 3 条）。网页顶部展示阅读时长统计（可切换周期），书架按「在读 / 读完 / 待读」分组：在读显示进度，暂无划线的书归入待读。

可调整每本书划线条数：

```bash
export WEREAD_HIGHLIGHTS_PER_BOOK=8
node scripts/sync-weread.mjs
```

### 每天自动同步（macOS）

1. 把密钥写到项目根目录的 `.env`（不要提交到 git）：

```bash
cp .env.example .env
# 编辑 .env，填入 WEREAD_API_KEY=wrk-...
```

2. 安装定时任务（默认每天 **08:00** 执行一次）：

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

修改执行时间：编辑 `~/Library/LaunchAgents/com.reading-records.weread-sync.plist` 里的 `Hour` / `Minute`，然后执行 `install` 重装。

若安装时报 `node not found`，在终端执行 `which node`，把路径写入 `.env`：

```bash
NODE_BIN=/你电脑上/node的完整路径
```

（conda 用户可先 `conda install nodejs`，或只用 Homebrew 安装 Node。）

## 后端

- Supabase table：`weread_books`、`weread_highlights`、`weread_reading_stats`
- 当前版本为了方便共享，允许公开读取、写入（同步脚本使用）
