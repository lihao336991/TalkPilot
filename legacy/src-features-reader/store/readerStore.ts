import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions } from 'react-native';
import { create } from 'zustand';
import { Chapter, chapterContentCache, getChapterCacheKey } from '@/storage/chapterCache';
import { Page, Paginator } from '@/shared/utils/paginator';
import { fetchChapterContent, fetchChapterList, fetchNovelById } from '@/shared/repositories/novelsRepository';

export type FlipMode = 'horizontal' | 'vertical';

export interface ReaderTheme {
  name: string;
  backgroundColor: string;
  textColor: string;
}

export const readerThemes: ReaderTheme[] = [
  { name: 'default', backgroundColor: '#FFFFFF', textColor: '#333333' },
  { name: 'warm', backgroundColor: '#FFF5E1', textColor: '#5C4B37' },
  { name: 'green', backgroundColor: '#E7EDDC', textColor: '#3D4A2F' },
  { name: 'night', backgroundColor: '#1A1A1A', textColor: '#7F7F7F' },
  { name: 'pink', backgroundColor: '#FCE4EC', textColor: '#5D4037' },
];

export interface ReaderSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: ReaderTheme;
  flipMode: FlipMode;
  brightness: number;
  isSystemBrightness: boolean;
}

export interface ReadingProgress {
  novelId: string;
  chapterIndex: number;
  pageIndex: number;
  charOffset: number;
}

export type Novel = {
  id: number;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
};

export type ChapterMeta = {
  id: number;
  chapterNo: number;
  title: string;
  wordCount: number;
};

function buildReaderPages(chapter: Chapter, settings: ReaderSettings, containerWidth: number, containerHeight: number) {
  const chapterDisplayContent = `${chapter.title}\n\n${chapter.content}`.trim();

  const paginator = new Paginator({
    containerWidth,
    containerHeight,
    fontSize: settings.fontSize,
    lineHeight: settings.fontSize * settings.lineHeight,
    paragraphSpacing: 0,
    paddingHorizontal: 24,
    paddingVertical: 48,
  });

  return paginator.paginate(chapterDisplayContent);
}

type ReaderState = {
  currentBook: Novel | null;
  currentChapter: Chapter | null;
  chapterList: ChapterMeta[];
  prevChapterPreview: Page | null;
  nextChapterPreview: Page | null;
  pages: Page[];
  currentPageIndex: number;
  chapterPagesCache: Map<number, Page[]>;
  isOverlayVisible: boolean;
  isLoading: boolean;
  settings: ReaderSettings;
  containerWidth: number;
  containerHeight: number;
  initReader: (bookId: string) => Promise<void>;
  ensureChapterPaginated: (chapterIndex: number) => Promise<void>;
  getFlatWindow: () => { pages: Page[]; baseOffset: number };
  moveByDelta: (delta: number) => Promise<void>;
  setContainerSize: (width: number, height: number) => void;
  setCurrentPage: (index: number) => void;
  toggleOverlay: () => void;
  updateSettings: (partial: Partial<ReaderSettings>) => Promise<void>;
  loadChapter: (bookId: string, chapterIndex: number) => Promise<void>;
  prefetchChapters: (bookId: string, chapterIndexes: number[]) => Promise<void>;
  refreshChapterPreviews: (bookId: string, chapterIndex: number) => Promise<void>;
  saveProgress: () => Promise<void>;
  repaginate: () => Promise<void>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
};

const defaultSettings: ReaderSettings = {
  fontSize: 18,
  fontFamily: 'serif',
  lineHeight: 1.55,
  theme: readerThemes[1],
  flipMode: 'horizontal',
  brightness: 0.8,
  isSystemBrightness: true,
};

export const useReaderStore = create<ReaderState>((set, get) => ({
  currentBook: null,
  currentChapter: null,
  chapterList: [],
  prevChapterPreview: null,
  nextChapterPreview: null,
  pages: [],
  currentPageIndex: 0,
  chapterPagesCache: new Map<number, Page[]>(),
  isOverlayVisible: false,
  isLoading: true,
  settings: defaultSettings,
  containerWidth: Dimensions.get('window').width,
  containerHeight: Dimensions.get('window').height,

  initReader: async (bookId: string) => {
    const novelId = Number(bookId);
    if (!Number.isFinite(novelId)) {
      set({ isLoading: false });
      return;
    }

    set({
      isLoading: true,
      chapterPagesCache: new Map<number, Page[]>(),
      prevChapterPreview: null,
      nextChapterPreview: null,
    });

    try {
      const rawSettings = await AsyncStorage.getItem('readerSettings');
      if (rawSettings) {
        set({ settings: JSON.parse(rawSettings) });
      }
    } catch {}

    try {
      const novel = await fetchNovelById(novelId);
      set({
        currentBook: {
          id: novel.id,
          title: novel.title,
          author: novel.author,
          coverUrl: novel.cover_url ?? '',
          description: novel.description ?? '',
        },
      });
    } catch {
      set({ isLoading: false });
      return;
    }

    try {
      const chapters = await fetchChapterList(novelId);
      set({
        chapterList: (chapters ?? []).map((item) => ({
          id: item.id,
          chapterNo: item.chapter_no,
          title: item.title,
          wordCount: item.word_count ?? 0,
        })),
      });
    } catch {
      set({ chapterList: [] });
    }

    let targetChapterIndex = 0;
    try {
      const rawProgress = await AsyncStorage.getItem(`progress_${bookId}`);
      if (rawProgress) {
        const parsed = JSON.parse(rawProgress) as Partial<ReadingProgress>;
        if (typeof parsed.chapterIndex === 'number') {
          targetChapterIndex = parsed.chapterIndex;
        }
      }
    } catch {}

    await get().loadChapter(bookId, targetChapterIndex);
  },

  ensureChapterPaginated: async (chapterIndex) => {
    const { currentBook, chapterList, settings, containerWidth, containerHeight, chapterPagesCache } = get();
    if (!currentBook) return;
    if (chapterIndex < 0 || chapterIndex >= chapterList.length) return;
    if (chapterPagesCache.has(chapterIndex)) return;
    const chapterMeta = chapterList[chapterIndex];
    if (!chapterMeta) return;
    const cacheKey = getChapterCacheKey(String(currentBook.id), String(chapterMeta.id));
    const chapter = await chapterContentCache.getOrLoad(cacheKey, async () => {
      const remote = await fetchChapterContent(chapterMeta.id);
      return {
        id: String(remote.id),
        bookId: String(currentBook.id),
        chapterIndex,
        title: remote.title,
        content: remote.content ?? '',
        wordCount: remote.word_count ?? 0,
      } satisfies Chapter;
    });
    const chapterPages = buildReaderPages(chapter, settings, containerWidth, containerHeight);
    const nextCache = new Map(get().chapterPagesCache);
    nextCache.set(chapterIndex, chapterPages);
    set({ chapterPagesCache: nextCache });
  },

  getFlatWindow: () => {
    const { currentChapter, chapterPagesCache, pages } = get();
    const currentChapterIndex = currentChapter?.chapterIndex ?? 0;
    const prevPages = chapterPagesCache.get(currentChapterIndex - 1) ?? [];
    const currentPages = chapterPagesCache.get(currentChapterIndex) ?? pages;
    const nextPages = chapterPagesCache.get(currentChapterIndex + 1) ?? [];
    return {
      pages: [...prevPages, ...currentPages, ...nextPages],
      baseOffset: prevPages.length,
    };
  },

  moveByDelta: async (delta) => {
    const { currentBook, currentChapter, currentPageIndex, pages, chapterList } = get();
    if (!currentBook || !currentChapter) return;
    const currentChapterIndex = currentChapter.chapterIndex;
    await Promise.all([
      get().ensureChapterPaginated(currentChapterIndex - 1),
      get().ensureChapterPaginated(currentChapterIndex),
      get().ensureChapterPaginated(currentChapterIndex + 1),
    ]);
    const { pages: flatPages, baseOffset } = get().getFlatWindow();
    const currentPages = get().chapterPagesCache.get(currentChapterIndex) ?? pages;
    const currentWindowIndex = baseOffset + currentPageIndex;
    const targetWindowIndex = currentWindowIndex + delta;
    if (targetWindowIndex < 0 || targetWindowIndex >= flatPages.length) {
      return;
    }
    if (targetWindowIndex < baseOffset) {
      if (currentChapterIndex <= 0) return;
      const prevPages = get().chapterPagesCache.get(currentChapterIndex - 1) ?? [];
      const newPageIndex = targetWindowIndex;
      await get().loadChapter(String(currentBook.id), currentChapterIndex - 1);
      set({ currentPageIndex: Math.min(newPageIndex, Math.max(0, prevPages.length - 1)) });
      get().saveProgress();
      return;
    }
    if (targetWindowIndex < baseOffset + currentPages.length) {
      get().setCurrentPage(targetWindowIndex - baseOffset);
      return;
    }
    if (currentChapterIndex >= chapterList.length - 1) return;
    const newPageIndex = targetWindowIndex - baseOffset - currentPages.length;
    await get().loadChapter(String(currentBook.id), currentChapterIndex + 1);
    set({ currentPageIndex: newPageIndex });
    get().saveProgress();
  },

  setContainerSize: (width, height) => {
    if (!width || !height) return;
    const { containerWidth, containerHeight } = get();
    if (Math.abs(width - containerWidth) > 1 || Math.abs(height - containerHeight) > 1) {
      set({ containerWidth: width, containerHeight: height, chapterPagesCache: new Map<number, Page[]>() });
      get().repaginate();
    }
  },

  setCurrentPage: (index) => {
    const { pages } = get();
    if (index >= 0 && index < pages.length) {
      set({ currentPageIndex: index });
      get().saveProgress();
    }
  },

  toggleOverlay: () => set((state) => ({ isOverlayVisible: !state.isOverlayVisible })),

  updateSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });

    try {
      await AsyncStorage.setItem('readerSettings', JSON.stringify(newSettings));
    } catch {}

    if (partial.fontSize || partial.lineHeight || partial.fontFamily) {
      set({ chapterPagesCache: new Map<number, Page[]>() });
      get().repaginate();
      const currentBook = get().currentBook;
      const currentChapter = get().currentChapter;
      if (currentBook && currentChapter) {
        void get().refreshChapterPreviews(String(currentBook.id), currentChapter.chapterIndex);
      }
    }
  },

  prefetchChapters: async (bookId, chapterIndexes) => {
    try {
      const novelId = Number(bookId);
      if (!Number.isFinite(novelId)) {
        return;
      }

      const chapterList = get().chapterList;
      const uniqueIndexes = Array.from(new Set(chapterIndexes))
        .filter((chapterIndex) => chapterIndex >= 0 && chapterIndex < chapterList.length)
        .slice(0, 3);

      await Promise.all(
        uniqueIndexes.map(async (chapterIndex) => {
          const chapterMeta = chapterList[chapterIndex];
          if (!chapterMeta) {
            return;
          }

          const chapterId = String(chapterMeta.id);
          const cacheKey = getChapterCacheKey(String(novelId), chapterId);

          await chapterContentCache.prefetch(cacheKey, async () => {
            const remote = await fetchChapterContent(chapterMeta.id);
            return {
              id: String(remote.id),
              bookId: String(novelId),
              chapterIndex,
              title: remote.title,
              content: remote.content ?? '',
              wordCount: remote.word_count ?? 0,
            };
          });
        }),
      );
    } catch {}
  },

  refreshChapterPreviews: async (bookId, chapterIndex) => {
    try {
      const novelId = Number(bookId);
      if (!Number.isFinite(novelId)) {
        set({ prevChapterPreview: null, nextChapterPreview: null });
        return;
      }

      const { chapterList, settings, containerWidth, containerHeight } = get();

      const loadPreviewPage = async (targetIndex: number, pick: 'first' | 'last') => {
        const chapterMeta = chapterList[targetIndex];
        if (!chapterMeta) {
          return null;
        }

        const chapterId = String(chapterMeta.id);
        const cacheKey = getChapterCacheKey(String(novelId), chapterId);
        const chapter = await chapterContentCache.get(cacheKey);

        if (!chapter) {
          return null;
        }

        const previewPages = buildReaderPages(chapter, settings, containerWidth, containerHeight);
        if (!previewPages.length) {
          return null;
        }

        return pick === 'first' ? previewPages[0] : previewPages[previewPages.length - 1];
      };

      const [prevChapterPreview, nextChapterPreview] = await Promise.all([
        loadPreviewPage(chapterIndex - 1, 'last'),
        loadPreviewPage(chapterIndex + 1, 'first'),
      ]);
      set({ prevChapterPreview, nextChapterPreview });
    } catch {
      set({ prevChapterPreview: null, nextChapterPreview: null });
    }
  },

  loadChapter: async (bookId, chapterIndex) => {
    try {
      const novelId = Number(bookId);
      if (!Number.isFinite(novelId)) {
        set({ isLoading: false });
        return;
      }

      const chapterList = get().chapterList;
      const chapterMeta = chapterList[chapterIndex];
      if (!chapterMeta) {
        set({ isLoading: false });
        return;
      }

      const chapterId = String(chapterMeta.id);
      const cacheKey = getChapterCacheKey(String(novelId), chapterId);
      const cachedChapter = await chapterContentCache.get(cacheKey);

      if (!cachedChapter) {
        set({ isLoading: true });
      } else {
        set({ isLoading: false });
      }

      const chapter = await chapterContentCache.getOrLoad(cacheKey, async () => {
        const remote = await fetchChapterContent(chapterMeta.id);
        return {
          id: String(remote.id),
          bookId: String(novelId),
          chapterIndex,
          title: remote.title,
          content: remote.content ?? '',
          wordCount: remote.word_count ?? 0,
        } satisfies Chapter;
      });

      set({ currentChapter: chapter });
      await get().repaginate();
      set({ isLoading: false });
      void get()
        .prefetchChapters(bookId, [chapterIndex - 1, chapterIndex + 1, chapterIndex + 2])
        .then(async () => {
          await Promise.all([
            get().ensureChapterPaginated(chapterIndex - 1),
            get().ensureChapterPaginated(chapterIndex + 1),
          ]);
          await get().refreshChapterPreviews(bookId, chapterIndex);
        });
    } catch {
      set({ isLoading: false });
    }
  },

  repaginate: async () => {
    const { currentChapter, settings, containerWidth, containerHeight } = get();
    if (!currentChapter) return;
    const pages = buildReaderPages(currentChapter, settings, containerWidth, containerHeight);

    let newPageIndex = 0;
    const bookId = get().currentBook?.id;

    if (bookId) {
      try {
        const rawProgress = await AsyncStorage.getItem(`progress_${bookId}`);
        if (rawProgress) {
          const progress: ReadingProgress = JSON.parse(rawProgress);
          if (progress.chapterIndex === currentChapter.chapterIndex) {
            const targetCharOffset = progress.charOffset;
            const foundPage = pages.findIndex(
              (page) => page.startCharIndex <= targetCharOffset && page.endCharIndex >= targetCharOffset,
            );
            if (foundPage !== -1) {
              newPageIndex = foundPage;
            }
          }
        }
      } catch {}
    }

    const nextCache = new Map(get().chapterPagesCache);
    nextCache.set(currentChapter.chapterIndex, pages);
    set({ pages, currentPageIndex: newPageIndex, chapterPagesCache: nextCache });
    get().saveProgress();
  },

  saveProgress: async () => {
    const { currentBook, currentChapter, currentPageIndex, pages } = get();
    if (!currentBook || !currentChapter || pages.length === 0) return;

    const progress: ReadingProgress = {
      novelId: String(currentBook.id),
      chapterIndex: currentChapter.chapterIndex,
      pageIndex: currentPageIndex,
      charOffset: pages[currentPageIndex]?.startCharIndex ?? 0,
    };

    try {
      await AsyncStorage.setItem(`progress_${currentBook.id}`, JSON.stringify(progress));
    } catch {}
  },

  nextChapter: async () => {
    const { currentBook, currentChapter } = get();
    if (!currentBook || !currentChapter) return;
    await get().loadChapter(String(currentBook.id), currentChapter.chapterIndex + 1);
    set({ currentPageIndex: 0 });
    get().saveProgress();
    void get().prefetchChapters(String(currentBook.id), [currentChapter.chapterIndex + 2, currentChapter.chapterIndex + 3]);
  },

  prevChapter: async () => {
    const { currentBook, currentChapter } = get();
    if (!currentBook || !currentChapter) return;
    if (currentChapter.chapterIndex === 0) return;
    await get().loadChapter(String(currentBook.id), currentChapter.chapterIndex - 1);
    const { pages } = get();
    set({ currentPageIndex: Math.max(0, pages.length - 1) });
    get().saveProgress();
    void get().prefetchChapters(String(currentBook.id), [currentChapter.chapterIndex, currentChapter.chapterIndex + 1]);
  },
}));
