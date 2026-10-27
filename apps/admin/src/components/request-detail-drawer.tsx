"use client";

import { AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, FileText, MapPin, MessageSquare, RefreshCw, ShieldAlert, Star, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { apiRequest, useApiQuery } from "../lib/api";
import type { AdminRequest, PartnerMatch } from "../lib/admin-data";
import { formatSummary } from "../lib/admin-data";

export function RequestDetailDrawer({ request, onClose, onChanged }: { request: AdminRequest; onClose: () => void; onChanged?: () => void }) {
  const matches = useApiQuery<{ matches: PartnerMatch[] }>(`/requests/${request.id}/matches`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = async (action: "assign" | "complete" | "cancel") => {
    setBusy(true);
    setError("");
    try {
      if (action === "assign") {
        const partner = matches.data?.matches[0];
        if (!partner) throw new Error("No partner match is available");
        await apiRequest(`/requests/${request.id}/assign`, { method: "PUT", body: { partnerId: partner.id } });
      } else {
        await apiRequest(`/requests/${request.id}/${action}`, { method: "PUT", body: {} });
      }
      onChanged?.();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update request");
    } finally {
      setBusy(false);
    }
  };

  return <><div className="drawer-scrim" onClick={onClose} /><aside className="drawer" aria-label="Request detail"><header className="drawer-header"><div className="drawer-title"><h2>{request.id}</h2><span className={`status ${request.status}`}>{request.status}</span></div><button className="icon-button" onClick={onClose} aria-label="Close request detail"><X size={20} /></button></header><div className="drawer-body"><div className="section-label"><span><MessageSquare size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Verbatim owner request</span><span>{request.ownerEmail ?? request.ownerId}</span></div><div className="quote">“{request.rawInput}”<div style={{ marginTop: 9, fontStyle: "normal", color: "#6b7280", fontSize: 11 }}>Created {new Date(request.createdAt).toLocaleString()}</div></div><div className="section-label"><span>Parsed booking requirements</span><span style={{ color: "var(--primary-dark)" }}>{request.bookings.length} role{request.bookings.length === 1 ? "" : "s"}</span></div>{request.bookings.length ? request.bookings.map((booking) => <Booking key={booking.id} booking={booking} />) : <div className="quote">No booking details returned by the API.</div>}<div className="section-label"><span><ShieldAlert size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Parser confidence</span><span>{request.uncertainFields} uncertain field{request.uncertainFields === 1 ? "" : "s"}</span></div><div className="confidence-card">{request.bookings.flatMap((booking) => Object.entries(booking.confidence).map(([label, value]) => [booking.id, label, Math.round(Number(value) * 100)] as const)).slice(0, 12).map(([bookingId, label, value]) => <div className={`confidence-row ${value < 50 ? "low" : value < 80 ? "mid" : ""}`} key={`${bookingId}-${label}`}><div><div className="confidence-head"><span>{label}</span><strong>{value}%</strong></div><div className="confidence-bar"><span style={{ width: `${value}%` }} /></div></div></div>)}</div><div className="section-label"><span>Live match candidates</span><span>{matches.loading ? "Loading…" : `${matches.data?.matches.length ?? 0} found`}</span></div>{matches.error ? <div className="error-banner">{matches.error.message}</div> : null}{matches.data?.matches.slice(0, 3).map((match) => <div className="match-card" key={match.id}><div className="match-avatar">{initials(match.name)}</div><div style={{ flex: 1 }}><strong style={{ fontSize: 15 }}>{match.name}</strong><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{match.subcategories.join(" · ")}</div><div style={{ color: "var(--primary-dark)", fontSize: 11, marginTop: 4 }}>{match.reason || "Backend score"}</div></div><div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12 }}><Star size={14} color="var(--primary-dark)" fill="var(--primary-dark)" /> {(match.score * 100).toFixed(0)}%</div></div>)}<div className="section-label"><span>Request timeline</span></div><Timeline status={request.status} /></div><footer className="drawer-footer">{error ? <div className="error-banner">{error}</div> : null}{request.status !== "cancelled" && request.status !== "completed" ? <button disabled={busy || !matches.data?.matches[0]} className="button secondary" onClick={() => update("assign")}><RefreshCw size={15} /> Assign top match</button> : null}{request.status === "confirmed" || request.status === "matched" ? <button disabled={busy} className="button primary" onClick={() => update("complete")}><Check size={15} /> Complete</button> : null}{request.status !== "cancelled" && request.status !== "completed" ? <button disabled={busy} className="button danger" onClick={() => update("cancel")}><AlertTriangle size={15} /> Cancel request</button> : null}<button className="button outline full" onClick={onClose}><FileText size={15} /> Close</button></footer></aside></>;
}

function Booking({ booking }: { booking: AdminRequest["bookings"][number] }) { return <div className="booking-box"><div className="booking-head"><span>{booking.subcategory ?? booking.role}</span><div className="booking-pills"><span className="small-pill">×{booking.count}</span>{booking.confidence.time < 0.75 ? <span className="small-pill">Review time</span> : null}</div></div><div className="field-grid"><div className="field-cell"><CalendarDays size={15} /> {booking.date ?? "Date pending"}</div><div className="field-cell"><Clock3 size={15} /> {booking.timeStart && booking.timeEnd ? `${booking.timeStart} – ${booking.timeEnd}` : "Time pending"}</div><div className="field-cell"><MapPin size={15} /> {booking.location ?? "Location pending"}</div></div>{booking.notes ? <div className="muted" style={{ marginTop: 9, fontSize: 12 }}>{booking.notes}</div> : null}</div>; }
function Timeline({ status }: { status: AdminRequest["status"] }) { const steps = ["Created", "Parsed", "Reviewed", "Matched", "Confirmed", "Completed"]; const current = Math.max(0, steps.findIndex((step) => step.toLowerCase() === status)); return <div style={{ display: "grid", gap: 11, padding: "2px 0 2px 3px" }}>{steps.map((label, index) => <div key={label} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 12, color: index <= current ? "var(--primary-dark)" : "var(--muted)" }}><CheckCircle2 size={15} color={index <= current ? "var(--primary)" : "#a4b0b1"} /><span>{label}</span>{index < steps.length - 1 ? <ChevronRight size={13} style={{ marginLeft: "auto" }} /> : null}</div>)}</div>; }
function initials(value: string) { return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
