import { useRouter } from "expo-router";
import { Check, LockKeyhole, Phone } from "../components/icons";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "../components/BrandMark";
import { colors, shared } from "../src/theme";
import { useStaffFlowStore } from "../src/store/useStaffFlowStore";
import { sendOtp, verifyOtp } from "../src/lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useStaffFlowStore((state) => state.setSession);
  const [phone, setPhone] = useState("");
  const [session, setOtpSession] = useState("");
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const validPhone = /^\d{10}$/.test(phone);
  const canContinue = sent ? otp.length === 6 : validPhone;

  const continueLogin = async () => {
    if (!canContinue || busy) return;
    setBusy(true);
    try {
      const e164 = `+91${phone}`;
      if (!sent) {
        const response = await sendOtp(e164);
        setOtpSession(response.session);
        setSent(true);
      } else {
        const next = await verifyOtp(e164, session, otp);
        setSession(next);
        router.replace("/(tabs)");
      }
    } catch (reason) {
      Alert.alert("Unable to sign in", reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return <SafeAreaView style={shared.screen}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={shared.flex}><View style={{ flex: 1, padding: 24, justifyContent: "center" }}><View style={{ alignItems: "center", marginBottom: 28 }}><BrandMark compact /><Text style={[shared.title, { marginTop: 20, fontSize: 24, textAlign: "center" }]}>Welcome to StaffFlow</Text><Text style={[shared.caption, { marginTop: 8, textAlign: "center" }]}>Sign in with your verified mobile number</Text></View>{!sent ? <View style={{ flexDirection: "row", alignItems: "center", minHeight: 50, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, gap: 10 }}><Phone size={19} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontWeight: "600" }}>+91</Text><TextInput value={phone} onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 10))} keyboardType="phone-pad" placeholder="Enter your mobile number" placeholderTextColor={colors.textTertiary} style={{ flex: 1, color: colors.text, fontSize: 15 }} /></View> : <View style={{ minHeight: 50, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "center", gap: 10 }}><LockKeyhole size={18} color={colors.primary} /><Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>+91 {phone}</Text><Pressable onPress={() => { setSent(false); setOtp(""); setOtpSession(""); }}><Text style={{ color: colors.primary, fontWeight: "700" }}>Edit</Text></Pressable></View>}{sent ? <View style={{ marginTop: 18 }}><Text style={shared.label}>Verification code</Text><TextInput autoFocus value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="123456" placeholderTextColor={colors.textTertiary} style={{ marginTop: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, height: 58, textAlign: "center", letterSpacing: 10, fontSize: 24, color: colors.text }} /><Text style={[shared.caption, { marginTop: 8, textAlign: "center" }]}>Enter the six-digit code sent by StaffFlow</Text></View> : null}<Pressable disabled={!canContinue || busy} onPress={() => void continueLogin()} style={[shared.primaryButton, { marginTop: 18, opacity: canContinue && !busy ? 1 : 0.4 }]}><Text style={shared.buttonText}>{busy ? "Please wait…" : sent ? "Verify & Continue" : "Send OTP"}</Text></Pressable><View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 22 }}><Check size={14} color={colors.textTertiary} /><Text style={{ color: colors.textTertiary, fontSize: 12 }}>Secured by AWS Cognito</Text></View></View></KeyboardAvoidingView></SafeAreaView>;
}
