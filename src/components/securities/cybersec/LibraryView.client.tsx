"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, ExternalLink, FileText, Upload, Trash2, Download, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LIBRARY, LIBRARY_CATEGORIES, type LibraryBook, type LibraryLevel } from "@/lib/securities/cybersec";
import { ConfirmDialog } from "@/components/ui";

interface Upload {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  level: LibraryLevel;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
}

const LEVEL_LABEL: Record<LibraryLevel, string> = { b: "Básico", i: "Intermedio", a: "Avanzado", all: "General" };

function fmtSize(b: number | null): string {
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function LibraryView() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Todas");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadUploads = async () => {
    try {
      const res = await fetch("/api/securities/cybersec/library");
      if (res.ok) setUploads(((await res.json()).uploads ?? []) as Upload[]);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUploads(); }, []);

  const cats = useMemo(() => ["Todas", ...new Set([...LIBRARY_CATEGORIES, ...uploads.map((u) => u.category).filter(Boolean) as string[]])], [uploads]);

  const q = query.trim().toLowerCase();
  const matchBook = (b: LibraryBook) =>
    (cat === "Todas" || b.cat === cat) &&
    (q === "" || `${b.title} ${b.author} ${b.cat} ${b.desc}`.toLowerCase().includes(q));
  const matchUpload = (u: Upload) =>
    (cat === "Todas" || u.category === cat) &&
    (q === "" || `${u.title} ${u.author ?? ""} ${u.category ?? ""} ${u.notes ?? ""}`.toLowerCase().includes(q));

  const books = LIBRARY.filter(matchBook);
  const myBooks = uploads.filter(matchUpload);

  const openUpload = async (id: string) => {
    try {
      const res = await fetch(`/api/securities/cybersec/library/signed-url?id=${id}`);
      const json = await res.json();
      if (res.ok && json.url) window.open(json.url as string, "_blank", "noopener,noreferrer");
      else toast.error(json.error ?? "No se pudo abrir el PDF");
    } catch {
      toast.error("Error de conexión");
    }
  };

  const deleteUpload = async (id: string) => {
    setConfirmId(null);
    const prev = uploads;
    setUploads((u) => u.filter((x) => x.id !== id)); // optimista
    try {
      const res = await fetch(`/api/securities/cybersec/library/${id}`, { method: "DELETE" });
      if (!res.ok) { setUploads(prev); toast.error("No se pudo eliminar"); }
      else toast.success("PDF eliminado");
    } catch {
      setUploads(prev);
      toast.error("Error de conexión");
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold text-[#e2e8f0] font-mono">
          <BookOpen size={20} className="text-[#22d3ee]" /> Biblioteca
        </h1>
        <p className="text-sm text-[#94a3b8]">Recursos gratuitos en español + tus propios PDFs, ligados a los cursos.</p>
      </header>

      {/* Buscar + filtro por categoría */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, autor o tema…"
            aria-label="Buscar en la biblioteca"
            className="w-full rounded-lg border border-[#1f2937] bg-[#0a0e1a] pl-9 pr-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#22d3ee]/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                cat === c ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]" : "bg-[#0a0e1a] border-[#1f2937] text-[#94a3b8] hover:bg-[#151b28]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <UploadForm categories={LIBRARY_CATEGORIES} onUploaded={() => void loadUploads()} />

      {/* Mis PDFs */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#a78bfa] font-bold">Mis PDFs</h2>
        {loading ? (
          <p className="text-sm text-[#475569] inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
        ) : myBooks.length === 0 ? (
          <p className="text-sm text-[#475569]">{uploads.length === 0 ? "Todavía no subiste ningún PDF." : "Ninguno coincide con el filtro."}</p>
        ) : (
          <ul className="space-y-2">
            {myBooks.map((u) => (
              <li key={u.id} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#e2e8f0] truncate flex items-center gap-1.5"><FileText size={13} className="text-[#34d399] shrink-0" /> {u.title}</p>
                    <p className="text-[11px] text-[#94a3b8] mt-0.5">
                      {[u.author, u.category, LEVEL_LABEL[u.level], fmtSize(u.size_bytes)].filter(Boolean).join(" · ")}
                    </p>
                    {u.notes && <p className="text-[11px] text-[#475569] mt-1">{u.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => void openUpload(u.id)} title="Abrir / descargar" className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-[#22d3ee]/40 text-[#22d3ee] hover:bg-[#22d3ee]/10">
                      <Download size={12} /> Abrir
                    </button>
                    <button onClick={() => setConfirmId(u.id)} title="Eliminar" aria-label={`Eliminar ${u.title}`} className="inline-flex items-center px-2 py-1 rounded text-[11px] border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Catálogo curado */}
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#a78bfa] font-bold">Catálogo gratuito ({books.length})</h2>
        {books.length === 0 ? (
          <p className="text-sm text-[#475569]">Sin resultados en el catálogo.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {books.map((b) => (
              <li key={b.id} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 flex flex-col">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/30">{b.format}</span>
                  <span className="text-[9px] uppercase tracking-wider text-[#475569]">{b.cat} · {LEVEL_LABEL[b.level]}</span>
                </div>
                <p className="text-sm font-bold text-[#e2e8f0] leading-tight">{b.title}</p>
                <p className="text-[11px] text-[#94a3b8]">{b.author}</p>
                <p className="text-[11px] text-[#475569] mt-1 flex-1">{b.desc}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-[#475569]">{b.license}</span>
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#22d3ee] hover:underline">
                    Abrir <ExternalLink size={11} />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-[#475569]">Solo recursos legalmente distribuibles (open-access, Creative Commons, guías oficiales). Para libros con copyright, subí tu propia copia.</p>
      </section>

      <ConfirmDialog
        open={confirmId !== null}
        title="Eliminar PDF"
        message="¿Eliminar este PDF de tu biblioteca? El archivo se borrará de tu almacenamiento."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => { if (confirmId) void deleteUpload(confirmId); }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

function UploadForm({ categories, onUploaded }: { categories: string[]; onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<LibraryLevel>("all");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(""); setAuthor(""); setCategory(""); setLevel("all"); setNotes(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!file) { toast.error("Elegí un archivo PDF"); return; }
    if (file.type !== "application/pdf") { toast.error("Solo se permiten PDFs"); return; }
    if (!title.trim()) { toast.error("Poné un título"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      if (author.trim()) fd.append("author", author.trim());
      if (category) fd.append("category", category);
      fd.append("level", level);
      if (notes.trim()) fd.append("notes", notes.trim());
      const res = await fetch("/api/securities/cybersec/library", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "No se pudo subir"); return; }
      toast.success("PDF subido");
      reset(); setOpen(false); onUploaded();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm bg-[#a78bfa]/10 border border-[#a78bfa]/40 text-[#a78bfa] hover:bg-[#a78bfa]/20">
        <Upload size={14} /> Subir un PDF
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/5 p-4 space-y-3">
      <p className="text-sm font-bold text-[#e2e8f0]">Subir un PDF propio</p>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.pdf$/i, "")); }}
        className="block w-full text-xs text-[#94a3b8] file:mr-3 file:rounded file:border-0 file:bg-[#22d3ee]/10 file:px-3 file:py-1.5 file:text-[#22d3ee] file:text-xs"
      />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título *" className="w-full rounded border border-[#1f2937] bg-[#0a0e1a] px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569]" />
      <div className="grid grid-cols-2 gap-2">
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Autor" className="rounded border border-[#1f2937] bg-[#0a0e1a] px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569]" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-[#1f2937] bg-[#0a0e1a] px-3 py-2 text-sm text-[#e2e8f0]">
          <option value="">Categoría…</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={level} onChange={(e) => setLevel(e.target.value as LibraryLevel)} className="rounded border border-[#1f2937] bg-[#0a0e1a] px-3 py-2 text-sm text-[#e2e8f0]">
          <option value="all">General</option>
          <option value="b">Básico</option>
          <option value="i">Intermedio</option>
          <option value="a">Avanzado</option>
        </select>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className="rounded border border-[#1f2937] bg-[#0a0e1a] px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569]" />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm bg-[#22d3ee] text-[#0a0e1a] font-bold disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {busy ? "Subiendo…" : "Subir"}
        </button>
        <button onClick={() => { reset(); setOpen(false); }} disabled={busy} className="px-3 py-2 rounded text-sm border border-[#1f2937] text-[#94a3b8] hover:bg-[#151b28]">Cancelar</button>
        <span className="text-[10px] text-[#475569] ml-auto">Máx. 50 MB · solo PDF</span>
      </div>
    </div>
  );
}
