"use client";

import { Bell, Bot, Building2, ChevronRight, CircleHelp, Clock3, Grid2X2, Handshake, LayoutDashboard, MapPin, Menu, Search, Settings, SlidersHorizontal, Tag, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminAuth } from "./admin-auth";
import { useApiQuery } from "../lib/api";

const sections = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  { title: "Operations", items: [{ label: "Live Requests", href: "/requests/live", icon: RadioIcon }, { label: "Request History", href: "/requests/history", icon: Clock3 }] },
  { title: "Database", items: [{ label: "Partners", href: "/partners", icon: Handshake }, { label: "Subcategories", href: "/subcategories", icon: Tag }, { label: "Locations", href: "/locations", icon: MapPin }] },
  { title: "System", items: [{ label: "AI Parse Log", href: "/ai-parse-log", icon: Bot }, { label: "Scoring Config", href: "/scoring-config", icon: SlidersHorizontal }, { label: "Settings", href: "/settings", icon: Settings }] },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAdminAuth();
  const profile = useApiQuery<{ user?: { email?: string; username?: string; groups?: string[] } }>("/me");
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(false);
  const identity = profile.data?.user?.email ?? profile.data?.user?.username ?? "Admin";

  return <div className="admin-shell">
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div>
        <div className="brand"><div className="brand-mark"><Grid2X2 size={20} /></div><div className="brand-copy"><div className="brand-wordmark">StaffFlow</div><div className="brand-subtitle">Admin Ops</div></div></div>
        <nav className="nav">{sections.map((section) => <div key={section.title}><div className="nav-section">{section.title}</div>{section.items.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); const Icon = item.icon; return <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`} title={collapsed ? item.label : undefined}><Icon size={18} /><span className="nav-label">{item.label}</span></Link>; })}</div>)}</nav>
      </div>
      <div className="workspace"><span className="workspace-dot" /><div className="workspace-copy"><div className="workspace-title">Live API workspace</div><div className="workspace-status">Cognito authenticated</div></div></div>
    </aside>
    <div className={`main ${collapsed ? "collapsed" : ""}`}>
      <header className="topbar"><div className="topbar-left"><button className="icon-button" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle sidebar"><Menu size={19} /></button><div className="breadcrumbs"><Building2 size={16} /><span>Operations</span><ChevronRight size={14} /><strong>StaffFlow Admin Console</strong></div></div><div className="topbar-right"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests, partners, logs..." /><span className="shortcut">⌘ K</span></label><button className="icon-button" aria-label="Notifications" onClick={() => setNotifications((value) => !value)}><Bell size={19} />{notifications ? <span className="nav-count" style={{ position: "absolute", margin: "-22px 0 0 20px" }}>!</span> : null}</button><div style={{ width: 1, height: 24, background: "#e1e5e7" }} /><button className="user-summary" onClick={() => { signOut(); router.replace("/login"); }} title="Sign out"><div className="avatar">{initials(identity)}</div><div><div className="user-name">{identity}</div><div className="user-role">{profile.data?.user?.groups?.join(" / ") || "Operations"}</div></div></button></div></header>
      {notifications ? <div style={{ position: "fixed", top: 58, right: 26, zIndex: 25, width: 280, padding: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 12px 30px rgba(16,24,40,.12)" }}><div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>Notifications<button className="icon-button" onClick={() => setNotifications(false)}><X size={15} /></button></div><p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>Notifications are delivered by the live backend event stream.</p></div> : null}
      {children}
    </div>
  </div>;
}

function RadioIcon(props: React.ComponentProps<typeof CircleHelp>) { return <CircleHelp {...props} />; }
function initials(value: string) { return value.split(/[\s@._-]+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
