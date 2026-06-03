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

## 后端

- Supabase table：`weread_books`、`weread_highlights`、`weread_reading_stats`
- 当前版本为了方便共享，允许公开读取、写入（同步脚本使用）
