import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, ArrowUpRight, Bot, BookOpen, CheckCircle2, ChevronDown,
  Database, FileSearch, Layers3, MessageCircle, Moon, Plus, Search,
  Send, ShieldCheck, Sparkles, Sun, Trash2, UserRound, XCircle, Zap
} from "lucide-react";
import { getHealth, searchKnowledge, sendChat } from "./api";
import type { ChatResponse, SearchResponse } from "./api";
import MessageContent from "./MessageContent";
import Operations from "./Operations";

type ApiStatus = "checking" | "online" | "offline";
type Theme = "light" | "dark";
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; sources?: ChatResponse["sources"]; agent?: string };
const suggestions = [
  "What AI and automation services does Cynbit offer?",
  "Compare Cynbit Studio, Revio and TenantEase",
  "How can Cynbit help automate repetitive business tasks?",
  "Which cloud and infrastructure services are available?"
];
function initialTheme(): Theme {
  try { return localStorage.getItem("cynbit-theme") === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [apiMessage, setApiMessage] = useState("Checking API connection…");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: id(), role: "assistant", content: "Hi! I’m Cynbit’s knowledge assistant. Ask me about our services, products, technology or company information. I’ll use the available company knowledge and tell you when something isn’t documented." }
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem("cynbit-theme", theme); } catch { /* storage disabled */ }
  }, [theme]);

  const checkBackend = useCallback(async () => {
    setApiStatus("checking");
    setApiMessage("Checking API connection…");
    try {
      const h = await getHealth();
      if (h.status !== "ok") {
        throw new Error(`Unexpected health status: ${h.status}`);
      }
      setApiStatus("online");
      setApiMessage(`${h.service} · v${h.version}`);
    } catch (error) {
      setApiStatus("offline");
      setApiMessage(error instanceof Error
        ? `${error.message} Check the configured API URL and backend status.`
        : "FastAPI backend is not reachable. Check the configured API URL and backend status.");
    }
  }, []);

  // Run the health check on first render; without this effect the banner stays on “Connecting”.
  useEffect(() => {
    void checkBackend();
  }, [checkBackend]);

  useEffect(() => {
  const element = chatEndRef.current;

  if (typeof element?.scrollIntoView === "function") {
    element.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }
  }, [messages, chatBusy]);

  async function runSearch(event?: FormEvent, chosen?: string) {
    event?.preventDefault();
    const q = (chosen ?? query).trim();
    if (q.length < 3) { setSearchError("Enter at least 3 characters to search."); return; }
    setQuery(q); setSearching(true); setSearchError("");
    try { setResults(await searchKnowledge(q)); }
    catch { setSearchError("Search failed. Check backend logs and local embedding model status."); }
    finally { setSearching(false); }
  }

  async function sendMessage(event?: FormEvent, chosen?: string) {
    event?.preventDefault();
    const text = (chosen ?? chatInput).trim();
    if (text.length < 2 || chatBusy) return;
    const userMessage: ChatMessage = { id: id(), role: "user", content: text };
    const prior = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMessage]);
    setChatInput(""); setChatBusy(true); setChatError("");
    try {
      const response = await sendChat(text, prior);
      setMessages(prev => [...prev, {
        id: id(), role: "assistant", content: response.answer,
        sources: response.sources ?? [], agent: response.agent
      }]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Chat request failed. Check backend and GROQ_API_KEY.");
    } finally { setChatBusy(false); }
  }

  const chatSources = useMemo(() => messages.filter(m => m.role === "assistant" && m.sources?.length), [messages]);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="Cynbit home">
        <span className="brand-mark"><Bot size={25}/></span>
        <span><strong>cynbit</strong><small>AI BUSINESS WORKSPACE</small></span>
      </a>
      <div className="side-label">WORKSPACE</div>
      <a className="side-link active" href="#overview"><Layers3 size={19}/>Overview</a>
      <a className="side-link" href="#semantic-search"><Search size={19}/>Knowledge search<span className="side-count">LIVE</span></a>
      <a className="side-link" href="#assistant"><MessageCircle size={19}/>AI assistant<span className="side-count live-tag">NEW</span></a>
      <a className="side-link" href="#operations"><BookOpen size={19}/>CRM &amp; Leads<span className="side-count">LIVE</span></a>
      <a className="side-link" href="#operations"><Activity size={19}/>Analytics<span className="side-count">LIVE</span></a>
      <div className="sidebar-bottom">
        <div className="privacy-note"><ShieldCheck size={18}/><span>Evidence-first AI. No invented company facts.</span></div>
        <div className="workspace-user"><div className="user-avatar">CT</div><div><strong>Cynbit Team</strong><small>Development workspace</small></div><ChevronDown size={16}/></div>
      </div>
    </aside>

    <main className="main-area" id="overview">
      <header className="topbar">
        <div className="crumb">Cynbit <span>/</span> <strong>AI workspace</strong></div>
        <div className="top-actions">
          <button className="theme-toggle" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
            {theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}<span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>
          {import.meta.env.DEV && <span className="env-label">LOCAL DEVELOPMENT</span>}
          <span className={`connection-dot ${apiStatus}`}></span>
          <span className="connection-label">{apiStatus === "online" ? "API connected" : apiStatus === "offline" ? "API offline" : "Checking API"}</span>
        </div>
      </header>

      <div className="page-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">CYNBIT TECHNOLOGIES <span>•</span> AI OPERATIONS</div>
            <h1>Turn company knowledge<br/><em>into useful answers.</em></h1>
            <p>Search the knowledge base, ask follow-up questions, and inspect the evidence behind every answer.</p>
            <div className="hero-meta"><span><CheckCircle2 size={17}/> Local semantic retrieval</span><span><ShieldCheck size={17}/> Evidence-linked answers</span><span><Zap size={17}/> Groq-powered chat</span></div>
          </div>
          <div className="hero-graphic" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="orb-center"><Bot size={42}/></div><div className="orb-node node-a"><Search size={19}/></div><div className="orb-node node-b"><Database size={19}/></div><div className="orb-node node-c"><Sparkles size={19}/></div></div>
        </section>

        <section className={`connection-banner ${apiStatus}`} aria-live="polite">
          <div className="connection-icon">{apiStatus === "offline" ? <XCircle size={21}/> : <Activity size={21}/>}</div>
          <div className="connection-copy"><strong>{apiStatus === "online" ? "Backend connected" : apiStatus === "offline" ? "Backend connection unavailable" : "Connecting to backend"}</strong><span>{apiMessage}</span></div>
          {apiStatus === "offline" ? <button className="retry-button" onClick={checkBackend}>Retry connection</button> : <span className="connection-status">{apiStatus === "online" ? "CONNECTED" : "CHECKING"}</span>}
        </section>

        <section className="section-head"><div><h2>Knowledge workspace</h2><p>Search company information by meaning, then review the original retrieved chunks.</p></div><span className="section-note"><Sparkles size={17}/> Embedding-powered</span></section>
        <section className="search-layout" id="semantic-search">
          <div className="search-panel">
            <div className="panel-top"><div className="panel-icon"><FileSearch size={22}/></div><span className="panel-kicker">SEMANTIC KNOWLEDGE SEARCH</span></div>
            <h3>Find the information you need.</h3>
            <p className="panel-description">Ask about Cynbit services, products, capabilities or technology. Search returns evidence, not a generated guess.</p>
            <form className="search-form" onSubmit={e => void runSearch(e)}><Search size={20}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. How can Cynbit automate business workflows?" aria-label="Search Cynbit knowledge"/><button type="submit" disabled={searching}>{searching ? "Searching…" : "Search"} <ArrowUpRight size={17}/></button></form>
            <div className="suggestions-label">QUICK SEARCHES</div>
            <div className="suggestions">{suggestions.map(item => <button type="button" key={item} onClick={() => void runSearch(undefined, item)}>{item}<ArrowUpRight size={15}/></button>)}</div>
            {searchError && <div className="error-message" role="alert">{searchError}</div>}
            {results && <div className="results-area" aria-live="polite"><div className="results-heading"><div><h4>Retrieved evidence</h4><p>{results.count} result(s) · {(results.retrieval_mode ?? "semantic search").split("-").join(" ")}</p></div><span>{results.count ? "SOURCES FOUND" : "NO SOURCES"}</span></div>
              {results.count === 0 ? <div className="empty-results">No indexed chunks returned. Try a more specific question or add verified knowledge.</div> : results.results.map(r => <article className="result-card" key={r.chunk_id}><div className="result-card-head"><span className="source-type">{r.category}</span><span className="similarity">Similarity {r.similarity.toFixed(3)}</span></div><strong>{r.source}</strong><p>{r.text}</p></article>)}
            </div>}
          </div>
          <aside className="search-aside">
            <div className="aside-card"><div className="aside-icon"><Database size={21}/></div><span className="aside-overline">KNOWLEDGE INDEX</span><h3>Meaning-aware retrieval</h3><p>Local ONNX embeddings map queries and company content into semantic vectors without paid embedding APIs.</p><div className="aside-divider"/><div className="aside-foot"><span>Embedding model</span><strong>all-MiniLM-L6-v2</strong></div><div className="aside-foot"><span>Runtime</span><strong>FastEmbed · ONNX</strong></div></div>
            <div className="aside-card compact"><div className="aside-icon green"><ShieldCheck size={21}/></div><h3>Evidence over guesswork</h3><p>Similarity scores rank sources. They are not confidence probabilities or proof of correctness.</p></div>
          </aside>
        </section>

        <section className="assistant-section" id="assistant">
          <div className="section-head"><div><h2>Conversational AI assistant</h2><p>Ask a question, then continue with follow-ups in the same conversation.</p></div><span className="phase-pill phase-live"><span/> PHASE 4 · MULTI-AGENT RAG</span></div>
          <div className="chat-shell">
            <div className="chat-header"><div className="chat-avatar"><Bot size={23}/></div><div className="chat-heading"><strong>Cynbit Knowledge Assistant</strong><span><span className="status-pulse"/> Grounded in retrieved company knowledge</span></div><button className="icon-button" title="Clear conversation" onClick={() => {setMessages([{id:id(),role:"assistant",content:"Conversation cleared. Ask me about Cynbit’s documented services, products or technology."}]);setChatError("");}}><Trash2 size={17}/></button></div>
            <div className="chat-messages">
              {messages.map(m => <div className={`chat-message ${m.role}`} key={m.id}><div className="message-avatar">{m.role === "assistant" ? <Bot size={18}/> : <UserRound size={18}/>}</div><div className="message-body">
                <div className="message-role">{m.role === "assistant" ? `CYNBIT ASSISTANT${m.agent ? ` · ${m.agent.replace(/_/g, " ").toUpperCase()}` : ""}` : "YOU"}</div>
                <div className="message-content">
                  {m.role === "assistant"
                    ? <MessageContent content={m.content} />
                    : <p>{m.content}</p>}
                </div>
                {m.sources && m.sources.length > 0 && (
                  <details className="chat-source-details">
                    <summary><BookOpen size={15}/> Evidence used <span>{m.sources.length} sources</span></summary>
                    <div className="chat-source-list">
                      {m.sources.map((source, i) => (
                        <article className="chat-source" key={`${source.source}-${i}`}>
                          <div className="chat-source-heading">
                            <strong>{source.source}</strong>
                            <span>{source.category} · similarity {source.similarity.toFixed(3)}</span>
                          </div>
                          <p>{source.text}</p>
                        </article>
                      ))}
                    </div>
                  </details>
                )}
              </div></div>)}
              {chatBusy && <div className="chat-message assistant"><div className="message-avatar"><Bot size={18}/></div><div className="message-body"><div className="message-role">CYNBIT ASSISTANT</div><p className="typing"><span/><span/><span/> Searching knowledge and preparing an answer…</p></div></div>}
              <div ref={chatEndRef}/>
            </div>
            {chatError && <div className="error-message chat-error" role="alert">{chatError}</div>}
            <form className="chat-composer" onSubmit={e => void sendMessage(e)}><textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about Cynbit’s services, products, or capabilities…" rows={2} aria-label="Message the Cynbit assistant" onKeyDown={e => {if (e.key === "Enter" && !e.shiftKey) {e.preventDefault(); void sendMessage();}}}/><div className="composer-bottom"><span><ShieldCheck size={14}/> Answers are limited to available company evidence.</span><button type="submit" disabled={chatBusy || chatInput.trim().length < 2}>{chatBusy ? "Thinking…" : "Send message"} <Send size={16}/></button></div></form>
            <div className="chat-suggestions">{suggestions.slice(0,3).map(s => <button key={s} onClick={() => void sendMessage(undefined, s)} disabled={chatBusy}><Plus size={14}/>{s}</button>)}</div>
          </div>
          {chatSources.length > 0 && <p className="source-note"><BookOpen size={15}/> {chatSources.length} assistant response(s) include retrieved evidence. Check source snippets before relying on business-critical details.</p>}
        </section>

        <Operations />
        <footer className="footer">
          <span>© Cynbit Technologies · AI Business Assistant</span>
        </footer>
      </div>
    </main>
  </div>;
}
