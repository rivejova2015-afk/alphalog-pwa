"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, User, Bot } from "lucide-react";
import { toast } from "sonner";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  rating?: number | null;
  created_at: string;
};

type Props = {
  message: Message;
  assistantName: string;
  sessionId: string;
  isStreaming?: boolean;
  streamingContent?: string;
};

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3 class='font-semibold text-slate-200 mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='font-semibold text-slate-100 mt-4 mb-1 text-base'>$1</h2>")
    .replace(/^• (.+)$/gm, "<li class='ml-4'>$1</li>")
    .replace(/^- (.+)$/gm, "<li class='ml-4'>$1</li>")
    .replace(/\n{2,}/g, "</p><p class='mt-2'>")
    .replace(/\n/g, "<br />");
}

export function ChatMessage({
  message,
  assistantName,
  sessionId,
  isStreaming = false,
  streamingContent,
}: Props) {
  const [rating, setRating] = useState<number | null>(message.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);

  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";
  const content = isStreaming && streamingContent != null ? streamingContent : message.content;

  const handleRating = async (value: 1 | -1) => {
    if (ratingLoading || rating === value) return;
    setRatingLoading(true);
    try {
      const res = await fetch(
        `/api/terminal/chat/sessions/${sessionId}/messages/${message.id}/rating`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: value }),
        }
      );
      if (res.ok) {
        setRating(value);
      } else {
        toast.error("No se pudo guardar el feedback");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setRatingLoading(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-PR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-500 bg-slate-800/60 px-3 py-1 rounded-full">
          {content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 group ${isAssistant ? "items-start" : "items-start flex-row-reverse"}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
          isAssistant
            ? "bg-emerald-900/60 text-emerald-400 border border-emerald-700/40"
            : "bg-slate-700 text-slate-300"
        }`}
      >
        {isAssistant ? <Bot size={14} /> : <User size={14} />}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col max-w-[85%] ${isAssistant ? "items-start" : "items-end"}`}>
        <div
          className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
            isAssistant
              ? "bg-slate-800 text-slate-200 rounded-tl-sm"
              : "bg-slate-700 text-slate-100 rounded-tr-sm"
          }`}
        >
          {isAssistant ? (
            <div
              dangerouslySetInnerHTML={{
                __html: `<p class='mt-0'>${renderMarkdown(content)}</p>`,
              }}
            />
          ) : (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
          {isStreaming && (
            <span className="inline-block w-0.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
          )}
        </div>

        {/* Footer: timestamp + rating */}
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.created_at)}
          </span>

          {isAssistant && !isStreaming && message.id && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleRating(1)}
                disabled={ratingLoading}
                aria-label="Respuesta útil"
                className={`p-0.5 rounded transition-colors ${
                  rating === 1
                    ? "text-emerald-400"
                    : "text-slate-600 hover:text-emerald-400"
                }`}
              >
                <ThumbsUp size={12} />
              </button>
              <button
                onClick={() => handleRating(-1)}
                disabled={ratingLoading}
                aria-label="Respuesta no útil"
                className={`p-0.5 rounded transition-colors ${
                  rating === -1
                    ? "text-red-400"
                    : "text-slate-600 hover:text-red-400"
                }`}
              >
                <ThumbsDown size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
