import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

// Google sign-in (task 3.2) returns to `dozi://auth/callback`. The Account screen reads that
// address itself; if the phone also opens it as a link, this screen just steps back out of the way.
export default function AuthCallback() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View className="flex-1 bg-background" />;
}
