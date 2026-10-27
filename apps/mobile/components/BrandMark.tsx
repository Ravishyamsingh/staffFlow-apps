import { ChefHat, Utensils } from "./icons";
import { View } from "react-native";
import { colors } from "../src/theme";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 46 : 72;
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: size * 1.8, height: size }}>
      <Utensils color={colors.primary} size={compact ? 20 : 28} style={{ position: "absolute", left: 0, transform: [{ rotate: "-18deg" }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}>
        <ChefHat color={colors.primary} size={compact ? 26 : 40} strokeWidth={2.2} />
      </View>
      <Utensils color={colors.primary} size={compact ? 20 : 28} style={{ position: "absolute", right: 0, transform: [{ rotate: "18deg" }] }} />
    </View>
  );
}
