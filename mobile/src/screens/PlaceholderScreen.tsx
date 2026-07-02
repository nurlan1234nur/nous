import { StyleSheet, Text, View } from 'react-native';

interface PlaceholderScreenProps {
  title: string;
  description: string;
}

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#fdf6f0',
    flex: 1,
    padding: 24,
    paddingTop: 72,
  },
  title: {
    color: '#2d1f2e',
    fontSize: 30,
    fontWeight: '800',
  },
  description: {
    color: '#9b8a93',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
});

