import * as SQLite from 'expo-sqlite';
import { AppCache, CacheEntry } from '@/storage/appCache';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb() {
  if (!db) {
    db = SQLite.openDatabaseSync('novel_reader.db');
  }
  return db;
}

export interface Chapter {
  id: string;
  bookId: string;
  chapterIndex: number;
  title: string;
  content: string;
  wordCount: number;
}

export function initDb() {
  const database = getDb();
  database.execSync(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      cached_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_book_chapter
      ON chapters(book_id, chapter_index);
  `);
}

export function getChapterFromDb(bookId: string, chapterId: string): Chapter | null {
  try {
    const database = getDb();
    const result = database.getFirstSync<{
      id: string;
      book_id: string;
      chapter_index: number;
      title: string;
      content: string;
      word_count: number;
    }>('SELECT * FROM chapters WHERE book_id = ? AND id = ?', [bookId, chapterId]);

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      bookId: result.book_id,
      chapterIndex: result.chapter_index,
      title: result.title,
      content: result.content,
      wordCount: result.word_count,
    };
  } catch {
    return null;
  }
}

export function saveChapterToDb(chapter: Chapter) {
  try {
    const database = getDb();
    database.runSync(
      `INSERT OR REPLACE INTO chapters
       (id, book_id, chapter_index, title, content, word_count, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        chapter.id,
        chapter.bookId,
        chapter.chapterIndex,
        chapter.title,
        chapter.content,
        chapter.content.length,
        Date.now(),
      ],
    );
  } catch {}
}

function serializeChapterKey(bookId: string, chapterId: string) {
  return `${bookId}:${chapterId}`;
}

function deserializeChapterKey(cacheKey: string) {
  const [, rawKey = ''] = cacheKey.split('chapters:', 2);
  const separatorIndex = rawKey.indexOf(':');
  const bookId = rawKey.slice(0, separatorIndex);
  const chapterId = rawKey.slice(separatorIndex + 1);
  return { bookId, chapterId };
}

const chapterPersistentStore = {
  get(cacheKey: string): CacheEntry<Chapter> | null {
    const { bookId, chapterId } = deserializeChapterKey(cacheKey);
    const chapter = getChapterFromDb(bookId, chapterId);
    if (!chapter) {
      return null;
    }

    return {
      value: chapter,
      cachedAt: Date.now(),
    };
  },
  set(cacheKey: string, entry: CacheEntry<Chapter>) {
    const { value } = entry;
    const { bookId, chapterId } = deserializeChapterKey(cacheKey);

    saveChapterToDb({
      ...value,
      bookId,
      id: chapterId,
    });
  },
};

export const chapterContentCache = new AppCache<Chapter>({
  namespace: 'chapters',
  persistentStore: chapterPersistentStore,
  maxMemoryEntries: 24,
});

export function getChapterCacheKey(bookId: string, chapterId: string) {
  return serializeChapterKey(bookId, chapterId);
}
