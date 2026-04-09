import { access, readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from './loadEnv.mjs';

function getRepoRoot() {
  const currentFilePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFilePath), '../..');
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];

    if (entry.startsWith('--slug=')) {
      args.slug = entry.slice('--slug='.length);
      continue;
    }

    if (entry === '--slug') {
      args.slug = argv[index + 1];
      index += 1;
    }

    if (entry.startsWith('--limit=')) {
      args.limit = Number(entry.slice('--limit='.length));
      continue;
    }

    if (entry === '--limit') {
      args.limit = Number(argv[index + 1]);
      index += 1;
    }

    if (entry.startsWith('--start-from=')) {
      args.startFrom = Number(entry.slice('--start-from='.length));
      continue;
    }

    if (entry === '--start-from') {
      args.startFrom = Number(argv[index + 1]);
      index += 1;
    }
  }

  return args;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function assertExists(filePath, message) {
  try {
    await access(filePath);
  } catch {
    throw new Error(message);
  }
}

function getMimeType(fileName) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.json') return 'application/json';
  if (extension === '.txt') return 'text/plain; charset=utf-8';

  return 'application/octet-stream';
}

function readEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}

function toStorageSafeSlug(rawSlug) {
  return crypto.createHash('sha1').update(String(rawSlug), 'utf8').digest('hex').slice(0, 16);
}

async function detectContentPathColumn(supabase) {
  const { error } = await supabase.from('chapters').select('content_path').limit(1);

  if (!error) {
    return true;
  }

  if (typeof error.message === 'string' && error.message.toLowerCase().includes('content_path')) {
    return false;
  }

  return false;
}

async function ensureCategory(supabase, categoryName) {
  const { data: existing, error: selectError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName)
    .maybeSingle();

  if (selectError) {
    throw new Error(`查询分类失败：${selectError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('categories')
    .insert({ name: categoryName })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`创建分类失败：${insertError.message}`);
  }

  return inserted.id;
}

async function upsertNovel(supabase, payload) {
  const { data: existing, error: selectError } = await supabase
    .from('novels')
    .select('id')
    .eq('title', payload.title)
    .eq('author', payload.author)
    .maybeSingle();

  if (selectError) {
    throw new Error(`查询小说失败：${selectError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('novels')
      .update(payload)
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`更新小说失败：${updateError.message}`);
    }

    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('novels')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`创建小说失败：${insertError.message}`);
  }

  return inserted.id;
}

async function uploadCover(supabase, bucketName, slug, coverFilePath) {
  const coverFileName = path.basename(coverFilePath);
  const coverBuffer = await readFile(coverFilePath);
  const coverStoragePath = `novels/${slug}/cover${path.extname(coverFileName).toLowerCase()}`;
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(coverStoragePath, coverBuffer, {
      contentType: getMimeType(coverFileName),
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`上传封面失败：${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(coverStoragePath);

  return {
    coverStoragePath,
    coverUrl: data.publicUrl,
  };
}

async function uploadOneChapter(supabase, bucketName, slug, chapter) {
  const storagePath = `novels/${slug}/chapters/${String(chapter.chapterNo).padStart(4, '0')}.json`;
  const body = Buffer.from(JSON.stringify(chapter, null, 2), 'utf8');
  const { error } = await supabase.storage.from(bucketName).upload(storagePath, body, {
    contentType: 'application/json',
    upsert: true,
  });

  if (error) {
    throw new Error(`上传第 ${chapter.chapterNo} 章失败：${error.message}`);
  }

  return {
    storagePath,
  };
}

async function insertChaptersInBatches(supabase, rows, batchSize) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase.from('chapters').insert(batch);

    if (error) {
      throw new Error(`写入章节失败：${error.message}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { slug } = args;

  if (!slug) {
    throw new Error('请通过 --slug=<slug> 传入小说目录名');
  }

  const repoRoot = getRepoRoot();
  loadEnvFile(repoRoot);
  const generatedDir = path.join(repoRoot, 'data', 'novel-import', 'generated', slug);
  const manifestPath = path.join(generatedDir, 'manifest.json');
  const inputDir = path.join(repoRoot, 'data', 'novel-import', 'incoming', slug);

  await assertExists(
    manifestPath,
    `未找到 ${path.relative(repoRoot, manifestPath)}，请先运行 npm run novel:prepare -- --slug=${slug}`,
  );

  const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  const contentBucket = readEnv('NOVEL_CONTENT_BUCKET');
  const coverBucket = readEnv('NOVEL_COVER_BUCKET');
  const manifest = await readJson(manifestPath);
  const coverFilePath = path.join(inputDir, manifest.coverFile);
  await assertExists(coverFilePath, `未找到封面文件：${path.relative(repoRoot, coverFilePath)}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const hasContentPath = await detectContentPathColumn(supabase);
  const storageSlug = toStorageSafeSlug(manifest.slug);

  const categoryId = await ensureCategory(supabase, manifest.category);
  const { coverUrl, coverStoragePath } = await uploadCover(supabase, coverBucket, storageSlug, coverFilePath);
  const novelId = await upsertNovel(supabase, {
    title: manifest.title,
    author: manifest.author,
    cover_url: coverUrl,
    description: manifest.description,
    category_id: categoryId,
    status: manifest.status,
    word_count: manifest.wordCount,
    chapter_count: manifest.chapterCount,
    tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    updated_at: new Date().toISOString(),
  });

  const startFrom = Number.isFinite(args.startFrom) && args.startFrom > 0 ? args.startFrom : 1;
  const deleteQuery =
    startFrom > 1
      ? supabase.from('chapters').delete().eq('novel_id', novelId).gte('chapter_no', startFrom)
      : supabase.from('chapters').delete().eq('novel_id', novelId);
  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    throw new Error(`清理旧章节失败：${deleteError.message}`);
  }

  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : manifest.chapters.length - startFrom + 1;
  const batchSize = 100;
  const logEvery = 25;
  const rowsToInsert = [];
  let processed = 0;

  const endExclusive = Math.min(startFrom - 1 + limit, manifest.chapters.length);

  for (let index = startFrom - 1; index < endExclusive; index += 1) {
    const chapterMeta = manifest.chapters[index];
    const chapter = await readJson(path.join(generatedDir, 'chapters', chapterMeta.fileName));
    const { storagePath } = await uploadOneChapter(supabase, contentBucket, storageSlug, chapter);

    const baseRow = {
      novel_id: novelId,
      chapter_no: chapter.chapterNo,
      title: chapter.title,
      word_count: chapter.wordCount,
      is_free: true,
      coin_price: 0,
      updated_at: new Date().toISOString(),
      content: chapter.content,
    };

    rowsToInsert.push(
      hasContentPath
        ? {
            ...baseRow,
            content_path: storagePath,
            content_format: 'json',
            content_version: 1,
          }
        : baseRow,
    );

    processed += 1;

    if (rowsToInsert.length >= batchSize) {
      await insertChaptersInBatches(supabase, rowsToInsert, batchSize);
      rowsToInsert.length = 0;
    }

    if (processed % logEvery === 0) {
      console.log(`已处理章节：${startFrom + processed - 1}/${manifest.chapterCount}`);
    }
  }

  if (rowsToInsert.length > 0) {
    await insertChaptersInBatches(supabase, rowsToInsert, batchSize);
  }

  console.log(`已导入小说：${manifest.title}`);
  console.log(`小说 ID：${novelId}`);
  console.log(`导入区间：${startFrom}-${startFrom + processed - 1}`);
  console.log(`章节数：${processed}/${manifest.chapterCount}`);
  console.log(`总字数：${manifest.wordCount}`);
  console.log(`封面 Bucket：${coverBucket}`);
  console.log(`正文 Bucket：${contentBucket}`);
  console.log(`封面路径：${coverStoragePath}`);
  console.log(`Storage 前缀：novels/${storageSlug}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
