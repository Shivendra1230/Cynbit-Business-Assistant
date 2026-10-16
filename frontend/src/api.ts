const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8000";

export type HealthResponse = { status: string; service: string; version: string };
export type SearchResult = {
  chunk_id: string;
  source: string;
  category: string;
  text: string;
  similarity: number;
  chunk_index?: number;
};
export type SearchResponse = {
  query: string;
  results: SearchResult[];
  count: number;
  retrieval_mode: string;
};
export type ChatSource = SearchResult;
export type ChatResponse = {
  answer: string;
  sources: ChatSource[];
  agent: string;
  retrieval_mode: string;
  quality_status?: string;
};
export type HistoryMessage = { role: "user" | "assistant"; content: string };
export type AgentInfo = { id: string; name: string; purpose: string };
export type AgentsResponse = { status: string; agents: AgentInfo[] };
export type LeadInput = {
  name: string;
  email: string;
  company?: string;
  service_interest: string;
  project_summary: string;
  budget?: string;
  timeline?: string;
  consent_to_contact: boolean;
  lead_source?: string;
};
export type LeadResponse = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  service_interest: string;
  project_summary: string;
  budget: string | null;
  timeline: string | null;
  status: LeadStatus | string;
  created_at: string;
  lead_source: string;
  updated_at: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new Error(`Cannot connect to API at ${API_BASE}. Start FastAPI and check VITE_API_BASE_URL.`);
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((item: { msg?: string }) => item.msg || "Invalid input").join("; ");
    } catch { /* Keep fallback error when response is not JSON. */ }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export function getHealth() { return request<HealthResponse>("/health"); }
export function getAgents() { return request<AgentsResponse>("/api/agents"); }
export function searchKnowledge(query: string, top_k = 4) {
  return request<SearchResponse>("/api/knowledge/search", { method: "POST", body: JSON.stringify({ query, top_k }) });
}
export function sendChat(message: string, history: HistoryMessage[] = []) {
  return request<ChatResponse>("/api/chat", { method: "POST", body: JSON.stringify({ message, history }) });
}
export function submitLead(lead: LeadInput) {
  return request<LeadResponse>("/api/leads", { method: "POST", body: JSON.stringify(lead) });
}


export type LeadStatus = "new" | "qualified" | "contacted" | "proposal" | "converted" | "lost";
export type LeadListResponse = { items: LeadResponse[]; total: number; limit: number; offset: number };
export type AnalyticsOverview = {
  total_leads: number;
  qualified_leads: number;
  converted_leads: number;
  conversion_rate: number;
  status_breakdown: { name: string; count: number }[];
  service_demand: { name: string; count: number }[];
  monthly_leads: { month: string; count: number }[];
  lead_sources: { name: string; count: number }[];
  budget_distribution: { name: string; count: number }[];
  recent_leads: { id: number; name: string; email: string; service_interest: string; status: string; created_at: string }[];
};
export type IntegrationsStatus = {
  crm: { name: string; mode: string; status: string };
  webhook: { configured: boolean; status: string };
  email: { configured: boolean; status: string };
  notifications: string;
};
export type IntegrationEvent = { id: number; event_type: string; lead_id: number | null; status: string; destination: string | null; detail: string | null; created_at: string };

export function listLeads(params: { search?: string; status?: string; service?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  return request<LeadListResponse>(`/api/leads${query.toString() ? `?${query.toString()}` : ""}`);
}
export function updateLeadStatus(id: number, status: LeadStatus) {
  return request<LeadResponse>(`/api/leads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}
export function getAnalytics() { return request<AnalyticsOverview>("/api/analytics/overview"); }
export function getIntegrationStatus() { return request<IntegrationsStatus>("/api/integrations/status"); }
export function getIntegrationEvents() { return request<{ items: IntegrationEvent[]; count: number }>("/api/integrations/events?limit=30"); }
export function testWebhook() { return request<{ status: string; message: string }>("/api/integrations/test-webhook", { method: "POST", body: JSON.stringify({}) }); }
