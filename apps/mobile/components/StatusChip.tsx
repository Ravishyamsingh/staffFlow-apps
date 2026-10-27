import { Text, View } from "react-native";
import { colors } from "../src/theme";
import type { RequestStatus } from "../src/domain/types";

export function StatusChip({ status }: { status: RequestStatus }) {
  const palette = status === "confirmed" ? { bg: colors.greenTint, fg: colors.greenText, dot: colors.green } : status === "pending" ? { bg: colors.amberTint, fg: colors.amberText, dot: colors.amber } : status === "cancelled" ? { bg: colors.redTint, fg: colors.redText, dot: colors.red } : { bg: colors.surfaceContainer, fg: colors.textSecondary, dot: colors.textSecondary };
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: palette.bg }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.dot }} /><Text style={{ color: palette.fg, fontSize: 12, fontWeight: "700" }}>{status[0].toUpperCase() + status.slice(1)}</Text></View>;
}
