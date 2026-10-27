import { useRouter } from "expo-router";
import { ArrowUp, Check, Mic, ShieldCheck, Sparkles, UserCircle2 } from "../../components/icons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabs } from "../../components/BottomTabs";
import { colors, shared } from "../../src/theme";
import { useStaffFlowStore } from "../../src/store/useStaffFlowStore";
import { apiRequest } from "../../src/lib/api";
import type { RequestRecord } from "../../src/domain/types";

const examples = [
  "2 Chinese chefs, Sat evening",
  "1 cleaner, Sunday morning",
  "Tandoor chef, 25 Oct",
];

export default function RequestInputScreen() {
  const router = useRouter();
  const setRequestRecord = useStaffFlowStore((state) => state.setRequestRecord);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const request = await apiRequest<RequestRecord>("/requests", { method: "POST", body: { rawInput: text.trim() } });
      setRequestRecord(request);
      router.push("/loading");
    } catch (reason) {
      Alert.alert("Request could not be created", reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return <SafeAreaView style={shared.screen}>
    <View style={{ height: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.canvas }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>StaffFlow</Text><View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.primaryTint }}><Text style={{ color: colors.primaryDark, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>DELHI OPS</Text></View></View><UserCircle2 color={colors.primary} size={34} /></View>
    <ScrollView contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Sparkles size={16} color={colors.primary} /><Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>AI SMART DISPATCH</Text><View style={{ flex: 1 }} /><Check size={15} color={colors.primary} /><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Instant fill</Text></View><Text style={[shared.title, { marginTop: 16, fontSize: 21 }]}>What staff do you need today?</Text><Text style={[shared.body, { color: colors.textSecondary, marginTop: 3 }]}>Type naturally — AI parses roles, timing & location</Text>
        <View style={{ marginTop: 16, minHeight: 280, backgroundColor: colors.surface, borderRadius: 16, padding: 16, shadowColor: colors.primary, shadowOpacity: text ? 0.1 : 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}><TextInput multiline value={text} onChangeText={setText} placeholder="Describe the staff you need... e.g. 2 Tandoor chefs for Friday dinner service in Connaught Place" placeholderTextColor={colors.textSecondary} textAlignVertical="top" style={{ flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 }} /><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}><Pressable accessibilityLabel="Voice input" onPress={() => undefined} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Mic color={colors.textSecondary} size={21} /></Pressable><Pressable accessibilityLabel="Parse request" disabled={!text.trim() || busy} onPress={() => void submit()} style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, opacity: text.trim() && !busy ? 1 : 0.35 }}><ArrowUp color={colors.surface} size={22} /></Pressable></View></View>
        <View style={{ marginTop: 18 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={shared.label}>Quick examples</Text><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>Tap to fill</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>{examples.map((example) => <Pressable key={example} onPress={() => setText(example)} style={{ borderRadius: 999, backgroundColor: colors.primaryTintStrong, paddingHorizontal: 13, paddingVertical: 9 }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "600" }}>{example}</Text></Pressable>)}</ScrollView></View>
        <View style={{ marginTop: 24, padding: 14, backgroundColor: colors.surface, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}><ShieldCheck size={20} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Recent: Connaught Place outlet</Text><Text style={shared.caption}>Avg match time: 4 mins</Text></View><View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.surfaceContainer }}><Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>Active Hub</Text></View></View>
        <View style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: colors.surfaceLow, flexDirection: "row", gap: 10 }}><ShieldCheck size={18} color={colors.primary} /><Text style={[shared.caption, { flex: 1, color: colors.textSecondary }]}>All 4,200+ rostered Delhi culinary & service staff are verified with Aadhaar and FSSAI cards.</Text></View>
      </View>
    </ScrollView>
    <BottomTabs active="new" onNew={() => undefined} onRequests={() => router.push("/(tabs)/my-requests")} />
  </SafeAreaView>;
}
