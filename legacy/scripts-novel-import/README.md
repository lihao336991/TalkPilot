# 小说导入工作流

当前目录用于承接“整本 txt + 封面 + 元数据”到“章节拆分结果 + 后续入库”的导入流程。

## 目录职责

- `prepareImport.mjs`：读取 `data/novel-import/incoming/<slug>/` 下的输入文件，拆分章节并生成本地产物
- `importToSupabase.mjs`：校验环境变量和生成结果，为后续上传 Storage 与写入数据库预留入口

## 约定输入目录

每本小说放在：

`data/novel-import/incoming/<slug>/`

建议至少包含：

- `book.txt`
- `cover.jpg` 或 `cover.png`
- `meta.json`

## 当前可用命令

```bash
npm run novel:prepare -- --slug=<slug>
npm run novel:import -- --slug=<slug>
```

脚本会自动读取仓库根目录的 `.env`。

导入阶段至少需要：

- `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOVEL_CONTENT_BUCKET`
- `NOVEL_COVER_BUCKET`

## prepare 产物

生成目录：

`data/novel-import/generated/<slug>/`

会输出：

- `manifest.json`
- `chapters/0001.json` 这类按章节拆好的文件

## meta.json 最小字段

```json
{
  "slug": "example-novel",
  "title": "书名",
  "author": "作者",
  "category": "分类",
  "description": "简介",
  "status": 1,
  "tags": ["标签1", "标签2"],
  "chapterPattern": "^第[0-9一二三四五六七八九十百千两零〇]+章.*$",
  "sourceTextFile": "book.txt",
  "coverFile": "cover.jpg"
}
```

## status 约定

- `0`：连载
- `1`：完结
- `2`：暂停

## 当前阶段

- 本地拆章已经纳入工作流
- 导入脚本当前先完成输入校验与结果对接准备
- 等服务端最终确定“正文进数据库”还是“正文进 Storage 路径”后，再补最终上传逻辑
