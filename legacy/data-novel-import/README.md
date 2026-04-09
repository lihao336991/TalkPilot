# 小说导入数据目录

## 输入目录

把待导入小说放到：

`incoming/<slug>/`

每本小说建议包含：

- `book.txt`
- `cover.jpg` 或 `cover.png`
- `meta.json`

## 生成目录

`generated/<slug>/`

由 `npm run novel:prepare -- --slug=<slug>` 自动生成：

- `manifest.json`
- `chapters/0001.json`

## 示例结构

```text
data/novel-import/
  incoming_handled/
    example-novel/
      book.txt
      cover.jpg
      meta.json
  incoming/
    example-novel/
      book.txt
      cover.jpg
      meta.json
  generated/
    example-novel/
      manifest.json
      chapters/
        0001.json
```

## 当前约定

- 原始 txt 只保留在 `incoming`
- 拆章结果统一写入 `generated`
- 后续真正上传到 Supabase 时，以 `generated` 目录为准
- 上传成功后，把incoming目录下的书籍移动至incoming\_handled

