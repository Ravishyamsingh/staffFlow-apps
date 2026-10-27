import { useRouter } from "expo-router";
import { CalendarDays, Check, Clock3, Handshake, MapPin, Pencil, RefreshCw, UsersRound } from "../../components/icons";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabs } from "../../components/BottomTabs";
import { StatusChip } from "../../components/StatusChip";
import { useStaffFlowStore } from "../../src/store/useStaffFlowStore";
import { colors, shared } from "../../src/theme";
import type { RequestRecord } from "../../src/domain/types";

export default function MyRequestsScreen() {
  const router = useRouter();
  const requests = useStaffFlowStore((state) => state.requests);
  const loadRequests = useStaffFlowStore((state) => state.loadRequests);
  const setRequestRecord = useStaffFlowStore((state) => state.setRequestRecord);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const openRequest = (request: RequestRecord) => {
    if (["new", "parsed", "reviewed"].includes(request.status)) {
      setRequestRecord(request);
      router.push("/review");
      return;
    }
    const partner = request.selectedPartners ? Object.values(request.selectedPartners).map((item) => item.name).join(", ") : request.selectedPartnerName ?? "not assigned";
    Alert.alert(request.id, `${request.status[0].toUpperCase()}${request.status.slice(1)}\nPartner: ${partner}`);
  };
  useEffect(() => { void loadRequests().catch(() => undefined).finally(() => setLoading(false)); }, [loadRequests]);
  const visibleRequests = requests.filter((request) => filter === "all" || (filter === "active" ? !["completed", "cancelled"].includes(request.status) : request.status === "completed"));
  return <SafeAreaView style={shared.screen}>
    <View style={{ height: 64, paddingHorizontal: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ fontSize: 20, color: colors.text, fontWeight: "700" }}>StaffFlow</Text><Text style={{ fontSize: 10, color: colors.primaryDark, backgroundColor: colors.primaryTintStrong, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, fontWeight: "800" }}>DELHI OPS</Text></View></View><UsersRound color={colors.primary} size={28} /></View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}><View><Text style={shared.title}>My Requests</Text><Text style={[shared.body, { color: colors.textSecondary, marginTop: 2 }]}>Live operational shift dispatches</Text></View><Pressable onPress={() => void loadRequests()} style={{ borderRadius: 999, backgroundColor: colors.primaryTint, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>↻ Refresh</Text></Pressable></View><View style={{ height: 48, borderRadius: 14, backgroundColor: colors.surfaceContainer, padding: 4, flexDirection: "row" }}><FilterTab label={`All (${requests.length})`} active={filter === "all"} onPress={() => setFilter("all")} /><FilterTab label={`Active (${requests.filter((request) => !["completed", "cancelled"].includes(request.status)).length})`} active={filter === "active"} onPress={() => setFilter("active")} /><FilterTab label={`Completed (${requests.filter((request) => request.status === "completed").length})`} active={filter === "completed"} onPress={() => setFilter("completed")} /></View>{loading ? <Text style={shared.caption}>Loading requests from StaffFlow…</Text> : visibleRequests.map((request) => <RequestCard key={request.id} request={request} onOpen={openRequest} />)}{!loading && visibleRequests.length === 0 ? <View style={[shared.card, { padding: 28, alignItems: "center" }]}><Text style={shared.heading}>{requests.length ? "No requests in this filter." : "No requests yet — let’s get started!"}</Text>{!requests.length ? <Pressable onPress={() => router.push("/(tabs)")} style={[shared.primaryButton, { marginTop: 16, paddingHorizontal: 24 }]}><Text style={shared.buttonText}>New Request</Text></Pressable> : null}</View> : null}</ScrollView>
    <BottomTabs active="requests" onNew={() => router.push("/(tabs)")} onRequests={() => undefined} />
  </SafeAreaView>;
}

function FilterTab({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={{ flex: 1, borderRadius: 11, backgroundColor: active ? colors.surface : "transparent", alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: active ? "700" : "600" }}>{label}</Text></Pressable>; }

function RequestCard({ request, onOpen }: { request: RequestRecord; onOpen: (request: RequestRecord) => void }) {
  const booking = request.bookings[0];
  const title = request.bookings.length > 1 ? request.bookings.map((item) => `${item.count} ${item.subcategory ?? item.role}`).join(" + ") : booking ? `${booking.count} ${booking.subcategory ?? booking.role}` : request.rawInput;
  const location = booking?.location ?? "Location pending";
  const partnerNames = request.selectedPartners ? Object.values(request.selectedPartners).map((partner) => partner.name).join(" + ") : request.selectedPartnerName;
  const dateText = booking?.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "Today";
  return <View style={[shared.card, { padding: 16 }]}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Handshake size={16} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700", letterSpacing: 0.7 }}>STAFFFLOW REQUEST</Text></View><StatusChip status={request.status} /></View><Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontWeight: "600", marginTop: 8 }}>{title}</Text><View style={{ backgroundColor: colors.surfaceLow, borderRadius: 12, padding: 12, marginTop: 14, gap: 9 }}><Meta icon={<Clock3 size={18} color={colors.primaryDark} />} text={`${dateText} · ${booking?.timeStart ?? "Time pending"} – ${booking?.timeEnd ?? "Time pending"}`} /><Meta icon={<UsersRound size={18} color={colors.primaryDark} />} text={partnerNames ?? "Awaiting partner assignment"} /><Meta icon={<MapPin size={18} color={colors.primaryDark} />} text={location} /></View><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}><View style={{ backgroundColor: colors.primaryTintStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}><Text style={{ color: colors.primaryDark, fontWeight: "700", fontSize: 12 }}>{request.id}</Text></View><Pressable onPress={() => onOpen(request)} style={[shared.secondaryButton, { minHeight: 38, paddingHorizontal: 14, borderWidth: 0 }]}>{["new", "parsed", "reviewed", "pending"].includes(request.status) ? <><Pencil size={15} color={colors.primaryDark} /><Text style={shared.secondaryButtonText}> Edit Shift</Text></> : <><RefreshCw size={15} color={colors.primaryDark} /><Text style={shared.secondaryButtonText}> Manage Shift</Text></>}</Pressable></View></View>;
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) { return <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 20 }}>{icon}</View><Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 14 }}>{text}</Text></View>; }
