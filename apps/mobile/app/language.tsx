import { useRouter } from "expo-router";
import { Check, Globe2 } from "../components/icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "../components/BrandMark";
import { colors, shared } from "../src/theme";
import { useStaffFlowStore } from "../src/store/useStaffFlowStore";

export default function LanguageScreen() {
  const router = useRouter();
  const setLanguage = useStaffFlowStore((state) => state.setLanguage);
  const [selected, setSelected] = useState<"en" | "hi" | null>(null);
  return <SafeAreaView style={shared.screen}>
    <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
      <View style={{ alignItems: "center", marginTop: 22 }}><BrandMark compact /><Text style={[shared.title, { textAlign: "center", marginTop: 24, fontSize: 22 }]}>Choose your language</Text><Text style={[shared.caption, { textAlign: "center", marginTop: 8 }]}>You can change this later in settings</Text></View>
      <View style={{ gap: 14, marginTop: 36 }}>
        <LanguageCard selected={selected === "en"} onPress={() => setSelected("en")} symbol="A" label="English" subtitle="Continue in English" />
        <LanguageCard selected={selected === "hi"} onPress={() => setSelected("hi")} symbol="अ" label="हिन्दी" subtitle="हिन्दी में जारी रखें" warm />
      </View>
      <View style={{ flex: 1, minHeight: 44 }} />
      <Pressable disabled={!selected} onPress={() => { if (!selected) return; setLanguage(selected); router.replace("/login"); }} style={[shared.primaryButton, { opacity: selected ? 1 : 0.4 }]}><Text style={shared.buttonText}>{selected === "hi" ? "जारी रखें" : "Continue"}</Text></Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}><Globe2 size={14} color={colors.textTertiary} /><Text style={{ color: colors.textTertiary, fontSize: 12 }}>More languages coming soon</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function LanguageCard({ selected, onPress, symbol, label, subtitle, warm }: { selected: boolean; onPress: () => void; symbol: string; label: string; subtitle: string; warm?: boolean }) {
  return <Pressable onPress={onPress} style={{ minHeight: 102, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.primary : colors.border, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: colors.primary, shadowOpacity: selected ? 0.12 : 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: selected ? 2 : 0 }}>
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: warm ? "#FFF4D6" : colors.primaryTint, alignItems: "center", justifyContent: "center" }}><Text style={{ color: warm ? "#A46700" : colors.primary, fontSize: 22, fontWeight: "700" }}>{symbol}</Text></View>
    <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>{label}</Text><Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>{subtitle}</Text></View>
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, alignItems: "center", justifyContent: "center" }}>{selected ? <Check color={colors.surface} size={16} strokeWidth={3} /> : null}</View>
  </Pressable>;
}
