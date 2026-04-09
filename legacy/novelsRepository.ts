import { supabase } from '@/shared/api/supabase';
import { novelContentBucket } from '@/shared/constants/storageBuckets';

async function blobToText(blob: Blob) {
  const candidate = blob as unknown as { text?: () => Promise<string> };
  if (candidate.text) {
    return candidate.text();
  }
  return new Response(blob).text();
}

export async function fetchNovels(params: {
  categoryId?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  const { categoryId, keyword, page = 1, pageSize = 20 } = params;

  let query = supabase
    .from('novels')
    .select('*, categories(name)', { count: 'exact' });

  if (categoryId) query = query.eq('category_id', categoryId);
  if (keyword) query = query.textSearch('fts', keyword);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('view_count', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { novels: data, total: count ?? 0 };
}

export async function fetchNovelById(novelId: number) {
  const { data, error } = await supabase
    .from('novels')
    .select('*, categories(name)')
    .eq('id', novelId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchChapterList(novelId: number) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, chapter_no, title, is_free, coin_price, word_count')
    .eq('novel_id', novelId)
    .order('chapter_no');

  if (error) throw error;
  return data;
}

export async function fetchChapterContent(chapterId: number) {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
    .single();

  if (error) throw error;

  const contentPath = (data as any)?.content_path as string | undefined;
  if (contentPath) {
    const { data: fileData, error: fileError } = await supabase.storage
      .from(novelContentBucket)
      .download(contentPath);

    if (!fileError && fileData) {
      const rawText = await blobToText(fileData as unknown as Blob);
      const parsed = JSON.parse(rawText) as { content?: string };
      if (typeof parsed.content === 'string') {
        return { ...data, content: parsed.content };
      }
    }
  }

  return data;
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data;
}
