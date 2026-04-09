import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedCard } from '@/features/discover/components/FeedCard';
import { getTabBarHeight } from '@/features/navigation/components/CustomTabBar';
import { fetchCategories, fetchNovels } from '@/shared/repositories/novelsRepository';
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

export default function DiscoverScreen() {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [novelRows, setNovelRows] = useState<any[]>([]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const categories = await fetchCategories();
        if (!cancelled) {
          setCategoryOptions((categories ?? []).map((item) => ({ id: item.id, name: item.name })));
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { novels } = await fetchNovels({ categoryId: activeCategoryId ?? undefined, page: 1, pageSize: 20 });
        if (!cancelled) {
          setNovelRows(novels ?? []);
        }
      } catch {
        if (!cancelled) setNovelRows([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCategoryId]);

  const books = useMemo(() => novelRows.map(toCard), [novelRows]);

  const resolvedHeight = viewportHeight || height;
  const tabBarHeight = getTabBarHeight(insets.bottom);
  const filterBarTop = Math.max(insets.top, 8);

  return (
    <View
      className="flex-1 bg-black"
      onLayout={(event) => {
        const { height: layoutHeight } = event.nativeEvent.layout;
        if (layoutHeight !== viewportHeight) {
          setViewportHeight(layoutHeight);
        }
      }}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: filterBarTop,
          zIndex: 40,
          paddingHorizontal: 24,
        }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}>
          <Pressable
            onPress={() => setActiveCategoryId(null)}
            className={`px-4 py-2 rounded-full transition-all ${
              activeCategoryId === null ? 'bg-white' : 'bg-white/10'
            }`}>
            <Text
              className={`text-[10px] font-bold uppercase tracking-widest ${
                activeCategoryId === null ? 'text-ink' : 'text-white/50'
              }`}>
              For You
            </Text>
          </Pressable>
          {categoryOptions.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setActiveCategoryId(category.id)}
              className={`px-4 py-2 rounded-full transition-all ${
                activeCategoryId === category.id ? 'bg-white' : 'bg-white/10'
              }`}>
              <Text
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  activeCategoryId === category.id ? 'text-ink' : 'text-white/50'
                }`}>
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard
            book={item}
            cardHeight={resolvedHeight}
            bottomOffset={tabBarHeight}
            onRead={(book) => router.push(`/reader/${book.id}`)}
          />
        )}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        pagingEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight }}
        snapToInterval={resolvedHeight}
        snapToAlignment="start"
        decelerationRate="fast"
      />
    </View>
  );
}
