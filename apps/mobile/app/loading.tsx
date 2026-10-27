import { useRouter } from "expo-router";
import { ChefHat, Clock3 } from "../components/icons";
import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, shared } from "../src/theme";

export default function LoadingScreen() {
  const router = useRouter();
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(bounce, { toValue: -10, duration: 500, useNativeDriver: true }), Animated.timing(bounce, { toValue: 0, duration: 500, useNativeDriver: true })])).start();
    const timer = setTimeout(() => router.replace("/review"), 1100);
    return () => clearTimeout(timer);
  }, [bounce, router]);
  return <SafeAreaView style={shared.screen}><ScreenHeader title="Request Detail" back={() => router.back()} /><View style={{ flex: 1, alignItems: "center", padding: 20, paddingTop: 70 }}><Animated.View style={{ transform: [{ translateY: bounce }], width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}><ChefHat color={colors.primary} size={50} /></Animated.View><Text style={[shared.heading, { marginTop: 26 }]}>Reading your request…</Text><Text style={[shared.caption, { marginTop: 8 }]}>The backend is validating your request</Text><View style={{ width: "100%", gap: 12, marginTop: 48 }}><SkeletonCard /><SkeletonCard /></View><View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 36 }}><Clock3 size={15} color={colors.textTertiary} /><Text style={{ color: colors.textTertiary, fontSize: 12 }}>Checking live roster availability</Text></View></View></SafeAreaView>;
}

function SkeletonCard() { return <View style={{ height: 94, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 11 }}><View style={{ width: "42%", height: 12, backgroundColor: colors.surfaceContainer, borderRadius: 6 }} /><View style={{ width: "72%", height: 10, backgroundColor: colors.surfaceLow, borderRadius: 5 }} /><View style={{ width: "58%", height: 10, backgroundColor: colors.surfaceLow, borderRadius: 5 }} /></View>; }
