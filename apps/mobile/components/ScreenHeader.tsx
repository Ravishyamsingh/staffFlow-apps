import { ArrowLeft, UserCircle2 } from "./icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "../src/theme";

export function ScreenHeader({ title, back }: { title?: string; back?: () => void }) {
  return (
    <View style={{ height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: colors.canvas }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {back ? <Pressable accessibilityLabel="Go back" hitSlop={8} onPress={back} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><ArrowLeft color={colors.text} size={25} /></Pressable> : null}
        {title ? <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{title}</Text> : null}
      </View>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><UserCircle2 color={colors.surface} size={22} /></View>
    </View>
  );
}
