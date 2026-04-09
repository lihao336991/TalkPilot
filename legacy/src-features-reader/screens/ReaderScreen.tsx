import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChapterDrawer } from '@/features/reader/components/ChapterDrawer';
import { HorizontalFlipReader } from '@/features/reader/components/HorizontalFlipReader';
import { ReaderOverlay } from '@/features/reader/components/ReaderOverlay';
import { SettingsPanel } from '@/features/reader/components/SettingsPanel';
import { VerticalScrollReader } from '@/features/reader/components/VerticalScrollReader';
import { useReaderStore } from '@/features/reader/store/readerStore';
import { initDb } from '@/storage/chapterCache';

try {
  initDb();
} catch {}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { initReader, isLoading, settings, isOverlayVisible, setContainerSize } = useReaderStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (id) {
      initReader(id);
    }
  }, [id, initReader]);

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize(width, height);
  };

  const ReaderComponent = settings.flipMode === 'vertical' ? VerticalScrollReader : HorizontalFlipReader;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: settings.theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={settings.theme.textColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: settings.theme.backgroundColor }]} onLayout={handleLayout}>
      <StatusBar hidden={!isOverlayVisible} style={settings.theme.name === 'night' ? 'light' : 'dark'} />

      <ReaderComponent />

      {isOverlayVisible && (
        <ReaderOverlay onOpenSettings={() => setSettingsOpen(true)} onOpenCatalog={() => setDrawerOpen(true)} />
      )}

      {drawerOpen && <ChapterDrawer onClose={() => setDrawerOpen(false)} />}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
