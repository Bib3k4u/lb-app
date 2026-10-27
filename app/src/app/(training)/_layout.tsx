/**
 * The training section.
 *
 * FR-PFP-01: mounted for EVERY account regardless of role. There is no
 * permission guard here and there must never be one — a Gym Owner, a Location
 * Admin, a Trainer and a Member all reach these screens by the same route.
 * If a guard ever appears in this file, the dual-facet model has been broken.
 *
 * "Manage" is the one conditional tab — hidden (href: null) for a plain
 * MEMBER, who has no operational section to manage. Its nested stack keeps
 * this tab bar mounted while admins move through approvals, roster, locations
 * and plans.
 */
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';
import { colors } from '../../lib/theme';
import { useAuth, visibleSections } from '../../lib/auth/store';

export default function TrainingLayout() {
  const user = useAuth((s) => s.user);
  const sections = user ? visibleSections(user) : null;
  const canManage = sections ? sections.admin || sections.trainer : false;
  const pathname = usePathname();
  const workoutsActive = pathname === '/bookings' || pathname.startsWith('/workout/');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dim,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: colors.ground, borderTopColor: colors.glassLine },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={workoutsActive ? colors.accent : (color as string)} />,
          tabBarLabel: ({ color }) => <Text style={{ color: workoutsActive ? colors.accent : color, fontSize: 10, fontWeight: '600' }}>Workouts</Text>,
        }}
      />
      <Tabs.Screen name="workout" options={{ href: null }} />
      <Tabs.Screen name="feedback" options={{ href: null }} />
      <Tabs.Screen
        name="nutrition"
        options={{ title: 'Nutrition', tabBarIcon: ({ color, size }) => <Ionicons name="nutrition-outline" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'Manage',
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color as string} />,
          ...(canManage ? {} : { href: null }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
