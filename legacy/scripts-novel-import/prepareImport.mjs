import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './loadEnv.mjs';

const defaultPatterns = [
  '^第[0-9一二三四五六七八九十百千两零〇]+章.*$',
  '^第[0-9一二三四五六七八九十百千两零〇]+回.*$',
  '^chapter\\s+\\d+.*$',
  '^Chapter\\s+\\d+.*$',
  '^CHAPTER\\s+\\d+.*$',
];

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

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
  }

  return args;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function normalizeText(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countWords(content) {
  return content.replace(/\s+/g, '').length;
}

async function detectCoverFile(inputDir, preferredFileName) {
  if (preferredFileName) {
    return preferredFileName;
  }

  const files = await readdir(inputDir);
  const coverFile = files.find((fileName) =>
    imageExtensions.has(path.extname(fileName).toLowerCase()) && fileName.toLowerCase().startsWith('cover'),
  );

  if (!coverFile) {
    throw new Error('未找到封面文件，请在 meta.json 中提供 coverFile，或将封面命名为 cover.jpg / cover.png');
  }

  return coverFile;
}

function resolvePattern(meta) {
  if (typeof meta.chapterPattern === 'string' && meta.chapterPattern.trim()) {
    return meta.chapterPattern.trim();
  }

  return null;
}

function findChapterMatches(lines, rawPattern) {
  const expression = new RegExp(rawPattern, 'i');
  const matches = [];

  lines.forEach((line, index) => {
    const title = line.trim();

    if (!title) {
      return;
    }

    expression.lastIndex = 0;

    if (expression.test(title)) {
      matches.push({ index, title });
    }
  });

  return matches;
}

function detectChapterPattern(lines, meta) {
  const requestedPattern = resolvePattern(meta);

  if (requestedPattern) {
    const matches = findChapterMatches(lines, requestedPattern);

    if (matches.length === 0) {
      throw new Error(`chapterPattern 未匹配到任何章节：${requestedPattern}`);
    }

    return { pattern: requestedPattern, matches };
  }

  for (const pattern of defaultPatterns) {
    const matches = findChapterMatches(lines, pattern);

    if (matches.length > 0) {
      return { pattern, matches };
    }
  }

  throw new Error('未识别到章节标题，请提供 meta.json.chapterPattern');
}

function buildChapters(text, matches) {
  const lines = text.split('\n');
  const chapters = [];
  const warnings = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const startLine = current.index;
    const endLine = next ? next.index : lines.length;

    const bodyLines = lines.slice(startLine + 1, endLine);
    let content = bodyLines.join('\n').trim();

    if (index === 0) {
      const leadingContent = lines.slice(0, startLine).join('\n').trim();

      if (leadingContent) {
        content = `${leadingContent}\n\n${content}`.trim();
        warnings.push('首章前存在额外文本，已并入第一章内容');
      }
    }

    if (!content) {
      warnings.push(`第 ${index + 1} 章没有正文内容`);
    }

    chapters.push({
      chapterNo: index + 1,
      title: current.title,
      content,
      wordCount: countWords(content),
    });
  }

  return { chapters, warnings };
}

async function writeGeneratedFiles(outputDir, meta, coverFile, pattern, chapters, warnings) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'chapters'), { recursive: true });

  const totalWordCount = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  const manifest = {
    slug: meta.slug,
    title: meta.title,
    author: meta.author,
    category: meta.category,
    description: meta.description,
    status: meta.status,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    coverFile,
    chapterPattern: pattern,
    chapterCount: chapters.length,
    wordCount: totalWordCount,
    warnings,
    generatedAt: new Date().toISOString(),
    chapters: chapters.map((chapter) => ({
      chapterNo: chapter.chapterNo,
      title: chapter.title,
      wordCount: chapter.wordCount,
      fileName: `${String(chapter.chapterNo).padStart(4, '0')}.json`,
    })),
  };

  await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  await Promise.all(
    chapters.map((chapter) =>
      writeFile(
        path.join(outputDir, 'chapters', `${String(chapter.chapterNo).padStart(4, '0')}.json`),
        JSON.stringify(chapter, null, 2),
      ),
    ),
  );

  return manifest;
}

async function main() {
  const { slug } = parseArgs(process.argv.slice(2));

  if (!slug) {
    throw new Error('请通过 --slug=<slug> 传入小说目录名');
  }

  const repoRoot = getRepoRoot();
  loadEnvFile(repoRoot);
  const inputDir = path.join(repoRoot, 'data', 'novel-import', 'incoming', slug);
  const outputDir = path.join(repoRoot, 'data', 'novel-import', 'generated', slug);
  const metaPath = path.join(inputDir, 'meta.json');
  const meta = await readJson(metaPath);
  const sourceTextFile = meta.sourceTextFile || 'book.txt';
  const textPath = path.join(inputDir, sourceTextFile);
  const coverFile = await detectCoverFile(inputDir, meta.coverFile);
  const text = normalizeText(await readFile(textPath, 'utf8'));
  const lines = text.split('\n');
  const { pattern, matches } = detectChapterPattern(lines, meta);
  const { chapters, warnings } = buildChapters(text, matches);
  const manifest = await writeGeneratedFiles(outputDir, meta, coverFile, pattern, chapters, warnings);

  console.log(`已完成拆章：${manifest.title}`);
  console.log(`章节数：${manifest.chapterCount}`);
  console.log(`总字数：${manifest.wordCount}`);
  console.log(`输出目录：${path.relative(repoRoot, outputDir)}`);

  if (manifest.warnings.length > 0) {
    console.log('注意事项：');
    manifest.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
