import { describe, it, expect } from "vitest";
import { EXAM, EXAM_PASS_RATIO } from "../exam";
import { HW, getHomework, HW_TOTAL_POINTS } from "../homework";
import { LESSONS, getLesson, lessonsForModule } from "../lessons";
import { QUIZZES } from "../quizzes";
import { PRACTICE } from "../practice";
import { tokenizeInline, splitLines } from "../markdown";

// ─── EXAM content ────────────────────────────────────────────────────────────

describe("EXAM data", () => {
  it("contiene al menos 30 preguntas (final exam)", () => {
    expect(EXAM.length).toBeGreaterThanOrEqual(30);
  });

  it("cada pregunta tiene q, o[], c válido", () => {
    for (const q of EXAM) {
      expect(typeof q.q).toBe("string");
      expect(q.q.length).toBeGreaterThan(0);
      expect(Array.isArray(q.o)).toBe(true);
      expect(q.o.length).toBeGreaterThan(1);
      expect(typeof q.c).toBe("number");
      expect(q.c).toBeGreaterThanOrEqual(0);
      expect(q.c).toBeLessThan(q.o.length);
    }
  });

  it("EXAM_PASS_RATIO = 0.7 (70%)", () => {
    expect(EXAM_PASS_RATIO).toBe(0.7);
  });

  it("ningún q es duplicado", () => {
    const qs = EXAM.map((q) => q.q);
    const unique = new Set(qs);
    expect(unique.size).toBe(qs.length);
  });
});

// ─── HOMEWORK ────────────────────────────────────────────────────────────────

describe("HOMEWORK data + getHomework", () => {
  it("contiene 18 assignments", () => {
    expect(HW).toHaveLength(18);
  });

  it("cada homework tiene id único + campos obligatorios", () => {
    const ids = new Set<number>();
    for (const h of HW) {
      expect(h.id).toBeGreaterThan(0);
      expect(ids.has(h.id)).toBe(false);
      ids.add(h.id);
      expect(h.l).toBeGreaterThan(0); // lesson id
      expect(h.t.length).toBeGreaterThan(0); // title
      expect(["research", "practical", "reflection", "code"]).toContain(h.tp);
      expect(h.pts).toBeGreaterThan(0);
      expect(h.d.length).toBeGreaterThan(10); // description meaningful
    }
  });

  it("getHomework(id) retorna el homework correcto", () => {
    const h1 = getHomework(1);
    expect(h1).toBeDefined();
    expect(h1?.id).toBe(1);
  });

  it("getHomework con id inexistente retorna undefined", () => {
    expect(getHomework(9999)).toBeUndefined();
    expect(getHomework(-1)).toBeUndefined();
  });

  it("HW_TOTAL_POINTS = suma de todos los pts", () => {
    const expected = HW.reduce((sum, h) => sum + h.pts, 0);
    expect(HW_TOTAL_POINTS).toBe(expected);
    expect(HW_TOTAL_POINTS).toBeGreaterThan(0);
  });
});

// ─── LESSONS ─────────────────────────────────────────────────────────────────

describe("LESSONS data + helpers", () => {
  it("contiene al menos 12 lecciones (per CLAUDE.md spec)", () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(12);
  });

  it("cada lección tiene id, title, sub (module), dur, diff, sections", () => {
    const ids = new Set<number>();
    for (const lesson of LESSONS) {
      expect(lesson.id).toBeGreaterThan(0);
      expect(ids.has(lesson.id)).toBe(false);
      ids.add(lesson.id);
      expect(lesson.title.length).toBeGreaterThan(0);
      expect(lesson.sub).toMatch(/^M\d+/); // M1, M2, etc
      expect(lesson.dur.length).toBeGreaterThan(0);
      expect(lesson.diff.length).toBeGreaterThan(0);
      expect(Array.isArray(lesson.sections)).toBe(true);
      expect(lesson.sections.length).toBeGreaterThan(0);
    }
  });

  it("cada section de cada lección tiene h (heading) + c (content)", () => {
    for (const lesson of LESSONS) {
      for (const s of lesson.sections) {
        expect(s.h.length).toBeGreaterThan(0);
        expect(s.c.length).toBeGreaterThan(0);
      }
    }
  });

  it("getLesson(id) retorna la lesson correcta", () => {
    const first = LESSONS[0];
    expect(getLesson(first.id)?.title).toBe(first.title);
  });

  it("getLesson con id inexistente retorna undefined", () => {
    expect(getLesson(9999)).toBeUndefined();
  });

  it("lessonsForModule(N) filtra correctamente por sub='MN'", () => {
    const m1Lessons = lessonsForModule(1);
    expect(m1Lessons.length).toBeGreaterThan(0);
    expect(m1Lessons.every((l) => l.sub.startsWith("M1"))).toBe(true);
  });

  it("lessonsForModule con módulo inexistente retorna []", () => {
    expect(lessonsForModule(999)).toEqual([]);
  });
});

// ─── QUIZZES ↔ LESSONS integrity ─────────────────────────────────────────────

describe("QUIZZES integridad", () => {
  it("cada lección tiene un quiz con preguntas válidas", () => {
    for (const lesson of LESSONS) {
      const quiz = QUIZZES[lesson.id];
      expect(quiz, `lección ${lesson.id} (${lesson.sub}) sin quiz`).toBeDefined();
      expect(quiz.length).toBeGreaterThan(0);
      for (const q of quiz) {
        expect(q.q.length).toBeGreaterThan(0);
        expect(q.o.length).toBeGreaterThan(1);
        expect(q.c).toBeGreaterThanOrEqual(0);
        expect(q.c).toBeLessThan(q.o.length);
        expect(q.e.length).toBeGreaterThan(0);
      }
    }
  });

  it("cada key de QUIZZES corresponde a una lección existente", () => {
    const lessonIds = new Set(LESSONS.map((l) => l.id));
    for (const key of Object.keys(QUIZZES)) {
      expect(lessonIds.has(Number(key))).toBe(true);
    }
  });
});

// ─── PRACTICE integrity ──────────────────────────────────────────────────────

describe("PRACTICE integridad", () => {
  it("cada item tiene su respuesta dentro de opts", () => {
    for (const ex of PRACTICE) {
      expect(ex.items.length).toBeGreaterThan(0);
      expect(ex.opts.length).toBeGreaterThan(0);
      for (const it of ex.items) {
        expect(ex.opts, `ejercicio ${ex.id}: respuesta '${it.a}' no está en opts`).toContain(it.a);
      }
    }
  });

  it("cada ejercicio referencia una lección existente", () => {
    const lessonIds = new Set(LESSONS.map((l) => l.id));
    for (const ex of PRACTICE) {
      expect(lessonIds.has(ex.lesson), `ejercicio ${ex.id} → lección ${ex.lesson} inexistente`).toBe(true);
    }
  });
});

// ─── markdown helpers ────────────────────────────────────────────────────────

describe("tokenizeInline", () => {
  it("texto sin bold → 1 token plain", () => {
    expect(tokenizeInline("Hola mundo")).toEqual([{ t: "Hola mundo", b: false }]);
  });

  it("texto con **bold** → 3 tokens (plain, bold, plain)", () => {
    expect(tokenizeInline("Hola **mundo** y")).toEqual([
      { t: "Hola ", b: false },
      { t: "mundo", b: true },
      { t: " y", b: false },
    ]);
  });

  it("solo bold → 1 token bold", () => {
    expect(tokenizeInline("**solo**")).toEqual([{ t: "solo", b: true }]);
  });

  it("múltiples bolds", () => {
    const r = tokenizeInline("**a** y **b**");
    expect(r.filter((t) => t.b).map((t) => t.t)).toEqual(["a", "b"]);
  });

  it("string vacío → 1 token vacío", () => {
    expect(tokenizeInline("")).toEqual([{ t: "", b: false }]);
  });

  it("bold no cerrado se trata como texto plano", () => {
    expect(tokenizeInline("**not closed")).toEqual([{ t: "**not closed", b: false }]);
  });
});

describe("splitLines", () => {
  it("split por \\n y filtra vacías", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("filtra líneas vacías", () => {
    expect(splitLines("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
  });

  it("acepta \\r\\n (Windows line endings)", () => {
    expect(splitLines("a\r\nb")).toEqual(["a", "b"]);
  });

  it("string vacío → []", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("solo whitespace conserva líneas (no se filtran)", () => {
    // splitLines sólo filtra .length===0, no whitespace-only
    expect(splitLines(" \n  \nx")).toEqual([" ", "  ", "x"]);
  });
});
