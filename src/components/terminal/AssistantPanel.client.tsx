"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bot, Plus, Menu, X, Send, Square, FileText,
  Settings, Trash2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { LivePriceBadge } from "./LivePriceBadge";
import { ChatMessage, type Message } from "./ChatMessage";

type Asset = "XAUUSD" | "US500";

type Session = {
  id: string;
  title: string;
  asset: Asset;
  created_at: string;
  preview: string | null;
};

type AssistantSettings = {
  assistant_name: string;
  default_asset: Asset;
};

const parseSSELine = (line: string): { type: string; content?: string; message_id?: string } | null => {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6)) as { type: string; content?: string; message_id?: string };
  } catch {
    return null;
  }
};

export function AssistantPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [settings, setSettings] = useState<AssistantSettings>({
    assistant_name: "AlphaAnalyst",
    default_asset: "XAUUSD",
  });
  const [generatingReport, setGeneratingReport] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Responsive: close sidebar on small screens by default
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    if (mq.matches) setSidebarOpen(false);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Load settings
  useEffect(() => {
    fetch("/api/terminal/assistant/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings as AssistantSettings);
      })
      .catch(() => {});
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/terminal/chat/sessions");
      const data = (await res.json()) as { sessions: Session[] };
      setSessions(data.sessions ?? []);
    } catch {
      toast.error("Error al cargar sesiones");
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load messages for active session
  const loadMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/terminal/chat/sessions/${sessionId}`);
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages ?? []);
    } catch {
      toast.error("Error al cargar mensajes");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectSession = (session: Session) => {
    if (streaming) return; // don't switch mid-stream
    setActiveSession(session);
    loadMessages(session.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // Create new session
  const createSession = async (asset?: Asset) => {
    const chosenAsset = asset ?? settings.default_asset;
    try {
      const res = await fetch("/api/terminal/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset: chosenAsset }),
      });
      const data = (await res.json()) as { session: Session; isFirst: boolean };
      const newSession = data.session;

      setSessions((prev) => [newSession, ...prev]);
      setActiveSession(newSession);
      setMessages([]);

      if (data.isFirst) {
        // Trigger onboarding brief
        await triggerOnboardingBrief(newSession.id);
      }

      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch {
      toast.error("Error al crear sesión");
    }
  };

  const triggerOnboardingBrief = async (sessionId: string) => {
    await sendMessageStream(sessionId, "", true);
  };

  // Delete session
  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/terminal/chat/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch {
      toast.error("Error al eliminar sesión");
    }
  };

  // Send message with SSE streaming
  const sendMessageStream = async (
    sessionId: string,
    content: string,
    isOnboarding = false
  ) => {
    if (streaming) return;
    setStreaming(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    // Add user message to UI immediately (not for onboarding)
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    if (!isOnboarding && content) {
      setMessages((prev) => [...prev, tempUserMsg]);
    }

    // Add streaming placeholder
    const streamingPlaceholder: Message = {
      id: `streaming-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, streamingPlaceholder]);

    try {
      const res = await fetch(`/api/terminal/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isOnboarding }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let assistantMessageId: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const event = parseSSELine(line);
          if (!event) continue;

          if (event.type === "delta" && event.content) {
            fullContent += event.content;
            setStreamingContent(fullContent);
          } else if (event.type === "done") {
            assistantMessageId = event.message_id ?? null;
          } else if (event.type === "error") {
            toast.error("Error del asistente");
          }
        }
      }

      // Replace placeholder with real message
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("streaming-"));
        if (fullContent) {
          filtered.push({
            id: assistantMessageId ?? `assistant-${Date.now()}`,
            role: "assistant",
            content: fullContent,
            created_at: new Date().toISOString(),
          });
        }
        return filtered;
      });

      // Reload sessions to update preview
      loadSessions();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — keep partial content
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.id.startsWith("streaming-"));
          if (streamingContent) {
            filtered.push({
              id: `assistant-cancelled-${Date.now()}`,
              role: "assistant",
              content: streamingContent + " [cancelado]",
              created_at: new Date().toISOString(),
            });
          }
          return filtered;
        });
      } else {
        setMessages((prev) => prev.filter((m) => !m.id.startsWith("streaming-")));
        toast.error("Error de conexión");
      }
    } finally {
      setStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  };

  const handleSend = () => {
    if (!activeSession || !input.trim() || streaming) return;
    const content = input.trim();
    setInput("");
    sendMessageStream(activeSession.id, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const generateReport = async () => {
    if (!activeSession || generatingReport) return;
    setGeneratingReport(true);
    try {
      const res = await fetch(
        `/api/terminal/chat/sessions/${activeSession.id}/generate-report`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const data = (await res.json()) as { ok: boolean; outcome: string; reportId?: string };
      if (data.ok && data.outcome !== "done_no_changes") {
        const systemMsg: Message = {
          id: `sys-${Date.now()}`,
          role: "system",
          content: `📄 Reporte ${activeSession.asset} generado y guardado en Evidence.`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMsg]);
        toast.success("Reporte guardado en Evidence");
      } else if (data.outcome === "done_no_changes") {
        toast.info("Sin cambios desde el último reporte");
      } else {
        toast.error("Error al generar reporte");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setGeneratingReport(false);
    }
  };

  const activeAsset = activeSession?.asset ?? settings.default_asset;
  const assistantName = settings.assistant_name;

  return (
    <div className="flex h-full min-h-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">

      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-200 ${
          sidebarOpen ? "w-56 min-w-[224px]" : "w-0 min-w-0 overflow-hidden"
        } md:relative absolute z-20 h-full`}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Sesiones
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-slate-500 hover:text-slate-300 md:hidden"
            aria-label="Cerrar sidebar"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loadingSessions ? (
            <div className="px-3 py-2 text-xs text-slate-500">Cargando...</div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-500 text-center">
              Sin sesiones aún
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSession(s)}
                className={`w-full text-left px-3 py-2 text-xs group flex items-start gap-2 hover:bg-slate-800 transition-colors ${
                  activeSession?.id === s.id ? "bg-slate-800 text-slate-200" : "text-slate-400"
                }`}
              >
                <ChevronRight
                  size={12}
                  className={`mt-0.5 flex-shrink-0 ${activeSession?.id === s.id ? "text-emerald-400" : "opacity-0 group-hover:opacity-100"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="truncate text-slate-600 text-[10px]">{s.asset}</div>
                </div>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-colors"
                  aria-label="Eliminar sesión"
                >
                  <Trash2 size={11} />
                </button>
              </button>
            ))
          )}
        </div>

        {/* New session buttons */}
        <div className="border-t border-slate-800 p-2 space-y-1">
          <button
            onClick={() => createSession("XAUUSD")}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
          >
            <Plus size={12} /> Nueva — XAUUSD
          </button>
          <button
            onClick={() => createSession("US500")}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
          >
            <Plus size={12} /> Nueva — US500
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-900 gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={16} />
            </button>
            <Bot size={16} className="text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-200 truncate">{assistantName}</span>
          </div>

          <div className="flex items-center gap-3">
            <LivePriceBadge symbol={activeAsset} />
            {activeSession && (
              <button
                onClick={generateReport}
                disabled={generatingReport || streaming}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 disabled:opacity-40 transition-colors"
                title="Generar reporte de mercado"
              >
                <FileText size={14} />
                <span className="hidden sm:inline">
                  {generatingReport ? "Generando..." : "Reporte"}
                </span>
              </button>
            )}
            <a
              href="/dashboard/terminal/settings"
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Configuración del asistente"
            >
              <Settings size={14} />
            </a>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!activeSession ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
              <Bot size={48} className="text-slate-700" />
              <div>
                <p className="text-slate-400 font-medium">{assistantName}</p>
                <p className="text-xs text-slate-600 mt-1">
                  Analista financiero XAUUSD · US500
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createSession("XAUUSD")}
                  className="px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 text-xs rounded-lg border border-emerald-800/40 transition-colors"
                >
                  + Nueva sesión XAUUSD
                </button>
                <button
                  onClick={() => createSession("US500")}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-700 transition-colors"
                >
                  + Nueva sesión US500
                </button>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex justify-center py-8">
              <span className="text-xs text-slate-500">Cargando mensajes...</span>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isStreamingMsg = streaming && idx === messages.length - 1 && msg.role === "assistant";
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    assistantName={assistantName}
                    sessionId={activeSession.id}
                    isStreaming={isStreamingMsg}
                    streamingContent={isStreamingMsg ? streamingContent : undefined}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        {activeSession && (
          <div className="border-t border-slate-800 px-3 py-3 bg-slate-900">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Pregunta a ${assistantName}...`}
                disabled={streaming}
                rows={1}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-700 disabled:opacity-50 transition-colors"
                style={{ minHeight: "38px", maxHeight: "120px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
              {streaming ? (
                <button
                  onClick={stopStreaming}
                  className="flex-shrink-0 p-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded-lg border border-red-800/40 transition-colors"
                  aria-label="Detener respuesta"
                  title="Detener"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="flex-shrink-0 p-2 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 rounded-lg border border-emerald-800/40 disabled:opacity-40 transition-colors"
                  aria-label="Enviar mensaje"
                  title="Enviar (Enter)"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">
              Enter para enviar · Shift+Enter para nueva línea
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
