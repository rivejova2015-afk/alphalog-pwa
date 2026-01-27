// src/components/terminal/CalendarPanel.client.tsx
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

interface CalendarEvent {
  id: string;
  name: string;
  impact?: string;
  timestamp_utc: string;
}

export default function CalendarPanel() {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    impact: "",
    timestamp_utc: "",
  });
  const [error, setError] = useState<string>("");

  // Auto-refresh para instruments (60 segundos)
  const {
    data: instrumentsRaw,
    isLoading: instrumentsLoading,
    error: instrumentsError,
    missingTable: instrumentsMissingTable,
    refresh: refreshInstruments,
  } = useAutoRefresh<Instrument[]>({
    key: "CalendarPanel:instruments",
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
      logError("CalendarPanel", {
        component: "CalendarPanel",
        action: "fetch instruments",
        endpoint: "/api/terminal/instruments",
        message: err.message,
        error: err.stack,
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

  // Fetch events when instrument changes
  useEffect(() => {
    if (selectedInstrumentId) {
      fetchEvents();
    }
  }, [selectedInstrumentId]);

  const fetchEvents = useCallback(async () => {
    if (!selectedInstrumentId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/terminal/events?instrumentId=${selectedInstrumentId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: No se pudieron cargar eventos`);
      }
      const data = await response.json();
      // Normaliza y valida que sea array
      const eventsList = normalizeListResponse<CalendarEvent>(data);
      // Sort by timestamp_utc ascending (nearest first)
      setEvents(
        eventsList.sort(
          (a: CalendarEvent, b: CalendarEvent) =>
            new Date(a.timestamp_utc).getTime() -
            new Date(b.timestamp_utc).getTime()
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      logError("CalendarPanel", {
        component: "CalendarPanel",
        action: "fetch events",
        endpoint: `/api/terminal/events?instrumentId=${selectedInstrumentId}`,
        message,
      });
      setEvents([]); // Empty state en error
    } finally {
      setLoading(false);
    }
  }, [selectedInstrumentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrumentId || !formData.name.trim() || !formData.timestamp_utc) {
      setError("Por favor completa los campos obligatorios");
      return;
    }

    const payload = {
      instrumentId: selectedInstrumentId,
      name: formData.name,
      impact: formData.impact || null,
      timestamp_utc: formData.timestamp_utc,
    };

    try {
      const method = editingEvent ? "PATCH" : "POST";
      const url = editingEvent
        ? `/api/terminal/events/${editingEvent.id}`
        : "/api/terminal/events";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Error al guardar evento");
        return;
      }

      resetForm();
      await fetchEvents();
    } catch (err) {
      console.error("Error:", err);
      setError("Error al guardar evento");
    }
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      impact: event.impact || "",
      timestamp_utc: event.timestamp_utc.slice(0, 16), // Format for datetime-local input
    });
    setShowForm(true);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("¿Estás seguro de eliminar este evento?")) {
      return;
    }

    try {
      await fetch(`/api/terminal/events/${eventId}`, { method: "DELETE" });
      await fetchEvents();
    } catch (err) {
      console.error("Error deleting event:", err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      impact: "",
      timestamp_utc: "",
    });
    setEditingEvent(null);
    setShowForm(false);
    setError("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-ES");
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
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Instrumento (obligatorio)
          </label>
          <select
            value={selectedInstrumentId}
            onChange={(e) => setSelectedInstrumentId(e.target.value)}
            className="w-full px-4 py-2 rounded bg-slate-900/60 border border-slate-700/60 text-slate-100"
          >
            {instruments.length === 0 ? (
              <option disabled>Cargando instrumentos...</option>
            ) : (
              instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.display_name}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-slate-950 font-medium shadow-[0_10px_22px_rgba(2,4,10,0.35)] transition"
        >
          {showForm ? "Cancelar" : "+ Nuevo Evento"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 p-6 rounded-2xl border border-slate-700/60 space-y-4 shadow-[0_18px_40px_rgba(2,4,10,0.45)]"
        >
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Nombre del evento (obligatorio)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              placeholder="Ej: Earnings release, FOMC meeting"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Fecha y hora (obligatorio, UTC)
            </label>
            <input
              type="datetime-local"
              value={formData.timestamp_utc}
              onChange={(e) =>
                setFormData({ ...formData, timestamp_utc: e.target.value })
              }
              className="w-full px-4 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Impacto esperado
            </label>
            <select
              value={formData.impact}
              onChange={(e) =>
                setFormData({ ...formData, impact: e.target.value })
              }
              className="w-full px-4 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
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
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-full text-slate-50 font-medium transition"
            >
              {editingEvent ? "Actualizar" : "Crear"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 px-4 py-2 rounded-full bg-slate-800/80 text-slate-200 font-medium transition hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-slate-400">Cargando eventos...</div>
      ) : events.length === 0 ? (
        <div className="text-slate-400">No hay eventos para este instrumento</div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-slate-900/70 p-4 rounded-2xl border border-slate-700/60 flex justify-between items-start shadow-[0_16px_36px_rgba(2,4,10,0.4)]"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-white">{event.name}</h3>
                <p className="text-sm text-slate-400">{formatDate(event.timestamp_utc)}</p>
                {event.impact && (
                  <p className="text-sm text-slate-300 mt-1">
                    Impacto: <span className="font-medium">{event.impact}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(event)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-full text-slate-950 text-sm font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-full text-white text-sm font-medium"
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
