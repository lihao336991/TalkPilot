import { supabase } from '@/shared/api/supabase';
import { tempUserId } from '@/shared/constants/tempUserId';

export async function getBookshelf() {
  const { data, error } = await supabase
    .from('bookshelf')
    .select('*, novels(id, title, author, cover_url, chapter_count)')
    .eq('user_id', tempUserId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function addToBookshelf(novelId: number) {
  const { error } = await supabase
    .from('bookshelf')
    .upsert({ user_id: tempUserId, novel_id: novelId });

  if (error) throw error;
}

export async function removeFromBookshelf(novelId: number) {
  const { error } = await supabase
    .from('bookshelf')
    .delete()
    .eq('user_id', tempUserId)
    .eq('novel_id', novelId);

  if (error) throw error;
}

export async function syncReadingProgress(params: {
  novelId: number;
  chapterId: number;
  chapterNo: number;
  scrollPosition: number;
}) {
  const { error } = await supabase.from('reading_progress').upsert(
    {
      user_id: tempUserId,
      novel_id: params.novelId,
      chapter_id: params.chapterId,
      chapter_no: params.chapterNo,
      scroll_position: params.scrollPosition,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,novel_id' },
  );

  if (error) throw error;
}

export async function getReadingProgress(novelId: number) {
  const { data } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', tempUserId)
    .eq('novel_id', novelId)
    .maybeSingle();

  return data;
}
