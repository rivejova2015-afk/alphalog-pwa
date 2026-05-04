import type { Homework } from "./types";

// 10 assignments. `tp` (type) controls the deliverable kind: research = essay,
// practical = build/test something, reflection = personal essay, code = source.
export const HW: Homework[] = [
  { id: 1, l: 1, t: "Caso Real de Brecha", tp: "research", pts: 25, d: "Investiga Equifax 2017, SolarWinds 2020, o Colonial Pipeline 2021: vulnerabilidad, CIA violados, impacto, prevención." },
  { id: 2, l: 2, t: "Defensa en Profundidad", tp: "practical", pts: 30, d: "Como CISO de fintech: diseña 1+ control por capa. Justifica cada elección." },
  { id: 3, l: 3, t: "Superficie de Ataque Personal", tp: "reflection", pts: 20, d: "Lista tus dispositivos/cuentas. 5+ vectores de ataque con tipo, malware probable y protección." },
  { id: 4, l: 5, t: "Diagrama OSI Completo", tp: "practical", pts: 25, d: "Diagrama OSI: función, PDU, protocolos, dispositivos y 2+ ataques por capa." },
  { id: 5, l: 6, t: "Análisis de Protocolo", tp: "research", pts: 25, d: "Elige DNS, SMTP o FTP: funcionamiento paso a paso, puertos, vulnerabilidades y hardening." },
  { id: 6, l: 7, t: "Diseño de Red Segura", tp: "practical", pts: 30, d: "Red empresarial 200 empleados: subnetting, DMZ, segmentación, NAT, justificación." },
  { id: 7, l: 9, t: "Port Scanner en Python", tp: "code", pts: 35, d: "Escribe en Python: (1) port scanner con sockets, (2) ping sweep, (3) HTTP header grabber. Documenta código." },
  { id: 8, l: 10, t: "XSS Lab Report", tp: "practical", pts: 30, d: "Documenta 5 tipos de XSS: payload, contexto donde funciona, impacto y prevención." },
  { id: 9, l: 11, t: "SQLi Cheat Sheet", tp: "research", pts: 25, d: "Crea cheat sheet de SQLi: 15+ payloads organizados por tipo con explicación de cada uno." },
  { id: 10, l: 12, t: "Buffer Overflow Diagram", tp: "practical", pts: 30, d: "Dibuja el layout del stack. Explica paso a paso cómo un buffer overflow sobrescribe EIP y redirige ejecución." },
];

export function getHomework(id: number): Homework | undefined {
  return HW.find((h) => h.id === id);
}

export const HW_TOTAL_POINTS = HW.reduce((sum, h) => sum + h.pts, 0);
