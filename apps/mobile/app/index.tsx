import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "../components/BrandMark";
import { colors, shared } from "../src/theme";
import { useStaffFlowStore } from "../src/store/useStaffFlowStore";

export default function SplashScreen() {
  const router = useRouter();
  const language = useStaffFlowStore((state) => state.language);
  const authenticated = useStaffFlowStore((state) => state.authenticated);
  const hydrated = useStaffFlowStore((state) => state.hydrated);
  const hydrateAuth = useStaffFlowStore((state) => state.hydrateAuth);
  const markY = useRef(new Animated.Value(70)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { void hydrateAuth(); }, [hydrateAuth]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(markY, { toValue: 0, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 650, delay: 600, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      if (!hydrated) return;
      if (!language) router.replace("/language");
      else if (!authenticated) router.replace("/login");
      else router.replace("/(tabs)");
    }, 2200);
    return () => clearTimeout(timer);
  }, [authenticated, hydrated, language, markY, opacity, router]);

  return <SafeAreaView style={[shared.screen, { backgroundColor: colors.surface }]}>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ alignItems: "center", transform: [{ translateY: markY }] }}>
        <BrandMark />
        <Animated.Text style={{ color: colors.primary, fontSize: 34, fontWeight: "800", marginTop: 28, opacity }}>StaffFlow</Animated.Text>
        <Animated.Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 6, opacity }}>Smart Staffing for Restaurants</Animated.Text>
        <View style={{ marginTop: 16, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primaryTintStrong }}><Text style={{ color: colors.primaryDark, fontWeight: "600" }}>• Delhi NCR Hospitality Network</Text></View>
      </Animated.View>
    </View>
    <View style={{ alignItems: "center", paddingBottom: 18 }}><View style={{ width: 120, height: 4, borderRadius: 2, backgroundColor: colors.primary }} /><Text style={{ marginTop: 20, color: colors.textTertiary, fontSize: 13 }}>Connecting to StaffFlow securely …</Text></View>
  </SafeAreaView>;
}
