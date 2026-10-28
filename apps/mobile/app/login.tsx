import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Google, LockKeyhole, Phone } from "../components/icons";
import { BrandMark } from "../components/BrandMark";
import { signInWithGoogle, sendOtp, verifyOtp } from "../src/lib/auth";
import { colors, shared } from "../src/theme";
import { useStaffFlowStore } from "../src/store/useStaffFlowStore";

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

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await signInWithGoogle();
      if (next) {
        setSession(next);
        router.replace("/(tabs)");
      }
    } catch (reason) {
      Alert.alert("Unable to sign in with Google", reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

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

  const editPhone = () => {
    setSent(false);
    setOtp("");
    setOtpSession("");
  };

  return (
    <SafeAreaView style={shared.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={shared.flex}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <View style={{ alignItems: "center", marginTop: 12 }}>
              <BrandMark compact />
              <Text style={[shared.title, { marginTop: 16, fontSize: 25, textAlign: "center" }]}>Welcome to StaffFlow</Text>
              <Text style={[shared.caption, { marginTop: 4, textAlign: "center" }]}>Sign in to manage your restaurant staff requests</Text>
            </View>

            <View style={{ marginTop: 28 }}>
              {!sent ? (
                <>
                  <Pressable disabled={busy} onPress={() => void handleGoogleSignIn()} style={[shared.secondaryButton, { minHeight: 52, backgroundColor: colors.surface, borderColor: colors.border, opacity: busy ? 0.55 : 1 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Google size={20} color="#4285F4" />
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Continue with Google</Text>
                    </View>
                  </Pressable>

                  <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 22 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    <Text style={{ marginHorizontal: 12, paddingHorizontal: 8, color: colors.textTertiary, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.7 }}>or with phone OTP</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  </View>
                </>
              ) : null}

              <View style={[shared.card, { padding: 16 }]}>
                {!sent ? (
                  <>
                    <Text style={[shared.label, { marginBottom: 8 }]}>Mobile phone number</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 50, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, gap: 10 }}>
                      <Phone size={19} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>+91</Text>
                      <TextInput value={phone} onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 10))} keyboardType="phone-pad" placeholder="Enter 10-digit mobile number" placeholderTextColor={colors.textTertiary} style={{ flex: 1, color: colors.text, fontSize: 15 }} />
                    </View>
                    <Text style={[shared.caption, { marginTop: 6, fontSize: 11 }]}>Use your registered restaurant owner number</Text>
                  </>
                ) : (
                  <View style={{ minHeight: 50, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <LockKeyhole size={18} color={colors.primary} />
                    <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>+91 {phone}</Text>
                    <Pressable onPress={editPhone}><Text style={{ color: colors.primary, fontWeight: "700" }}>Edit</Text></Pressable>
                  </View>
                )}

                {sent ? (
                  <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                    <Text style={shared.label}>Verification code</Text>
                    <TextInput autoFocus value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="123456" placeholderTextColor={colors.textTertiary} style={{ marginTop: 8, backgroundColor: colors.primaryTint, borderWidth: 2, borderColor: colors.primary, borderRadius: 12, height: 58, textAlign: "center", letterSpacing: 10, fontSize: 24, fontWeight: "700", color: colors.primary }} />
                    <Text style={[shared.caption, { marginTop: 8, textAlign: "center" }]}>Enter the six-digit code sent by StaffFlow</Text>
                  </View>
                ) : null}

                <Pressable disabled={!canContinue || busy} onPress={() => void continueLogin()} style={[shared.primaryButton, { marginTop: 18, opacity: canContinue && !busy ? 1 : 0.4 }]}>
                  <Text style={shared.buttonText}>{busy ? "Please wait…" : sent ? "Verify & Continue" : "Send OTP"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ alignItems: "center", marginTop: 24 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" }}>By continuing, you agree to our <Text style={{ color: colors.primary, fontWeight: "700" }}>Terms of Service</Text> and <Text style={{ color: colors.primary, fontWeight: "700" }}>Privacy Policy</Text>.</Text>
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10 }}>
                <Check size={14} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Secure by StaffFlow</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
