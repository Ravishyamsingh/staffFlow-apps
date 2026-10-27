import { useRouter } from "expo-router";
import { AlertCircle, ChefHat, ChevronDown, Minus, Plus, Send, UsersRound, X } from "../components/icons";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FieldRow } from "../components/FieldRow";
import { ScreenHeader } from "../components/ScreenHeader";
import { flaggedFields } from "../src/domain/parser";
import type { Booking, ParseField } from "../src/domain/types";
import { apiRequest } from "../src/lib/api";
import { useStaffFlowStore } from "../src/store/useStaffFlowStore";
import { colors, shared } from "../src/theme";

export default function ReviewScreen() {
  const router = useRouter();
  const draft = useStaffFlowStore((state) => state.draft);
  const updateBooking = useStaffFlowStore((state) => state.updateBooking);
  const resolveField = useStaffFlowStore((state) => state.resolveField);
  const saveDraft = useStaffFlowStore((state) => state.saveDraft);
  const loadMatches = useStaffFlowStore((state) => state.loadMatches);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ booking: Booking; field: ParseField } | null>(null);
  const [taxonomy, setTaxonomy] = useState({ locations: [] as string[], subcategories: [] as string[] });
  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<{ items: { name: string }[] }>("/locations"),
      apiRequest<{ items: { name: string }[] }>("/subcategories"),
    ]).then(([locations, subcategories]) => {
      if (active) setTaxonomy({ locations: locations.items.map((item) => item.name), subcategories: subcategories.items.map((item) => item.name) });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!draft) return null;
  const unresolved = draft.bookings.reduce((total, booking) => total + flaggedFields(booking).length, 0);
  const totalFlags = draft.bookings.reduce((total, booking) => total + flaggedFields(booking).length, 0);
  const canConfirm = reviewed && unresolved === 0;
  const openField = (booking: Booking, field: ParseField) => setEditing({ booking, field });
  const choose = (value: unknown) => {
    if (!editing) return;
    resolveField(editing.booking.id, editing.field, value);
    setEditing(null);
  };
  const dispatch = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await saveDraft();
      await loadMatches();
      router.push("/partners");
    } catch (reason) {
      Alert.alert("Unable to load matches", reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return <SafeAreaView style={shared.screen}><ScreenHeader title="Request Detail" back={() => router.back()} /><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 132, gap: 14 }}>
    <View style={[shared.card, { padding: 16 }]}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={shared.title}>Review parsed request</Text><View style={{ borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: unresolved ? colors.amberTint : colors.primaryTint }}><Text style={{ color: unresolved ? colors.amberText : colors.primaryDark, fontWeight: "700", fontSize: 12 }}>{unresolved ? `${Math.max(totalFlags - unresolved, 0)} of ${totalFlags} reviewed` : "All reviewed"}</Text></View></View><View style={{ height: 7, borderRadius: 4, backgroundColor: colors.surfaceContainer, marginTop: 14, overflow: "hidden" }}><View style={{ height: "100%", width: `${totalFlags ? Math.max(0, ((totalFlags - unresolved) / totalFlags) * 100) : 100}%`, backgroundColor: colors.primary, borderRadius: 4 }} /></View><View style={{ marginTop: 15, padding: 14, borderRadius: 12, backgroundColor: colors.primaryTint, flexDirection: "row", gap: 10 }}><AlertCircle size={20} color={colors.primaryDark} /><Text style={[shared.caption, { flex: 1, color: colors.primaryDark }]}>{draft.bookings.length} role{draft.bookings.length === 1 ? "" : "s"} extracted from your message. Resolve highlighted items before dispatching.</Text></View></View>
    {draft.bookings.map((booking, index) => <BookingCard key={booking.id} booking={booking} index={index} onField={openField} onCount={(delta) => updateBooking(booking.id, { count: Math.max(1, booking.count + delta), confidence: { ...booking.confidence, count: 1 } })} />)}
  </ScrollView><View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 18, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}><Pressable onPress={() => setReviewed((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 42 }}><View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: reviewed ? colors.primary : colors.border, backgroundColor: reviewed ? colors.primary : colors.surface, alignItems: "center", justifyContent: "center" }}>{reviewed ? <Text style={{ color: colors.surface, fontWeight: "800" }}>✓</Text> : null}</View><Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>I have reviewed all details</Text>{unresolved > 0 ? <View style={{ marginLeft: "auto", borderRadius: 999, backgroundColor: colors.redTint, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: colors.redText, fontSize: 11, fontWeight: "800" }}>{unresolved} flagged {unresolved === 1 ? "item" : "items"}</Text></View> : null}</Pressable><Pressable disabled={!canConfirm || busy} onPress={() => void dispatch()} style={[shared.primaryButton, { opacity: canConfirm && !busy ? 1 : 0.4, flexDirection: "row", gap: 8 }]}><Send size={19} color={colors.surface} /><Text style={shared.buttonText}>{busy ? "Loading live matches…" : "Review complete · Find partners"}</Text></Pressable></View>
    <EditModal editing={editing} onClose={() => setEditing(null)} onChoose={choose} locations={taxonomy.locations} subcategories={taxonomy.subcategories} />
  </SafeAreaView>;
}

function BookingCard({ booking, index, onField, onCount }: { booking: Booking; index: number; onField: (booking: Booking, field: ParseField) => void; onCount: (delta: number) => void }) {
  const flags = flaggedFields(booking);
  const date = booking.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "Date not specified";
  const time = booking.timeStart && booking.timeEnd ? `${formatTime(booking.timeStart)} – ${formatTime(booking.timeEnd)}` : "Shift time not specified";
  const roleLabel = booking.role === "helper" ? "Helper / Assistant" : booking.role === "cleaner" ? "Cleaner" : booking.role === "waiter" ? "Waiter" : booking.role === "other" ? "Staff member" : "Chef";
  return <View style={[shared.card, { padding: 16 }]}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" }}><ChefHat color={colors.primaryDark} size={23} /></View><Pressable onPress={() => onField(booking, "role")} style={{ flex: 1, minHeight: 44, justifyContent: "center" }}><Text style={[shared.heading, flags.includes("role") && { color: colors.amberText }]}>{roleLabel}</Text><Text style={[shared.caption, flags.includes("role") && { color: colors.amberText }]}> {flags.includes("role") ? "Tap to choose staff type" : booking.role === "helper" ? "Utility & Dish Support" : "Lead Station Staff"}</Text></Pressable><Pressable onPress={() => onField(booking, "subcategory")} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: flags.includes("subcategory") ? colors.amberTint : booking.subcategory ? colors.primaryTintStrong : colors.surfaceContainer, borderWidth: flags.includes("subcategory") ? 1 : 0, borderColor: colors.amber, flexDirection: "row", alignItems: "center", gap: 3 }}><Text style={{ color: flags.includes("subcategory") ? colors.amberText : colors.primaryDark, fontSize: 12, fontWeight: "700" }}>{booking.subcategory ?? "Choose type"}</Text><ChevronDown color={flags.includes("subcategory") ? colors.amberText : colors.primaryDark} size={15} /></Pressable></View><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}><View><Text style={{ color: flags.includes("count") ? colors.amberText : colors.text, fontSize: 15 }}>Required count</Text>{flags.includes("count") ? <Text style={{ color: colors.amberText, fontSize: 11, marginTop: 2 }}>Tap + or − to confirm</Text> : null}</View><View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}><Pressable onPress={() => onCount(-1)} style={[stepper, flags.includes("count") && { backgroundColor: colors.amberTint }]}><Minus color={flags.includes("count") ? colors.amberText : colors.text} size={18} /></Pressable><Text style={{ color: flags.includes("count") ? colors.amberText : colors.text, fontSize: 22, fontWeight: "700" }}>{booking.count}</Text><Pressable onPress={() => onCount(1)} style={[stepper, flags.includes("count") && { backgroundColor: colors.amberTint }]}><Plus color={flags.includes("count") ? colors.amberText : colors.text} size={18} /></Pressable></View></View><View style={{ marginTop: 8, gap: 3 }}><FieldRow field="date" value={date} flagged={flags.includes("date")} onPress={() => onField(booking, "date")} /><FieldRow field="time" value={time} flagged={flags.includes("time")} onPress={() => onField(booking, "time")} /><FieldRow field="location" value={booking.location ?? "Location not specified"} flagged={flags.includes("location")} onPress={() => onField(booking, "location")} /><FieldRow field="notes" value={booking.notes ?? "Add special notes (optional)"} flagged={false} onPress={() => onField(booking, "notes")} /></View>{flags.length > 0 ? <Text style={{ color: colors.amberText, fontSize: 11, marginTop: 10 }}>Booking {index + 1} needs your attention.</Text> : null}</View>;
}

const stepper = { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceContainer, alignItems: "center" as const, justifyContent: "center" as const };

function EditModal({ editing, onClose, onChoose, locations, subcategories }: { editing: { booking: Booking; field: ParseField } | null; onClose: () => void; onChoose: (value: unknown) => void; locations: string[]; subcategories: string[] }) {
  if (!editing) return null;
  const { field } = editing;
  const choices: { label: string; value: unknown }[] = field === "time" ? [{ label: "Dinner shift · 6:00 PM – 11:00 PM", value: { start: "18:00", end: "23:00" } }, { label: "Morning · 8:00 AM – 12:00 PM", value: { start: "08:00", end: "12:00" } }, { label: "Afternoon · 12:00 PM – 4:00 PM", value: { start: "12:00", end: "16:00" } }] : field === "date" ? dateChoices() : field === "location" ? locations.map((value) => ({ label: value, value })) : field === "subcategory" ? subcategories.map((value) => ({ label: value, value })) : field === "role" ? [{ label: "Chef", value: "chef" }, { label: "Waiter", value: "waiter" }, { label: "Cleaner", value: "cleaner" }, { label: "Helper / Assistant", value: "helper" }, { label: "Other staff", value: "other" }] : [];
  return <Modal transparent animationType="slide" visible onRequestClose={onClose}><View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(26,29,33,0.35)" }}><View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={shared.heading}>Update {field === "time" ? "shift time" : field}</Text><Pressable onPress={onClose}><X color={colors.textSecondary} size={22} /></Pressable></View>{field === "notes" ? <NotesEditor onSave={onChoose} initial={editing.booking.notes ?? ""} /> : (field === "location" || field === "subcategory") && choices.length === 0 ? <ValueEditor field={field} onSave={onChoose} initial={field === "location" ? editing.booking.location ?? "" : editing.booking.subcategory ?? ""} /> : <View style={{ gap: 10, marginTop: 18 }}>{choices.map((choice) => <Pressable key={choice.label} onPress={() => onChoose(choice.value)} style={{ padding: 15, borderRadius: 12, backgroundColor: colors.surfaceLow, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{choice.label}</Text><ChevronDown color={colors.primary} size={18} style={{ transform: [{ rotate: "-90deg" }] }} /></Pressable>)}</View>}</View></View></Modal>;
}

function NotesEditor({ onSave, initial }: { onSave: (value: string) => void; initial: string }) { const [value, setValue] = useState(initial); return <View style={{ marginTop: 18, gap: 12 }}><TextInput autoFocus multiline value={value} onChangeText={setValue} placeholder="e.g. Wok experience, dim sum service" placeholderTextColor={colors.textTertiary} style={{ minHeight: 88, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, textAlignVertical: "top" }} /><Pressable onPress={() => onSave(value)} style={shared.primaryButton}><Text style={shared.buttonText}>Save note</Text></Pressable></View>; }

function ValueEditor({ field, onSave, initial }: { field: "location" | "subcategory"; onSave: (value: string) => void; initial: string }) { const [value, setValue] = useState(initial); return <View style={{ marginTop: 18, gap: 12 }}><TextInput autoFocus value={value} onChangeText={setValue} placeholder={`Enter ${field}`} placeholderTextColor={colors.textTertiary} style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text }} /><Pressable disabled={!value.trim()} onPress={() => onSave(value.trim())} style={[shared.primaryButton, { opacity: value.trim() ? 1 : 0.45 }]}><Text style={shared.buttonText}>Save {field}</Text></Pressable></View>; }

function dateChoices() {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
  const saturday = addDays(today, daysUntilSaturday);
  return [{ label: `Today · ${formatDate(today)}`, value: dateKey(today) }, { label: `Tomorrow · ${formatDate(tomorrow)}`, value: dateKey(tomorrow) }, { label: `Saturday · ${formatDate(saturday)}`, value: dateKey(saturday) }];
}

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function addDays(date: Date, amount: number) { const result = new Date(date); result.setDate(result.getDate() + amount); return result; }
function formatDate(date: Date) { return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

function formatTime(time: string) { const [hourText, minute] = time.split(":"); const hour = Number(hourText); const suffix = hour >= 12 ? "PM" : "AM"; const display = hour % 12 || 12; return `${display}:${minute} ${suffix}`; }
