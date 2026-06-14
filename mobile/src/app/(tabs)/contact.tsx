import { View, Text, ScrollView, Pressable, Linking, Image } from 'react-native';
import { MapPin, Phone, Mail, Clock, Globe, Instagram, Facebook, ExternalLink } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Fox Creek Golf Club - Dieppe, NB, Canada
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

const STAFF = [
  { name: 'Mike Thompson', role: 'Head Golf Professional', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80' },
  { name: 'Sarah Chen', role: 'Course Superintendent', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80' },
  { name: 'David Martinez', role: 'Events Coordinator', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80' },
];

export default function ContactScreen() {
  const insets = useSafeAreaInsets();

  const handleCall = () => {
    Linking.openURL(`tel:${CONTACT_INFO.phone.replace(/[^0-9]/g, '')}`);
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${CONTACT_INFO.email}`);
  };

  const handleWebsite = () => {
    Linking.openURL(`https://${CONTACT_INFO.website}`);
  };

  const handleDirections = () => {
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(CONTACT_INFO.address)}`);
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Hero */}
        <View className="relative h-48">
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1592919505780-303950717480?w=800&q=80' }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', '#0c0c0c']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 100 }}
          />
          <View className="absolute bottom-4 left-5">
            <Animated.Text
              entering={FadeInDown.delay(100).duration(500)}
              className="text-white text-2xl font-bold tracking-tight"
            >
              Contact Us
            </Animated.Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          className="px-5 -mt-2 flex-row gap-3"
        >
          <Pressable
            onPress={handleCall}
            className="flex-1 bg-lime-400 rounded-xl py-4 flex-row items-center justify-center active:opacity-80"
          >
            <Phone size={18} color="black" strokeWidth={2} />
            <Text className="text-black font-semibold ml-2">Call</Text>
          </Pressable>
          <Pressable
            onPress={handleEmail}
            className="flex-1 bg-[#141414] border border-neutral-800 rounded-xl py-4 flex-row items-center justify-center active:opacity-80"
          >
            <Mail size={18} color="#a3e635" strokeWidth={1.5} />
            <Text className="text-neutral-300 font-semibold ml-2">Email</Text>
          </Pressable>
          <Pressable
            onPress={handleDirections}
            className="flex-1 bg-[#141414] border border-neutral-800 rounded-xl py-4 flex-row items-center justify-center active:opacity-80"
          >
            <MapPin size={18} color="#a3e635" strokeWidth={1.5} />
            <Text className="text-neutral-300 font-semibold ml-2">Map</Text>
          </Pressable>
        </Animated.View>

        {/* Contact Details */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          className="mx-5 mt-6"
        >
          <View className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
            <Pressable
              onPress={handleCall}
              className="flex-row items-center p-4 border-b border-neutral-800/50 active:bg-neutral-800/20"
            >
              <View className="w-10 h-10 bg-neutral-900 rounded-full items-center justify-center mr-4 border border-neutral-800">
                <Phone size={16} color="#a3e635" strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-wider">Phone</Text>
                <Text className="text-white font-medium mt-0.5">{CONTACT_INFO.phone}</Text>
              </View>
              <ExternalLink size={16} color="#525252" />
            </Pressable>

            <Pressable
              onPress={handleEmail}
              className="flex-row items-center p-4 border-b border-neutral-800/50 active:bg-neutral-800/20"
            >
              <View className="w-10 h-10 bg-neutral-900 rounded-full items-center justify-center mr-4 border border-neutral-800">
                <Mail size={16} color="#a3e635" strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-wider">Email</Text>
                <Text className="text-white font-medium mt-0.5">{CONTACT_INFO.email}</Text>
              </View>
              <ExternalLink size={16} color="#525252" />
            </Pressable>

            <Pressable
              onPress={handleDirections}
              className="flex-row items-center p-4 border-b border-neutral-800/50 active:bg-neutral-800/20"
            >
              <View className="w-10 h-10 bg-neutral-900 rounded-full items-center justify-center mr-4 border border-neutral-800">
                <MapPin size={16} color="#a3e635" strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-wider">Address</Text>
                <Text className="text-white font-medium mt-0.5">{CONTACT_INFO.address.replace('\n', ', ')}</Text>
              </View>
              <ExternalLink size={16} color="#525252" />
            </Pressable>

            <Pressable
              onPress={handleWebsite}
              className="flex-row items-center p-4 active:bg-neutral-800/20"
            >
              <View className="w-10 h-10 bg-neutral-900 rounded-full items-center justify-center mr-4 border border-neutral-800">
                <Globe size={16} color="#a3e635" strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-wider">Website</Text>
                <Text className="text-white font-medium mt-0.5">{CONTACT_INFO.website}</Text>
              </View>
              <ExternalLink size={16} color="#525252" />
            </Pressable>
          </View>
        </Animated.View>

        {/* Hours */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          className="px-5 mt-6"
        >
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-4">Hours of Operation</Text>
          <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4">
            {HOURS.map((item, index) => (
              <View
                key={item.day}
                className={`flex-row justify-between items-center ${index < HOURS.length - 1 ? 'mb-4 pb-4 border-b border-neutral-800/50' : ''}`}
              >
                <View className="flex-row items-center">
                  <Clock size={14} color="#525252" strokeWidth={1.5} />
                  <Text className="text-white font-medium ml-3">{item.day}</Text>
                </View>
                <Text className="text-neutral-500">{item.hours}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Staff */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          className="px-5 mt-6"
        >
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-4">Our Team</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            {STAFF.map((person, index) => (
              <View
                key={person.name}
                className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 mr-4 items-center"
                style={{ width: 160 }}
              >
                <Image
                  source={{ uri: person.image }}
                  className="w-20 h-20 rounded-full mb-3"
                />
                <Text className="text-white font-medium text-center">{person.name}</Text>
                <Text className="text-neutral-500 text-xs text-center mt-1">{person.role}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Social Links */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          className="px-5 mt-6 mb-8"
        >
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-4">Follow Us</Text>
          <View className="flex-row gap-4">
            <Pressable className="flex-1 bg-[#141414] border border-neutral-800 rounded-xl py-4 flex-row items-center justify-center active:opacity-80">
              <Instagram size={20} color="#a3e635" strokeWidth={1.5} />
              <Text className="text-neutral-300 font-semibold ml-2">Instagram</Text>
            </Pressable>
            <Pressable className="flex-1 bg-[#141414] border border-neutral-800 rounded-xl py-4 flex-row items-center justify-center active:opacity-80">
              <Facebook size={20} color="#a3e635" strokeWidth={1.5} />
              <Text className="text-neutral-300 font-semibold ml-2">Facebook</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
