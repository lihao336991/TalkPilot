import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LegalSection = {
  title: string;
  body: string;
};

type LegalDocumentScreenProps = {
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

export function LegalDocumentScreen(props: LegalDocumentScreenProps) {
  const { title, subtitle, sections } = props;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function closeScreen() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/paywall');
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />

      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) + 4 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close legal document"
            onPress={closeScreen}
            style={styles.iconButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 24 },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Placeholder copy is provided here so the subscription flow can link to a real in-app Terms / Privacy page. Replace this text with your final legal content before release.
            </Text>
          </View>

          {sections.map((section) => (
            <View key={section.title} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    paddingHorizontal: 20,
    gap: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerCopy: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.68)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 16,
  },
  noticeCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(210,244,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(210,244,92,0.2)',
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 21,
    color: '#F4FFD0',
  },
  sectionCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.74)',
  },
});
