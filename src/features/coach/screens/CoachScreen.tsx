import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { TabScrollScreen } from '@/features/navigation/components/TabScrollScreen';

const drills = [
  {
    icon: 'message-square',
    title: 'Reply polish',
    description: 'Shorten a response while keeping it friendly and confident.',
  },
  {
    icon: 'repeat',
    title: 'Rephrase intent',
    description: 'Switch between casual, business, and interview tones in one tap.',
  },
  {
    icon: 'alert-circle',
    title: 'Repair moments',
    description: 'Handle “Sorry, could you repeat that?” and clarification follow-ups.',
  },
];

export default function CoachScreen() {
  return (
    <TabScrollScreen title="Coach" subtitle="Practice flows and reply strategy" actionIcon="message-circle">
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Build reusable coaching surfaces before wiring in real-time AI logic.</Text>
        <Text style={styles.heroDescription}>
          This tab is ready for prompt templates, speaking drills, review rubrics, and expression packs.
        </Text>
      </View>

      {drills.map((item) => (
        <View key={item.title} style={styles.drillCard}>
          <View style={styles.iconWrap}>
            <Feather name={item.icon as keyof typeof Feather.glyphMap} size={18} color="#1A1A1A" />
          </View>
          <View style={styles.copyWrap}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </View>
        </View>
      ))}
    </TabScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 26,
    padding: 22,
    backgroundColor: '#E9E3D9',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(26,26,26,0.7)',
  },
  drillCard: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(26,26,26,0.68)',
  },
});
