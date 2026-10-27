import { CirclePlus, ListChecks, Store } from "./icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "../src/theme";

export function BottomTabs({ active, onNew, onRequests }: { active: "new" | "requests"; onNew: () => void; onRequests: () => void }) {
  return (
    <View style={{ height: 76, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "#EEF0F2", flexDirection: "row", paddingBottom: 8 }}>
      <Tab icon={<CirclePlus size={23} color={active === "new" ? colors.primary : colors.textSecondary} />} label="New Request" selected={active === "new"} onPress={onNew} />
      <Tab icon={<ListChecks size={23} color={active === "requests" ? colors.primary : colors.textSecondary} />} label="My Requests" selected={active === "requests"} onPress={onRequests} />
      <Tab icon={<Store size={23} color={colors.textSecondary} />} label="Restaurant" selected={false} onPress={() => undefined} />
    </View>
  );
}

function Tab({ icon, label, selected, onPress }: { icon: React.ReactNode; label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}><View>{icon}</View><Text style={{ color: selected ? colors.primaryDark : colors.text, fontSize: 12, fontWeight: selected ? "700" : "600" }}>{label}</Text></Pressable>;
}
