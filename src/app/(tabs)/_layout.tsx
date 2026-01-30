import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, Clock, Flag, Phone, ClipboardList, Newspaper } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0c0c0c',
          borderTopColor: '#262626',
          borderTopWidth: 0.5,
          height: 85,
          paddingBottom: 28,
          paddingTop: 12,
        },
        tabBarActiveTintColor: '#a3e635',
        tabBarInactiveTintColor: '#525252',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-60'}>
              <Home size={22} color={color} strokeWidth={focused ? 2.5 : 1.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="teetimes"
        options={{
          title: 'Book',
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-60'}>
              <Clock size={22} color={color} strokeWidth={focused ? 2.5 : 1.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scorecard"
        options={{
          title: 'Scorecard',
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-60'}>
              <ClipboardList size={22} color={color} strokeWidth={focused ? 2.5 : 1.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="course"
        options={{
          title: 'Course',
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-60'}>
              <Flag size={22} color={color} strokeWidth={focused ? 2.5 : 1.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="contact"
        options={{
          title: 'Contact',
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-60'}>
              <Phone size={22} color={color} strokeWidth={focused ? 2.5 : 1.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-60'}>
              <Newspaper size={22} color={color} strokeWidth={focused ? 2.5 : 1.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
