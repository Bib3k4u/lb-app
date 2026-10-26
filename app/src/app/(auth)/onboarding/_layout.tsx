import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  // Each step owns its bidirectional swipe so forward gestures can run the
  // same validation and save logic as Continue; the native stack only knows
  // how to pop backward and would bypass that contract.
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
