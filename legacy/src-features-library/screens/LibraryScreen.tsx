import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TabScrollScreen } from '@/features/navigation/components/TabScrollScreen';
import { fetchNovels } from '@/shared/repositories/novelsRepository';
import type { NovelCard } from '@/shared/types/novelCard';

function toCard(novel: any): NovelCard {
  return {
    id: String(novel.id),
    title: String(novel.title ?? ''),
    author: String(novel.author ?? ''),
    coverUrl: String(novel.cover_url ?? ''),
    description: String(novel.description ?? ''),
    tags: Array.isArray(novel.tags) ? novel.tags : [],
    rating: Number(novel.rating_avg ?? 0),
  };
}

export default function LibraryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [novelRows, setNovelRows] = useState<any[]>([]);
  const books = useMemo(() => novelRows.map(toCard), [novelRows]);
  const currentBook = useMemo(() => books[0], [books]);
  const coverWidth = Math.max(96, (width - 48 - 32) / 3);

  const openReader = (book: NovelCard) => {
    router.push(`/reader/${book.id}`);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { novels } = await fetchNovels({ page: 1, pageSize: 30 });
        if (!cancelled) setNovelRows(novels ?? []);
      } catch {
        if (!cancelled) setNovelRows([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TabScrollScreen title="Library" subtitle="Your Books" actionIcon="search">
      <View style={styles.content}>
        {currentBook && (
          <Pressable style={styles.continueCard} onPress={() => openReader(currentBook)}>
          <View style={styles.continueCover}>
            <Image source={{ uri: currentBook.coverUrl }} style={styles.coverImage} resizeMode="cover" />
          </View>
          <View style={styles.continueBody}>
            <Text style={styles.eyebrow}>Continue Reading</Text>
            <Text style={styles.continueTitle}>{currentBook.title}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
            <Text style={styles.progressText}>0% Complete</Text>
          </View>
          </Pressable>
        )}

        <View style={styles.grid}>
          {books.map((book) => (
            <Pressable
              key={book.id}
              style={[styles.gridItem, { width: coverWidth, height: coverWidth * 1.5 }]}
              onPress={() => openReader(book)}>
              <Image source={{ uri: book.coverUrl }} style={styles.coverImage} resizeMode="cover" />
            </Pressable>
          ))}
          <View
            style={[
              styles.placeholderTile,
              { width: coverWidth, height: coverWidth * 1.5 },
            ]}>
            <Feather name="book" size={32} color="rgba(26,26,26,0.2)" />
          </View>
        </View>
      </View>
    </TabScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 32,
  },
  continueCard: {
    backgroundColor: 'rgba(26,26,26,0.05)',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  continueCover: {
    width: 80,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  continueBody: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2.6,
    color: 'rgba(26,26,26,0.3)',
    marginBottom: 4,
  },
  continueTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(26,26,26,0.1)',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
  progressText: {
    marginTop: 8,
    fontSize: 10,
    color: 'rgba(26,26,26,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E7E1D7',
  },
  placeholderTile: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(26,26,26,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
});
