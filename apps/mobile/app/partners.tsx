import { useRouter } from "expo-router";
import { Filter, ShieldCheck } from "../components/icons";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { PartnerCard } from "../components/PartnerCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, shared } from "../src/theme";
import { useStaffFlowStore } from "../src/store/useStaffFlowStore";

export default function PartnersScreen() {
  const router = useRouter();
  const draft = useStaffFlowStore((state) => state.draft);
  const groups = useStaffFlowStore((state) => state.matchGroups);
  const selectedPartners = useStaffFlowStore((state) => state.selectedPartners);
  const selectPartner = useStaffFlowStore((state) => state.selectPartner);
  const confirmRequest = useStaffFlowStore((state) => state.confirmRequest);
  const [busy, setBusy] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const allSelected = Boolean(draft && draft.bookings.length > 0 && draft.bookings.every((booking) => selectedPartners[booking.id]));

  if (!draft) return null;
  return <SafeAreaView style={shared.screen}>
    <ScreenHeader title="Request Detail" back={() => router.back()} />
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><ShieldCheck color={colors.primary} size={19} /><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 }}>LIVE ALLOCATION ENGINE</Text></View><Pressable accessibilityLabel="Filter matches" onPress={() => setVerifiedOnly((value) => !value)} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: verifiedOnly ? colors.primaryTint : colors.surface, alignItems: "center", justifyContent: "center" }}><Filter color={verifiedOnly ? colors.primaryDark : colors.text} size={19} /></Pressable></View>
      <View style={{ padding: 15, borderRadius: 14, backgroundColor: colors.surfaceLow, flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryTintStrong, alignItems: "center", justifyContent: "center" }}><ShieldCheck size={19} color={colors.primaryDark} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{draft.bookings.length === 1 ? "Select a partner for this booking" : `Select a partner for each of the ${draft.bookings.length} bookings`}</Text><Text style={shared.caption}>Score ranked from subcategory, distance, availability & reliability</Text></View></View>
      {groups.map((group, index) => {
        const booking = draft.bookings.find((item) => item.id === group.bookingId);
        if (!booking) return null;
        const selected = selectedPartners[booking.id];
        const visibleMatches = group.matches.filter((match) => !verifiedOnly || match.verified);
        return <View key={group.bookingId} style={{ gap: 10 }}><View style={[shared.card, { padding: 14, gap: 3 }]}><Text style={shared.label}>Booking {index + 1}</Text><Text style={shared.heading}>{booking.count} × {booking.subcategory ?? booking.role}</Text><Text style={shared.caption}>{booking.location ?? "Location pending"} · {booking.date ?? "Date pending"}</Text>{selected ? <Text style={{ color: colors.greenText, fontSize: 12, fontWeight: "700", marginTop: 4 }}>Selected: {selected.name}</Text> : null}</View>{visibleMatches.map((match, matchIndex) => <PartnerCard key={`${group.bookingId}-${match.id}`} match={{ ...match, rank: matchIndex + 1 }} selected={selected?.id === match.id} onSelect={() => selectPartner(booking.id, match)} />)}{visibleMatches.length === 0 ? <Text style={shared.caption}>No verified matches returned for this booking.</Text> : null}</View>;
      })}
      <View style={{ padding: 14, borderRadius: 13, backgroundColor: colors.surfaceLow, flexDirection: "row", gap: 10 }}><ShieldCheck color={colors.primary} size={19} /><Text style={[shared.caption, { flex: 1, color: colors.text }]}>Choose one verified partner for every role before dispatching.</Text></View>
    </ScrollView>
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}><Pressable disabled={!allSelected || busy} onPress={async () => { setBusy(true); try { const result = await confirmRequest(); if (result) router.replace("/confirmation"); } catch (reason) { Alert.alert("Unable to confirm request", reason instanceof Error ? reason.message : "Please try again."); } finally { setBusy(false); } }} style={[shared.primaryButton, { opacity: allSelected && !busy ? 1 : 0.4 }]}><Text style={shared.buttonText}>{busy ? "Confirming…" : allSelected ? "Confirm selected partners" : "Select all partners to continue"}</Text></Pressable></View>
  </SafeAreaView>;
}
