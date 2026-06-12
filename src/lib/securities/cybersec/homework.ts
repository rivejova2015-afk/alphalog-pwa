import type { Homework } from "./types";

// Assignments. `tp` (type) controls the deliverable kind: research = essay,
// practical = build/test something, reflection = personal essay, code = source.
// The first 10 cubren Fundamentos→Programación básica; 11-18 cubren las
// categorías avanzadas (pentesting, AD, malware, forense, blue team, cloud).
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
  { id: 11, l: 18, t: "Writeup de Ataque a AD", tp: "research", pts: 30, d: "Elige Kerberoasting o DCSync: explica paso a paso cómo funciona, qué herramientas se usan, qué evidencia deja (Event IDs) y cómo se defiende una organización." },
  { id: 12, l: 32, t: "CVSS Scoring", tp: "research", pts: 25, d: "Toma 5 CVEs reales de los últimos 2 años y calcula/verifica su CVSS v3.1, explicando cada métrica (AV, AC, PR, UI, S, C, I, A) y por qué priorizarías cada uno." },
  { id: 13, l: 40, t: "Reglas YARA", tp: "code", pts: 30, d: "Escribe 3 reglas YARA para detectar: (1) ransomware por extensión, (2) keylogger por strings, (3) backdoor por comportamiento de red. Documenta cada condición." },
  { id: 14, l: 45, t: "Análisis de PCAP", tp: "practical", pts: 35, d: "Analiza una captura de tráfico (lab/CTF): identifica el protocolo, extrae artefactos con NetworkMiner/Wireshark y documenta indicios de C2 (beaconing, DNS tunneling)." },
  { id: 15, l: 47, t: "IR Playbook de Ransomware", tp: "practical", pts: 35, d: "Crea un playbook de respuesta a incidentes para ransomware: detección, contención, erradicación, recuperación y comunicación (incluye notificación regulatoria)." },
  { id: 16, l: 51, t: "Hardening de un Dockerfile", tp: "code", pts: 30, d: "Toma un Dockerfile inseguro y endurécelo: usuario no-root, imagen mínima, sin secretos, drop capabilities. Escanéalo con Trivy y documenta los hallazgos." },
  { id: 17, l: 49, t: "Auditoría de Misconfigs AWS", tp: "practical", pts: 30, d: "Lista los 5 errores de configuración más comunes en AWS (S3 público, IAM excesivo, SG abiertos, etc.): cómo detectarlos, el riesgo y la remediación." },
  { id: 18, l: 54, t: "Reporte de Pentest Completo", tp: "practical", pts: 40, d: "Realiza una auditoría simulada end-to-end (recon→escaneo→enumeración→explotación) en un lab legal y entrega un reporte profesional con resumen ejecutivo, hallazgos por severidad y remediación." },
];

export function getHomework(id: number): Homework | undefined {
  return HW.find((h) => h.id === id);
}

export const HW_TOTAL_POINTS = HW.reduce((sum, h) => sum + h.pts, 0);
