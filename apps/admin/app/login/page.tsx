"use client";

import { ArrowLeft, CheckCircle2, Eye, EyeOff, Grid2X2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAdminAuth } from "../../src/components/admin-auth";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, resetPassword } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start password reset");
    } finally {
      setLoading(false);
    }
  };

  return <main className="login-page">
    <section className="login-brand">
      <div className="login-cluster"><span className="live-dot" /> STAFFFLOW OPERATIONS <span className="version">COGNITO SECURED</span></div>
      <div className="login-brand-core"><div className="brand-mark large"><Grid2X2 size={38} /></div><h1>StaffFlow Admin</h1><p>Operations Command Centre</p><div className="cluster-pill"><span>Delhi NCR Operations:</span> secure live workforce management</div></div>
      <div className="login-features"><Feature text="Monitor authenticated staff requests" /><Feature text="Manage partners and dispatch status" /><Feature text="Review parsing and matching telemetry" /></div>
    </section>
    <section className="login-form-panel">
      <div className="login-form-wrap">
        {sent ? <div className="auth-state centered"><div className="success-icon"><CheckCircle2 size={30} /></div><h2>Reset email sent</h2><p>Check the inbox for <strong>{email}</strong>.</p><button className="button primary wide" onClick={() => { setSent(false); setForgot(false); }}>Back to sign in</button></div> : forgot ? <div className="auth-state"><button className="back-link" onClick={() => setForgot(false)}><ArrowLeft size={15} /> Back to sign in</button><h2>Reset your password</h2><p>Enter your Cognito username or email address.</p>{error ? <ErrorBanner message={error} /> : null}<form onSubmit={submitReset} className="auth-form"><Field label="Email address" icon={<Mail size={16} />}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></Field><button disabled={loading} className="button primary wide" type="submit">{loading ? "Sending…" : "Send reset email"}</button></form></div> : <><div className="login-form-heading"><h2>Welcome back</h2><p>Sign in with your StaffFlow admin account.</p></div>{error ? <ErrorBanner message={error} /> : null}<form onSubmit={submit} className="auth-form"><Field label="Email address" icon={<Mail size={16} />}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="email" /></Field><Field label="Password" icon={<LockKeyhole size={16} />}><div className="password-field"><input required minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field><div className="remember-row"><label><input type="checkbox" defaultChecked /> Keep me signed in</label><button type="button" onClick={() => setForgot(true)}>Forgot password?</button></div><button disabled={loading || !email || !password} className="button primary wide" type="submit">{loading ? "Signing in…" : "Sign in securely"}</button></form><div className="or-divider"><span>COGNITO</span></div><div className="auth-note"><ShieldCheck size={17} /><span>Your session is issued by AWS Cognito and sent to the StaffFlow API as a bearer token.</span></div></>}</div>
      <p className="login-footer">StaffFlow Operations Platform • Secure Cognito authentication</p>
    </section>
  </main>;
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) { return <label className="login-field"><span>{label}</span><div className="login-input-wrap">{icon}{children}</div></label>; }
function Feature({ text }: { text: string }) { return <div className="feature"><span className="feature-dot">◉</span><span>{text}</span></div>; }
function ErrorBanner({ message }: { message: string }) { return <div className="error-banner"><ShieldCheck size={17} /><span>{message}</span></div>; }
