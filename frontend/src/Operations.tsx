import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, AlertCircle, CheckCircle2, RefreshCw, Search, Users, TrendingUp,
  UserPlus, Webhook, Download, Filter, CircleDollarSign
} from "lucide-react";
import {
  getAnalytics, getIntegrationEvents, getIntegrationStatus, listLeads, submitLead,
  testWebhook, updateLeadStatus
} from "./api";
import type {
  AnalyticsOverview, IntegrationEvent, IntegrationsStatus, LeadInput, LeadResponse, LeadStatus
} from "./api";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./Operations.css";

const STATUSES: LeadStatus[] = ["new", "qualified", "contacted", "proposal", "converted", "lost"];
const CHART_COLORS = ["#07877f", "#36a99e", "#6c91c2", "#dba34d", "#49a875", "#b76c6c"];
const EMPTY_FORM: LeadInput = {
  name: "", email: "", company: "", service_interest: "", project_summary: "",
  budget: "", timeline: "", consent_to_contact: false
};

function downloadCsv(leads: LeadResponse[]) {
  const columns: (keyof LeadResponse)[] = ["id", "name", "email", "company", "service_interest", "project_summary", "budget", "timeline", "status", "lead_source", "created_at"];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...leads.map(lead => columns.map(key => escape(lead[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `cynbit-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click(); URL.revokeObjectURL(url);
}

export default function Operations() {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [leads, setLeads] = useState<LeadResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [integration, setIntegration] = useState<IntegrationsStatus | null>(null);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<LeadInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [a, l, i, e] = await Promise.all([
        getAnalytics(), listLeads({ search, status: statusFilter, limit: 200 }), getIntegrationStatus(), getIntegrationEvents()
      ]);
      setAnalytics(a); setLeads(l.items); setTotal(l.total); setIntegration(i); setEvents(e.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load CRM data.");
    } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createLead(event: FormEvent) {
    event.preventDefault();
    if (!form.consent_to_contact) { setError("Contact consent is required before saving a lead."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      await submitLead({ ...form, name: form.name.trim(), email: form.email.trim(), service_interest: form.service_interest.trim(), project_summary: form.project_summary.trim() });
      setForm(EMPTY_FORM); setNotice("Lead saved successfully. Notification delivery status is available in Integrations.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this lead.");
    } finally { setSaving(false); }
  }

  async function changeStatus(lead: LeadResponse, status: LeadStatus) {
    setError(""); setNotice("");
    try {
      await updateLeadStatus(lead.id, status);
      setNotice(`Lead #${lead.id} updated to ${status}.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update lead status."); }
  }

  async function sendTestWebhook() {
    setTestingWebhook(true); setError(""); setNotice("");
    try {
      const result = await testWebhook();
      setNotice(result.message);
      const e = await getIntegrationEvents(); setEvents(e.items);
    } catch (err) { setError(err instanceof Error ? err.message : "Webhook test failed."); }
    finally { setTestingWebhook(false); }
  }

  return <section className="ops-section" id="operations">
    <div className="ops-heading">
      <div><span className="ops-eyebrow">PHASES 5 · 6 · 7</span><h2>CRM, analytics & integrations</h2><p>Manage real leads, review performance and check outbound notification status.</p></div>
      <button className="ops-button secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""}/> {loading ? "Refreshing…" : "Refresh data"}</button>
    </div>

    {error && <div className="ops-alert error" role="alert"><AlertCircle size={18}/>{error}</div>}
    {notice && <div className="ops-alert success" role="status"><CheckCircle2 size={18}/>{notice}</div>}

    <div className="ops-kpis">
      <article className="ops-kpi"><span className="kpi-icon"><Users size={20}/></span><span>Total leads</span><strong>{analytics?.total_leads ?? "—"}</strong><small>All saved records</small></article>
      <article className="ops-kpi"><span className="kpi-icon"><Activity size={20}/></span><span>Qualified</span><strong>{analytics?.qualified_leads ?? "—"}</strong><small>Qualified, proposal or converted</small></article>
      <article className="ops-kpi"><span className="kpi-icon"><CheckCircle2 size={20}/></span><span>Converted</span><strong>{analytics?.converted_leads ?? "—"}</strong><small>Marked as converted</small></article>
      <article className="ops-kpi"><span className="kpi-icon"><TrendingUp size={20}/></span><span>Conversion rate</span><strong>{analytics ? `${analytics.conversion_rate}%` : "—"}</strong><small>Converted ÷ all leads</small></article>
    </div>

    <div className="ops-grid">
      <article className="ops-panel"><div className="ops-panel-head"><div><h3>Monthly lead trend</h3><p>Based on records saved in the database</p></div></div>
        <div className="ops-chart">{analytics?.monthly_leads?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.monthly_leads}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{fontSize:11, fill:"var(--chart-axis)"}} axisLine={{stroke:"var(--chart-grid)"}} tickLine={{stroke:"var(--chart-grid)"}}/><YAxis allowDecimals={false} tick={{fontSize:11, fill:"var(--chart-axis)"}} axisLine={{stroke:"var(--chart-grid)"}} tickLine={{stroke:"var(--chart-grid)"}}/><Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", boxShadow: "var(--shadow)" }} labelStyle={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }} itemStyle={{ color: "var(--chart-tooltip-item)" }}/><Bar dataKey="count" name="Leads" fill="#07877f" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <div className="ops-empty">Monthly data will appear when leads are saved.</div>}</div>
      </article>
      <article className="ops-panel"><div className="ops-panel-head"><div><h3>Lead status</h3><p>Current pipeline distribution</p></div></div>
        <div className="ops-chart">{analytics?.status_breakdown?.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.status_breakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name, value}) => `${name}: ${value}`}>{analytics.status_breakdown.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]}/>)}</Pie><Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", boxShadow: "var(--shadow)" }} labelStyle={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }} itemStyle={{ color: "var(--chart-tooltip-item)" }}/></PieChart></ResponsiveContainer> : <div className="ops-empty">No lead statuses to chart yet.</div>}</div>
      </article>
      <article className="ops-panel"><div className="ops-panel-head"><div><h3>Service demand</h3><p>Most requested services</p></div></div>
        <div className="ops-chart">{analytics?.service_demand?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.service_demand} layout="vertical" margin={{left:8,right:15}}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fontSize:11, fill:"var(--chart-axis)"}} axisLine={{stroke:"var(--chart-grid)"}} tickLine={{stroke:"var(--chart-grid)"}}/><YAxis type="category" dataKey="name" width={115} tick={{fontSize:11, fill:"var(--chart-axis)"}} axisLine={{stroke:"var(--chart-grid)"}} tickLine={{stroke:"var(--chart-grid)"}}/><Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", boxShadow: "var(--shadow)" }} labelStyle={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }} itemStyle={{ color: "var(--chart-tooltip-item)" }}/><Bar dataKey="count" name="Leads" fill="#36a99e" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer> : <div className="ops-empty">Service demand will appear when leads are saved.</div>}</div>
      </article>
      <article className="ops-panel"><div className="ops-panel-head"><div><h3>Budget distribution</h3><p>Parsed from manually entered budget text; unparsed values stay separate</p></div></div>
        <div className="ops-chart">{analytics?.budget_distribution?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.budget_distribution}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:11, fill:"var(--chart-axis)"}} axisLine={{stroke:"var(--chart-grid)"}} tickLine={{stroke:"var(--chart-grid)"}}/><YAxis allowDecimals={false} tick={{fontSize:11, fill:"var(--chart-axis)"}} axisLine={{stroke:"var(--chart-grid)"}} tickLine={{stroke:"var(--chart-grid)"}}/><Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", boxShadow: "var(--shadow)" }} labelStyle={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }} itemStyle={{ color: "var(--chart-tooltip-item)" }}/><Bar dataKey="count" name="Leads" fill="#dba34d" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <div className="ops-empty">Budget distribution will appear when leads include budget information.</div>}</div>
      </article>
    </div>

    <div className="ops-main-grid">
      <article className="ops-panel lead-form-panel">
        <div className="ops-panel-head"><div><h3><UserPlus size={18}/> Add a lead</h3><p>Manual CRM entry for a qualified enquiry</p></div></div>
        <form className="ops-lead-form" onSubmit={e => void createLead(e)}>
          <label>Name *<input required minLength={2} maxLength={120} value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label>
          <label>Email *<input required type="email" value={form.email} maxLength={254} onChange={e => setForm({...form, email:e.target.value})}/></label>
          <label>Company<input value={form.company ?? ""} maxLength={160} onChange={e => setForm({...form, company:e.target.value})}/></label>
          <label>Service interest *<input required minLength={2} value={form.service_interest} placeholder="e.g. AI automation" onChange={e => setForm({...form, service_interest:e.target.value})}/></label>
          <label className="full-field">Project summary *<textarea required minLength={10} maxLength={4000} rows={3} value={form.project_summary} onChange={e => setForm({...form, project_summary:e.target.value})}/></label>
          <label>Budget<input value={form.budget ?? ""} placeholder="e.g. ₹25,000" onChange={e => setForm({...form, budget:e.target.value})}/></label>
          <label>Timeline<input value={form.timeline ?? ""} placeholder="e.g. 3 weeks" onChange={e => setForm({...form, timeline:e.target.value})}/></label>
          <label className="full-field">Source<select value={form.lead_source ?? "website"} onChange={e => setForm({...form, lead_source:e.target.value})}><option value="website">Website</option><option value="chatbot">Chatbot</option><option value="referral">Referral</option><option value="linkedin">LinkedIn</option><option value="manual">Manual entry</option><option value="other">Other</option></select></label>
          <label className="consent-check full-field"><input type="checkbox" checked={form.consent_to_contact} onChange={e => setForm({...form, consent_to_contact:e.target.checked})}/> The person has agreed to be contacted about this enquiry.</label>
          <button className="ops-button primary full-field" disabled={saving}>{saving ? "Saving lead…" : "Save lead"} <UserPlus size={16}/></button>
        </form>
      </article>

      <article className="ops-panel integrations-panel">
        <div className="ops-panel-head"><div><h3><Webhook size={18}/> Integrations</h3><p>Prototype CRM and notification configuration</p></div></div>
        <div className="integration-row"><div><strong>Cynbit Internal CRM</strong><small>SQLite persistence · local prototype</small></div><span className="integration-state ready">Ready</span></div>
        <div className="integration-row"><div><strong>Outbound webhook</strong><small>{integration?.webhook?.configured ? "Configured in backend environment" : "Optional · set CYNBIT_WEBHOOK_URL in backend/.env"}</small></div><span className={`integration-state ${integration?.webhook?.configured ? "ready" : "pending"}`}>{integration?.webhook?.configured ? "Configured" : "Not configured"}</span></div>
        <div className="integration-row"><div><strong>Email provider</strong><small>{integration?.email?.configured ? "SMTP settings detected" : "Not enabled in this prototype"}</small></div><span className={`integration-state ${integration?.email?.configured ? "ready" : "pending"}`}>{integration?.email?.configured ? "Configured" : "Optional"}</span></div>
        <p className="integration-note">{integration?.notifications ?? "Lead records save locally. Webhook notifications are best-effort and never block CRM saving."}</p>
        <button className="ops-button secondary" onClick={() => void sendTestWebhook()} disabled={testingWebhook || !integration?.webhook?.configured}><Webhook size={16}/>{testingWebhook ? "Testing…" : "Send test webhook"}</button>
        <div className="events-heading"><h4>Recent notification events</h4><span>{events.length}</span></div>
        <div className="events-list">{events.length ? events.map(event => <div className="event-item" key={event.id}><span className={`event-dot ${event.status}`}/><div><strong>{event.event_type}</strong><small>{event.detail || event.destination || "Local event"}</small></div><time>{event.created_at}</time></div>) : <div className="ops-empty small">Events will appear when leads or statuses change.</div>}</div>
      </article>
    </div>

    <article className="ops-panel ops-leads-panel">
      <div className="ops-panel-head leads-head"><div><h3>Lead pipeline <span className="total-pill">{total}</span></h3><p>Search, filter and update the status of saved leads.</p></div><button className="ops-button secondary" onClick={() => downloadCsv(leads)} disabled={!leads.length}><Download size={16}/> Export visible CSV</button></div>
      <div className="lead-filters"><label className="search-filter"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, company or summary"/></label><label className="status-filter"><Filter size={16}/><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label></div>
      {loading && <p className="ops-loading">Loading CRM data…</p>}
      {!loading && leads.length === 0 && <div className="ops-empty table-empty"><CircleDollarSign size={22}/><strong>No leads found</strong><span>Add a lead or change your filters.</span></div>}
      {leads.length > 0 && <div className="lead-table-wrap"><table className="lead-table"><thead><tr><th>Lead</th><th>Service & requirements</th><th>Budget / timeline</th><th>Source</th><th>Status</th><th>Created</th></tr></thead><tbody>{leads.map(lead => <tr key={lead.id}><td><strong>{lead.name}</strong><small>{lead.email}</small>{lead.company && <small>{lead.company}</small>}</td><td><strong>{lead.service_interest}</strong><small className="summary-cell">{lead.project_summary}</small></td><td>{lead.budget || "—"}<small>{lead.timeline || "Timeline not provided"}</small></td><td>{lead.lead_source || "website"}</td><td><select className={`lead-status status-${lead.status}`} value={lead.status} aria-label={`Status for lead ${lead.id}`} onChange={e => void changeStatus(lead, e.target.value as LeadStatus)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></td><td>{new Date(lead.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
      <div className="ops-table-footer">Showing {leads.length} of {total} matching leads · CSV export includes the currently visible records.</div>
    </article>
  </section>;
}
