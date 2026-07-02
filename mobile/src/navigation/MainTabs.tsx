import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChatScreen } from '../screens/ChatScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MemoriesScreen } from '../screens/MemoriesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { TimelineScreen } from '../screens/TimelineScreen';

type TabKey = 'home' | 'timeline' | 'memories' | 'chat' | 'more';

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Home', icon: '\u2302' },
  { key: 'timeline', label: 'Timeline', icon: '\u25c7' },
  { key: 'memories', label: 'Memories', icon: '\u25a1' },
  { key: 'chat', label: 'Chat', icon: '\u2709' },
  { key: 'more', label: 'More', icon: '\u22ef' },
];

function renderScreen(tab: TabKey) {
  switch (tab) {
    case 'home':
      return <HomeScreen />;
    case 'timeline':
      return <TimelineScreen />;
    case 'memories':
      return <MemoriesScreen />;
    case 'chat':
      return <ChatScreen />;
    case 'more':
      return <MoreScreen />;
  }
}

export function MainTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  return (
    <View style={styles.shell}>
      <View style={styles.content}>{renderScreen(activeTab)}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}
            >
              <Text style={[styles.icon, active && styles.activeText]}>{tab.icon}</Text>
              <Text style={[styles.label, active && styles.activeText]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#fdf6f0',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderWidth: 1,
    borderRadius: 24,
    flexDirection: 'row',
    marginBottom: 12,
    marginHorizontal: 12,
    minHeight: 68,
    paddingBottom: 6,
    paddingHorizontal: 8,
    paddingTop: 6,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 54,
  },
  activeTab: {
    backgroundColor: '#f9ede6',
  },
  pressed: {
    opacity: 0.8,
  },
  icon: {
    color: '#9b8a93',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  label: {
    color: '#9b8a93',
    fontSize: 11,
    fontWeight: '700',
  },
  activeText: {
    color: '#e8607a',
  },
});
