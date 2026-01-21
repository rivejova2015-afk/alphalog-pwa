// src/components/terminal/NewsPanel.client.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toArray, normalizeListResponse } from "@/lib/safe";
import { logError } from "@/lib/log";

interface Instrument {
  id: string;
  symbol: string;
  display_name: string;
}

interface News {
  id: string;
  title: string;
  url?: string;
  source?: string;
  relevancy_score?: number;
  impact_label?: string;
  timestamp_utc: string;
}

export default function NewsPanel() {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>("");
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    source: "",
    relevancy_score: "",
    impact_label: "",
  });
  const [error, setError] = useState<string>("");

  // Auto-refresh para instruments (60 segundos)
  const {
    data: instrumentsRaw,
    error: instrumentsError,
    missingTable: instrumentsMissingTable,
    refresh: refreshInstruments,
  } = useAutoRefresh<Instrument[]>({
    key: "NewsPanel:instruments",
    fetcher: async () => {
      const response = await fetch("/api/terminal/instruments");
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: No se pudieron cargar instrumentos`
        );
      }
      const data = await response.json();
      return normalizeListResponse<Instrument>(data);
    },
    intervalMs: 60000,
    enabled: true,
    onError: (err) => {
      logError("NewsPanel", {
        component: "NewsPanel",
        action: "fetch instruments",
        endpoint: "/api/terminal/instruments",
        message: err.message,
      });
    },
  });

  // Normaliza instruments de forma segura
  const instruments = toArray<Instrument>(instrumentsRaw || []);

  // Selecciona primer instrumento automáticamente
  useEffect(() => {
    if (instruments.length > 0 && !selectedInstrumentId) {
      setSelectedInstrumentId(instruments[0].id);
    }
  }, [instruments, selectedInstrumentId]);

  // Fetch news when instrument changes
  useEffect(() => {
    if (selectedInstrumentId) {
      fetchNews();
    }
  }, [selectedInstrumentId]);

  const fetchNews = useCallback(async () => {
    if (!selectedInstrumentId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/terminal/news?instrumentId=${selectedInstrumentId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: No se pudieron cargar noticias`);
      }
      const data = await response.json();
      // Normaliza respuesta
      const newsList = normalizeListResponse<News>(data);
      setNews(newsList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      logError("NewsPanel", {
        component: "NewsPanel",
        action: "fetch news",
        endpoint: `/api/terminal/news?instrumentId=${selectedInstrumentId}`,
        message: msg,
      });
      setNews([]); // Empty state en error
    } finally {
      setLoading(false);
    }
  }, [selectedInstrumentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrumentId || !formData.title.trim()) {
      setError("Por favor completa los campos obligatorios");
      return;
    }

    const payload = {
      instrumentId: selectedInstrumentId,
      title: formData.title,
      url: formData.url || null,
      source: formData.source || null,
      relevancy_score: formData.relevancy_score
        ? parseInt(formData.relevancy_score)
        : null,
      impact_label: formData.impact_label || null,
    };

    try {
      const method = editingNews ? "PATCH" : "POST";
      const url = editingNews
        ? `/api/terminal/news/${editingNews.id}`
        : "/api/terminal/news";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.error || `HTTP ${response.status}`;
        setError(msg);
        logError("NewsPanel", {
          component: "NewsPanel",
          action: "save news",
          endpoint: url,
          status: response.status,
          message: msg,
        });
        return;
      }

      resetForm();
      await fetchNews();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      logError("NewsPanel", {
        component: "NewsPanel",
        action: "save news",
        message: msg,
      });
    }
  };

  const handleEdit = (newsItem: News) => {
    setEditingNews(newsItem);
    setFormData({
      title: newsItem.title,
      url: newsItem.url || "",
      source: newsItem.source || "",
      relevancy_score: newsItem.relevancy_score?.toString() || "",
      impact_label: newsItem.impact_label || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (newsId: string) => {
    if (
      !confirm(
        "¿Estás seguro de eliminar esta noticia? Se moverá a la papelera."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/terminal/news/${newsId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: No se pudo eliminar`);
      }
      await fetchNews();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      logError("NewsPanel", {
        component: "NewsPanel",
        action: "delete news",
        endpoint: `/api/terminal/news/${newsId}`,
        message: msg,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      url: "",
      source: "",
      relevancy_score: "",
      impact_label: "",
    });
    setEditingNews(null);
    setShowForm(false);
    setError("");
  };

  return (
    <div className="space-y-6">
      {/* Missing Table Alert */}
      {instrumentsMissingTable && (
        <div className="p-4 bg-amber-900/50 border border-amber-700 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-amber-200">
                ⚠️ Configuración incompleta
              </h3>
              <p className="text-sm text-amber-300 mt-1">
                Falta crear la tabla de instrumentos en la base de datos
                (public.instruments). Por favor, ejecuta las migraciones de
                Supabase.
              </p>
            </div>
            <button
              onClick={refreshInstruments}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded text-sm font-medium whitespace-nowrap ml-4"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Instrumento (obligatorio)
          </label>
          {instruments.length === 0 ? (
            <div className="w-full px-4 py-2 rounded bg-slate-700 border border-slate-600 text-gray-400">
              Cargando instrumentos...
            </div>
          ) : (
            <select
              value={selectedInstrumentId}
              onChange={(e) => setSelectedInstrumentId(e.target.value)}
              className="w-full px-4 py-2 rounded bg-slate-700 border border-slate-600 text-white"
            >
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.display_name}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
        >
          {showForm ? "Cancelar" : "+ Nueva Noticia"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-700 p-6 rounded-lg border border-slate-600 space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Título (obligatorio)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 rounded bg-slate-600 border border-slate-500 text-white"
              placeholder="Ej: FED anunció aumento de tasas"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-4 py-2 rounded bg-slate-600 border border-slate-500 text-white"
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Fuente
              </label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
                className="w-full px-4 py-2 rounded bg-slate-600 border border-slate-500 text-white"
                placeholder="Bloomberg, Reuters, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Relevancia (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.relevancy_score}
                onChange={(e) =>
                  setFormData({ ...formData, relevancy_score: e.target.value })
                }
                className="w-full px-4 py-2 rounded bg-slate-600 border border-slate-500 text-white"
                placeholder="50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Impacto
            </label>
            <select
              value={formData.impact_label}
              onChange={(e) =>
                setFormData({ ...formData, impact_label: e.target.value })
              }
              className="w-full px-4 py-2 rounded bg-slate-600 border border-slate-500 text-white"
            >
              <option value="">Selecciona impacto</option>
              <option value="High">Alto</option>
              <option value="Medium">Medio</option>
              <option value="Low">Bajo</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
            >
              {editingNews ? "Actualizar" : "Crear"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-gray-400">Cargando noticias...</div>
      ) : news.length === 0 ? (
        <div className="text-gray-400">No hay noticias para este instrumento</div>
      ) : (
        <div className="space-y-4">
          {news.map((item) => (
            <div
              key={item.id}
              className="bg-slate-700 p-4 rounded-lg border border-slate-600 space-y-2"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  {item.source && (
                    <p className="text-sm text-gray-400">{item.source}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                  >
                    Borrar
                  </button>
                </div>
              </div>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm"
                >
                  Ver noticia →
                </a>
              )}
              <div className="flex gap-4 text-xs text-gray-400">
                {item.relevancy_score && (
                  <span>Relevancia: {item.relevancy_score}%</span>
                )}
                {item.impact_label && <span>Impacto: {item.impact_label}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
