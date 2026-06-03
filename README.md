# 阅读记录

一个多人共享的阅读记录网站，支持：

- 添加书籍
- 修改书籍
- 删除书籍
- 写读书笔记
- 上传封面

数据保存在 Supabase 数据库中，封面保存在 Supabase Storage 中。

## 使用

直接用浏览器打开 `index.html` 即可。线上版本可以部署到 GitHub Pages。

如果想通过本地服务器访问，也可以运行：

```bash
python3 -m http.server 4173
```

然后打开 `http://localhost:4173`。

## 后端

- Supabase table：`books`
- Supabase Storage bucket：`book-covers`
- 当前版本为了方便共享，允许公开读取、添加、修改和删除记录。
