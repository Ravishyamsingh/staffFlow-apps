"use client";

import { CalendarDays, Download, GripVertical, MapPin, RefreshCw, Search, SlidersHorizontal, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { RequestDetailDrawer } from "../../../../src/components/request-detail-drawer";
import { apiRequest, useApiQuery } from "../../../../src/lib/api";
import { formatSummary, labelForStatus, type AdminRequest, type RequestStatus } from "../../../../src/lib/admin-data";

const columns: [RequestStatus, string, string][] = [["new", "New", "Raw inbound stream"], ["parsed", "Parsed", "Awaiting review"], ["reviewed", "Owner Reviewed", "Validated"], ["matched", "Matched", "Partner assigned"], ["completed", "Completed", "Settled and archived"]];

export default function LiveRequestsPage() {
  const live = useApiQuery<{ requests: AdminRequest[] }>("/requests?limit=1000");
  const [selected, setSelected] = useState<AdminRequest | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dragged, setDragged] = useState<AdminRequest | null>(null);
  const [actionError, setActionError] = useState("");
  const requests = live.data?.requests ?? [];
  const dates = useMemo(() => [...new Set(requests.flatMap((request) => request.bookings.map((booking) => booking.date).filter((date): date is string => Boolean(date))))].sort(), [requests]);
  const roles = useMemo(() => [...new Set(requests.flatMap((request) => request.bookings.map((booking) => booking.role)))].sort(), [requests]);
  const locations = useMemo(() => [...new Set(requests.flatMap((request) => request.bookings.map((booking) => booking.location).filter((location): location is string => Boolean(location))))].sort(), [requests]);
  const board = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    const filtered = requests.filter((request) => request.bookings.some((booking) => (!dateFilter || booking.date === dateFilter) && (!roleFilter || booking.role === roleFilter) && (!locationFilter || booking.location === locationFilter)) && `${request.id} ${request.ownerEmail ?? request.ownerId} ${request.rawInput}`.toLowerCase().includes(normalizedSearch));
    return Object.fromEntries(columns.map(([key]) => [key, filtered.filter((request) => request.status === key)])) as Record<RequestStatus, AdminRequest[]>;
  }, [dateFilter, locationFilter, requests, roleFilter, search]);
  const drop = async (target: RequestStatus) => {
    if (!dragged || dragged.status === target) return;
    setActionError("");
    try {
      if (target === "completed") await apiRequest(`/requests/${dragged.id}/complete`, { method: "PUT", body: {} });
      else if (target === "parsed" || target === "reviewed") await apiRequest(`/requests/${dragged.id}`, { method: "PATCH", body: { status: target } });
      else throw new Error("Use the request drawer to assign a partner before moving to Matched.");
      live.reload?.();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to update request");
    } finally {
      setDragged(null);
    }
  };
  return <main className="page"><div className="page-header"><div><div className="page-kicker" style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, display: "inline-block", borderRadius: "50%", background: "#35d399" }} /> Live API request stream</div><h1 className="page-title">Live Requests</h1><p className="page-subtitle">Track requests returned by the authenticated operations API.</p></div><div className="header-actions"><span className="filter-control">{requests.length} records loaded</span><button className="button outline" onClick={live.reload}><RefreshCw size={15} /> Refresh</button><button className="button outline" onClick={() => downloadRequests(Object.values(board).flat())}><Download size={15} /> Export CSV</button></div></div>{actionError ? <div className="error-banner">{actionError}</div> : null}<div className="card toolbar"><label className="filter-control"><CalendarDays size={15} /><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="">All dates</option>{dates.map((date) => <option key={date} value={date}>{date}</option>)}</select></label><label className="filter-control"><UsersRound size={15} /><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label className="filter-control"><MapPin size={15} /><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="">All locations</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label><button className="filter-control" onClick={() => { setDateFilter(""); setRoleFilter(""); setLocationFilter(""); setSearch(""); }}><SlidersHorizontal size={15} /> Clear filters</button><div style={{ flexBasis: "100%", height: 0 }} /><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", top: 12, left: 12, color: "var(--muted)" }} /><input className="filter-input" style={{ paddingLeft: 35 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter ID, owner, or request text..." /></div><button className="icon-button" onClick={() => setSearch("")}><RefreshCw size={16} /></button></div>{live.loading ? <div className="card" style={{ padding: 24 }}>Loading live requests…</div> : <div className="board">{columns.map(([key, title, subtitle]) => <section key={key} className={`board-column ${key}`} onDragOver={(event) => event.preventDefault()} onDrop={() => void drop(key)}><h2 className="column-title">{title} <span>{board[key]?.length ?? 0}</span></h2><p className="column-subtitle">{subtitle}</p>{(board[key] ?? []).map((request) => <article key={request.id} className={`kanban-card ${dragged?.id === request.id ? "dragging" : ""}`} draggable onDragStart={() => setDragged(request)} onClick={() => setSelected(request)}><div className="kanban-top"><span className="req-id"><GripVertical size={14} className="drag-grip" />{request.id}</span><span className={`status ${request.status}`}>{labelForStatus(request.status)}</span></div><div className="kanban-raw">“{request.rawInput}”</div><div className="kanban-summary">✣ {formatSummary(request)}</div><div className="kanban-meta"><div className="owner"><span className="owner-avatar">{initials(request.ownerEmail ?? request.ownerId)}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.ownerEmail ?? request.ownerId}</span></div>{request.uncertainFields > 0 ? <span className="uncertain">⚠ {request.uncertainFields}</span> : <span className="clean-check">✓</span>}</div>{request.selectedPartnerName ? <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 11 }}>Partner: <strong style={{ color: "var(--text)" }}>{request.selectedPartnerName}</strong></div> : null}</article>)}</section>)}</div>}{selected ? <RequestDetailDrawer request={selected} onClose={() => setSelected(null)} onChanged={live.reload} /> : null}</main>;
}

function initials(value: string) { return value.split(/[\s@._-]+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function downloadRequests(requests: AdminRequest[]) { const rows = requests.map((request) => ({ id: request.id, owner: request.ownerEmail ?? request.ownerId, status: request.status, rawInput: request.rawInput, bookings: formatSummary(request), createdAt: request.createdAt })); const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "staffflow-live-requests.json"; anchor.click(); URL.revokeObjectURL(url); }
