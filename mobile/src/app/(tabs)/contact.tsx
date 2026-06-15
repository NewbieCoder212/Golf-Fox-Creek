import { View, Text, ScrollView } from 'react-native';
import { MapPin, Phone, Mail, Clock, Globe } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { foxColors } from '@/theme/tokens';

const CONTACT_INFO = {
  address: '200 Golf Street\nDieppe, NB E1A 8K9',
  phone: '(506) 859-4653',
  email: 'info@foxcreekgolfclub.ca',
  website: 'foxcreekgolfclub.ca',
};

const HOURS = [
  { day: 'Monday - Friday', hours: '6:00 AM - 8:00 PM' },
  { day: 'Saturday - Sunday', hours: '5:30 AM - 8:30 PM' },
  { day: 'Pro Shop', hours: '6:30 AM - 7:00 PM' },
  { day: 'Restaurant', hours: '7:00 AM - 9:00 PM' },
];

function ContactRow({
  icon: Icon,
  label,
  value,
  isLast = false,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center p-4 ${isLast ? '' : 'border-b border-fox-border/60'}`}
    >
      <View className="w-10 h-10 bg-fox-surface-elevated rounded-full items-center justify-center mr-4 border border-fox-border">
        <Icon size={16} color={foxColors.lime} strokeWidth={1.5} />
      </View>
      <View className="flex-1">
        <Text className="text-neutral-500 text-xs uppercase tracking-wider font-body-semibold">
          {label}
        </Text>
        <Text className="text-white font-body mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

export default function ContactScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-fox-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(500)} className="px-5 mb-6">
          <Text className="text-white text-2xl font-display tracking-tight">Contact Us</Text>
          <Text className="text-neutral-500 text-sm font-body mt-1">Fox Creek Golf Club</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} className="mx-5">
          <View className="bg-fox-surface rounded-2xl border border-fox-border overflow-hidden">
            <ContactRow icon={Phone} label="Phone" value={CONTACT_INFO.phone} />
            <ContactRow icon={Mail} label="Email" value={CONTACT_INFO.email} />
            <ContactRow
              icon={MapPin}
              label="Address"
              value={CONTACT_INFO.address.replace('\n', ', ')}
            />
            <ContactRow
              icon={Globe}
              label="Website"
              value={CONTACT_INFO.website}
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} className="px-5 mt-6">
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-4 font-body-semibold">
            Hours of Operation
          </Text>
          <View className="bg-fox-surface rounded-2xl border border-fox-border p-4">
            {HOURS.map((item, index) => (
              <View
                key={item.day}
                className={`flex-row justify-between items-center ${
                  index < HOURS.length - 1 ? 'mb-4 pb-4 border-b border-fox-border/60' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <Clock size={14} color="#525252" strokeWidth={1.5} />
                  <Text className="text-white font-body-semibold ml-3">{item.day}</Text>
                </View>
                <Text className="text-neutral-500 font-body">{item.hours}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View className="px-5 mt-10 mb-2 items-center">
          <Text className="text-neutral-600 text-xs font-body text-center">
            Powered by Acadia Venture Studio, Dieppe, NB
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
