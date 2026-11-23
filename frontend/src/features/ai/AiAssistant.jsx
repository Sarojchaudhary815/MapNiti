import React, { useEffect, useRef, useState } from 'react';
import {
  Send, Sparkles, Square, Trash2, Bot, User, AlertCircle, Plus, MoreVertical, Download, History, MessageSquare, X,
} from 'lucide-react';
import Markdown from '../../components/common/Markdown';
import { streamAiChat, getAiStatus } from '../../api/hubApi';
import { exportText } from '../../utils/geoExport';

const CHATS_KEY = 'mapniti_ai_chats';
const ACTIVE_KEY = 'mapniti_ai_active_chat';
const LEGACY_KEY = 'mapniti_ai_chat'; // single-chat storage used before chat history existed
const MAX_CHATS = 30;
const MAX_MESSAGES = 40;
const EMPTY = [];

const SUGGESTIONS = [
  { group: 'Civil', text: 'Design a side drain for a hill road: catchment 3 ha, forest + road, 1-day max rainfall 150 mm. Walk me through the rational method and Manning sizing.' },
  { group: 'Civil', text: 'What datasets and steps do I need for a landslide susceptibility map of a rural municipality in Nepal?' },
  { group: 'Geomatics', text: 'Convert MUTM 84 coordinates to WGS84 in Python with pyproj, including the Nepal datum shift.' },
  { group: 'Geomatics', text: 'How do I do a cadastral plot area check from total station coordinates and report it in ropani-aana-paisa-daam?' },
  { group: 'GEE', text: 'Write Google Earth Engine JavaScript to map monsoon flood extent with Sentinel-1 for the Koshi river.' },
  { group: 'GEE', text: 'Give me Python (geemap) code for an NDVI time series of my farm from 2018 to 2024 and plot it.' },
  { group: 'Data', text: 'Where can I download official district / municipality boundaries, rainfall station data and census data for Nepal?' },
  { group: 'Learn', text: 'Explain raster vs vector with engineering examples, then give me a 4-week plan to learn GIS + Python.' },
];

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function titleFrom(messages) {
  const first = (messages.find((m) => m.role === 'user')?.content || 'New chat').replace(/\s+/g, ' ').trim();
  return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}

function loadChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHATS_KEY) || 'null');
    if (Array.isArray(parsed)) return parsed;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      return [{ id: newId(), title: titleFrom(legacy), updatedAt: Date.now(), messages: legacy }];
    }
  } catch {
    /* corrupt or blocked storage — start fresh */
  }
  return [];
}

function loadActiveId(chats) {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id && chats.some((c) => c.id === id)) return id;
  } catch {
    /* ignore */
  }
  return chats[0]?.id ?? null;
}

function saveChats(chats, activeId) {
  let list = [...chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CHATS)
    .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES) }));
  // If storage is full, drop the oldest chats until the rest fits.
  for (;;) {
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(list));
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(LEGACY_KEY);
      return;
    } catch {
      if (!list.length) return; // storage blocked — chats live in memory only
      list = list.slice(0, -1);
    }
  }
}

function shortDate(ts) {
  const d = new Date(ts);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AiAssistant({ onOpenCodeLab, mapContext }) {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(() => loadActiveId(chats));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeId) || null;
  const messages = activeChat ? activeChat.messages : EMPTY;
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const updateChat = (id, fn) =>
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: fn(c.messages), updatedAt: Date.now() } : c)));

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => {
    getAiStatus().then(setStatus).catch(() => setStatus({ enabled: false, offline: true }));
  }, []);

  useEffect(() => {
    saveChats(chats, activeId);
  }, [chats, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput('');
    setError('');
    const history = [...messages, { role: 'user', content }];
    const pending = [...history, { role: 'assistant', content: '' }];
    let id = activeChat?.id;
    if (!id) {
      id = newId();
      setChats((cs) => [{ id, title: titleFrom(history), updatedAt: Date.now(), messages: pending }, ...cs]);
      setActiveId(id);
    } else {
      updateChat(id, () => pending);
    }
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamAiChat(history.slice(-20), mapContext || null, (chunk) => {
        updateChat(id, (m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }, controller.signal);
    } catch (err) {
      if (err.name !== 'AbortError') {
        const offline = err instanceof TypeError || /failed to fetch|network/i.test(err.message || '');
        setError(offline
          ? 'Cannot reach the MapNiti server. The backend may be stopped or restarting. Please try again in a moment.'
          : (err.message || 'Could not reach the assistant.'));
        if (offline) setStatus((s) => (s?.enabled ? s : { enabled: false, offline: true }));
        updateChat(id, (m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const newChat = () => {
    setActiveId(null);
    setError('');
    setMenuOpen(false);
    setHistoryOpen(false);
  };

  const openChat = (id) => {
    if (streaming) return;
    setActiveId(id);
    setError('');
    setHistoryOpen(false);
  };

  const removeChat = (id) => {
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (id === activeId) newChat();
  };

  const deleteChat = () => {
    setMenuOpen(false);
    if (activeChat) removeChat(activeChat.id);
  };

  const exportChat = () => {
    const body = messages
      .filter((m) => m.content)
      .map((m) => `## ${m.role === 'user' ? 'You' : 'MapNiti AI'}\n\n${m.content}`)
      .join('\n\n');
    const today = new Date().toISOString().slice(0, 10);
    exportText(`# MapNiti AI chat (${today})\n\n${body}\n`, `mapniti-ai-chat-${today}.md`, 'text/markdown');
    setMenuOpen(false);
  };

  const historyList = (
    <div className="flex flex-col h-full">
      <div className="p-3 flex items-center gap-2">
        <button onClick={newChat} disabled={streaming}
          className="flex-grow flex items-center justify-center gap-1.5 text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-2 rounded-xl disabled:opacity-40">
          <Plus size={14} /> New chat
        </button>
        <button onClick={() => setHistoryOpen(false)} className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close chat history">
          <X size={16} />
        </button>
      </div>
      <p className="px-4 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Your chats</p>
      <div className="flex-grow overflow-y-auto px-2 pb-3 space-y-0.5">
        {sortedChats.length === 0 && (
          <p className="px-2 py-3 text-[11px] text-slate-400">No saved chats yet. Chats are saved in this browser.</p>
        )}
        {sortedChats.map((c) => (
          <div key={c.id}
            className={`group flex items-center gap-1 rounded-xl px-2 py-2 ${c.id === activeId ? 'bg-violet-50 text-violet-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            <button onClick={() => openChat(c.id)} disabled={streaming}
              className="flex-grow min-w-0 flex items-center gap-2 text-left disabled:cursor-not-allowed">
              <MessageSquare size={13} className="shrink-0 opacity-60" />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold">{c.title}</span>
                <span className="block text-[10px] opacity-60">{shortDate(c.updatedAt)}</span>
              </span>
            </button>
            <button onClick={() => removeChat(c.id)} disabled={streaming} title="Delete chat" aria-label={`Delete chat: ${c.title}`}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 disabled:hidden">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex bg-slate-50 relative overflow-hidden">
      <aside className="hidden md:block w-64 shrink-0 border-r bg-white">{historyList}</aside>
      {historyOpen && (
        <div className="md:hidden absolute inset-0 z-30 flex">
          <div className="w-72 max-w-[85%] h-full bg-white shadow-xl">{historyList}</div>
          <button className="flex-grow bg-slate-900/30" onClick={() => setHistoryOpen(false)} aria-label="Close chat history" />
        </div>
      )}

      <div className="flex-grow min-w-0 flex flex-col">
        <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setHistoryOpen(true)} className="md:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100"
              aria-label="Chat history" title="Chat history">
              <History size={18} />
            </button>
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white">
              <Sparkles size={20} />
            </div>
            <h1 className="text-lg font-black text-slate-800">MapNiti AI</h1>
          </div>
          {messages.length > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={newChat} disabled={streaming}
                className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-xl disabled:opacity-40">
                <Plus size={14} /> New chat
              </button>
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen((o) => !o)} disabled={streaming} title="More options" aria-label="More options"
                  aria-haspopup="menu" aria-expanded={menuOpen}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                  <MoreVertical size={16} />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-1 w-40 z-20 bg-white rounded-xl shadow-lg border border-slate-100 p-1">
                    <button role="menuitem" onClick={exportChat}
                      className="w-full flex items-center gap-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg">
                      <Download size={14} /> Export chat
                    </button>
                    <button role="menuitem" onClick={deleteChat}
                      className="w-full flex items-center gap-2 text-[12px] font-semibold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg">
                      <Trash2 size={14} /> Delete chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-grow overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {status?.offline && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex gap-2 items-start">
                <AlertCircle size={16} className="shrink-0" />
                <span className="flex-grow">Cannot reach the MapNiti server, so the AI can't answer right now. If you run MapNiti yourself, start the backend API (port 8000).</span>
                <button onClick={() => getAiStatus().then(setStatus).catch(() => {})}
                  className="shrink-0 font-bold underline">Retry</button>
              </div>
            )}
            {status && !status.enabled && !status.offline && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[12px] text-amber-800 flex gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>The AI assistant isn't configured on this server. Set <code>GEMINI_API_KEY</code> (or <code>ANTHROPIC_API_KEY</code>) in <code>mapniti-backend/.env</code> and restart the API.</span>
              </div>
            )}

            {messages.length === 0 && (
              <div className="space-y-4 pt-6">
                <p className="text-center text-sm text-slate-500">Ask anything about GIS, remote sensing, data, surveying or civil design — in English or Nepali.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.text} onClick={() => send(s.text)}
                      className="text-left p-3 rounded-2xl bg-white border border-slate-100 hover:border-violet-300 hover:shadow-sm">
                      <span className="text-[9px] font-black uppercase tracking-widest text-violet-500">{s.group}</span>
                      <p className="text-[12px] text-slate-700 mt-0.5 leading-snug">{s.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0"><Bot size={16} /></div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-[#0047AB] text-white text-[13px] whitespace-pre-wrap' : 'bg-white border border-slate-100 shadow-sm min-w-0'}`}>
                  {m.role === 'user' ? m.content : (
                    m.content ? <Markdown text={m.content} onRunCode={onOpenCodeLab} /> : <span className="inline-flex gap-1 py-1"><span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce" /><span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce [animation-delay:150ms]" /><span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce [animation-delay:300ms]" /></span>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><User size={16} /></div>
                )}
              </div>
            ))}
            {error && <p className="text-[12px] text-red-500 text-center">{error}</p>}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t bg-white p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={Math.min(6, Math.max(1, input.split('\n').length))}
              placeholder="Ask about GIS, GEE code, drainage design, coordinate systems… (Shift+Enter for new line)"
              className="flex-grow resize-none text-[13px] border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-violet-400"
            />
            {streaming ? (
              <button onClick={stop} className="h-11 w-11 rounded-2xl bg-slate-800 text-white flex items-center justify-center" title="Stop"><Square size={16} /></button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} className="h-11 w-11 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center" title="Send"><Send size={16} /></button>
            )}
          </div>
          {mapContext && <p className="max-w-3xl mx-auto text-[10px] text-slate-400 mt-1.5">Your current AOI is shared with the assistant as context.</p>}
          {status?.enabled && !status.signed_in && (
            <p className="max-w-3xl mx-auto text-[10px] text-slate-400 mt-1.5">
              Free guest access: {status.limits?.per_hour} questions/hour, {status.limits?.per_day}/day. <a href="/login" className="underline">Log in</a> for more and longer answers.
            </p>
          )}
          <p className="max-w-3xl mx-auto text-[10px] text-slate-400 mt-1">AI can make mistakes — verify design values against codes and field data.</p>
        </div>
      </div>
    </div>
  );
}
