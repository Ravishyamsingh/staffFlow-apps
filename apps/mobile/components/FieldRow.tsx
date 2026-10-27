import { AlertCircle, CalendarDays, Check, ChefHat, Clock3, MapPin, MessageSquare, Tag, UsersRound } from "./icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "../src/theme";
import type { ParseField } from "../src/domain/types";

const icons = { date: CalendarDays, time: Clock3, location: MapPin, notes: MessageSquare, subcategory: Tag, count: UsersRound, role: ChefHat };

export function FieldRow({ field, value, flagged, onPress }: { field: ParseField; value: string; flagged: boolean; onPress: () => void }) {
  const Icon = icons[field];
  return <Pressable onPress={onPress} style={{ minHeight: 46, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 11, backgroundColor: flagged ? colors.amberTint : "transparent", flexDirection: "row", alignItems: "center", gap: 11 }}><Icon size={20} color={flagged ? colors.amberText : colors.textSecondary} /><Text style={{ flex: 1, color: flagged ? colors.amberText : colors.text, fontSize: 15, lineHeight: 20 }}>{value}</Text>{flagged ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#FDE8C1" }}><AlertCircle size={14} color={colors.amberText} /><Text style={{ color: colors.amberText, fontSize: 10, fontWeight: "800" }}>Please check</Text></View> : <Check size={18} color={colors.primaryTintStrong} />}</Pressable>;
}
