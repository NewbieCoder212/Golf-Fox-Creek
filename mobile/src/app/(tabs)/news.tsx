import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Newspaper, Calendar, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  link: string;
  content: string;
}

// Mock RSS data for Fox Creek Golf Club news
const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Spring Season Opening Announcement',
    description: 'Fox Creek Golf Club is pleased to announce our spring opening date and new seasonal rates.',
    pubDate: '2026-01-02T10:00:00Z',
    link: 'https://foxcreekgolf.ca/news/spring-opening',
    content: 'We are thrilled to announce that Fox Creek Golf Club will be opening for the 2026 season on April 15th. Early bird memberships are now available with a 15% discount until March 31st. Our course maintenance team has been working diligently throughout the winter to ensure pristine playing conditions.',
  },
  {
    id: '2',
    title: 'New Cart Fleet Arriving This Season',
    description: 'Experience our brand new electric golf cart fleet with GPS navigation and USB charging.',
    pubDate: '2025-12-28T14:30:00Z',
    link: 'https://foxcreekgolf.ca/news/new-carts',
    content: 'Fox Creek is investing in your experience with a completely new fleet of Club Car electric carts. Each cart features built-in GPS yardage, USB charging ports, and cooler compartments. The new fleet will be available starting opening day.',
  },
  {
    id: '3',
    title: 'Junior Golf Program Registration Open',
    description: 'Sign up your young golfers for our award-winning junior development program.',
    pubDate: '2025-12-20T09:00:00Z',
    link: 'https://foxcreekgolf.ca/news/junior-program',
    content: 'Our Junior Golf Program returns for another exciting season! Led by PGA professionals, the program offers instruction for ages 7-17 at all skill levels. Sessions run weekly from May through August. Early registration discount available until February 28th.',
  },
  {
    id: '4',
    title: 'Clubhouse Renovations Complete',
    description: 'Tour our newly renovated clubhouse featuring expanded pro shop and dining area.',
    pubDate: '2025-12-15T11:00:00Z',
    link: 'https://foxcreekgolf.ca/news/clubhouse-reno',
    content: 'After months of renovation, we are proud to unveil our refreshed clubhouse. The pro shop has doubled in size with premium brands. The Fairway Grille now seats 80 guests with panoramic views of the 18th green. New member lounges provide the perfect post-round gathering space.',
  },
  {
    id: '5',
    title: 'Member-Guest Tournament Dates Announced',
    description: 'Save the date for our signature Member-Guest event returning in July.',
    pubDate: '2025-12-10T16:00:00Z',
    link: 'https://foxcreekgolf.ca/news/member-guest',
    content: 'The 25th Annual Fox Creek Member-Guest Tournament will be held July 18-19, 2026. This two-day scramble format event includes Friday night dinner, Saturday golf and awards banquet. Limited to 72 teams. Member registration opens February 1st.',
  },
];

// Simple HTML to text converter
const stripHtml = (html: string): string => {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      // In production, this would fetch from an actual RSS feed
      // For now, using mock data
      await new Promise((resolve) => setTimeout(resolve, 800));
      setNews(MOCK_NEWS);
    } catch (error) {
      console.log('Error fetching news:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchNews();
  }, [fetchNews]);

  const toggleExpand = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId(expandedId === id ? null : id);
  };

  const openLink = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
        <Text className="text-neutral-500 text-sm mt-4">Loading club news...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a3e635"
            colors={['#a3e635']}
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2" style={{ paddingTop: insets.top + 16 }}>
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            className="flex-row items-center justify-between"
          >
            <View>
              <Text className="text-white text-2xl font-bold tracking-tight">Club News</Text>
              <Text className="text-neutral-500 text-sm mt-1">
                Stay updated with Fox Creek
              </Text>
            </View>
            <View className="w-12 h-12 bg-[#141414] rounded-full items-center justify-center border border-neutral-800">
              <Newspaper size={20} color="#a3e635" strokeWidth={1.5} />
            </View>
          </Animated.View>
        </View>

        {/* News Cards */}
        <View className="px-5 mt-4">
          {news.map((item, index) => {
            const isExpanded = expandedId === item.id;

            return (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(200 + index * 100).duration(500)}
              >
                <Pressable
                  onPress={() => toggleExpand(item.id)}
                  className="bg-[#141414] rounded-2xl border border-neutral-800 mb-4 overflow-hidden active:opacity-90"
                >
                  {/* Card Header */}
                  <View className="p-4">
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-row items-center">
                        <Calendar size={12} color="#737373" />
                        <Text className="text-neutral-500 text-xs ml-1.5">
                          {formatDate(item.pubDate)}
                        </Text>
                      </View>
                      <ChevronRight
                        size={16}
                        color="#525252"
                        style={{
                          transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
                        }}
                      />
                    </View>

                    <Text className="text-white text-lg font-semibold leading-tight mb-2">
                      {stripHtml(item.title)}
                    </Text>

                    <Text
                      className="text-neutral-400 text-sm leading-relaxed"
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {stripHtml(item.description)}
                    </Text>
                  </View>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <Animated.View entering={FadeIn.duration(300)}>
                      <View className="border-t border-neutral-800 p-4 bg-[#0f0f0f]">
                        <Text className="text-neutral-300 text-sm leading-relaxed mb-4">
                          {stripHtml(item.content)}
                        </Text>

                        <Pressable
                          onPress={() => openLink(item.link)}
                          className="flex-row items-center justify-center bg-neutral-800 rounded-xl py-3 active:opacity-70"
                        >
                          <ExternalLink size={16} color="#a3e635" />
                          <Text className="text-lime-400 font-medium ml-2">Read Full Article</Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  )}

                  {/* Accent Line */}
                  <View className="h-0.5 bg-lime-400/20" />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {/* Footer */}
        <View className="px-5 py-6 items-center">
          <Text className="text-neutral-600 text-xs">Pull to refresh for latest news</Text>
        </View>

        <View className="h-4" />
      </ScrollView>
    </View>
  );
}
