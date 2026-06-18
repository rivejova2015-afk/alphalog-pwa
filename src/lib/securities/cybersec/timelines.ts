// Línea de tiempo de hitos de la ciberseguridad. Eventos ordenados por año.

import type { HistoryTimeline } from "./types";

export const TIMELINES: HistoryTimeline[] = [
  {
    id: 1,
    module: 1,
    title: "Historia y evolución de la ciberseguridad",
    events: [
      { year: 1971, title: "Creeper", desc: "Primer programa autorreplicante conocido en ARPANET; nace el antivirus Reaper para eliminarlo.", impact: "low" },
      { year: 1988, title: "Gusano de Morris", desc: "Primer gusano masivo de Internet; infectó ~10% de los hosts y motivó la creación del primer CERT.", impact: "high" },
      { year: 2000, title: "ILOVEYOU", desc: "Gusano de correo que causó miles de millones en daños; popularizó el malware por ingeniería social.", impact: "high" },
      { year: 2010, title: "Stuxnet", desc: "Primer ciberarma conocida; saboteó centrifugadoras nucleares iraníes. Inaugura la era del malware patrocinado por estados.", impact: "high" },
      { year: 2013, title: "Filtraciones de Snowden", desc: "Revelan programas de vigilancia masiva; impulsan el cifrado por defecto en toda la industria.", impact: "medium" },
      { year: 2017, title: "WannaCry / NotPetya", desc: "Ransomware que usó el exploit EternalBlue; afectó ~230.000 equipos en 150 países.", impact: "high" },
      { year: 2020, title: "SolarWinds", desc: "Ataque a la cadena de suministro que comprometió a miles de organizaciones vía una actualización troyanizada.", impact: "high" },
      { year: 2021, title: "Log4Shell", desc: "Vulnerabilidad crítica (CVSS 10.0) en Log4j; explotación masiva por su ubicuidad en software Java.", impact: "high" },
      { year: 2023, title: "MOVEit", desc: "Explotación masiva de un zero-day en software de transferencia de archivos; campaña de extorsión a gran escala.", impact: "high" },
      { year: 2024, title: "Era de la IA ofensiva", desc: "Phishing y deepfakes generados por IA elevan la escala y el realismo de los ataques de ingeniería social.", impact: "medium" },
    ],
  },
  {
    id: 2,
    module: 6,
    title: "Evolución de los protocolos de Internet",
    events: [
      { year: 1969, title: "ARPANET (NCP)", desc: "Nace la red precursora de Internet con el protocolo NCP.", impact: "medium" },
      { year: 1983, title: "TCP/IP", desc: "ARPANET adopta TCP/IP como estándar: el 'cumpleaños' de la Internet moderna.", impact: "high" },
      { year: 1983, title: "DNS", desc: "Se introduce el sistema de nombres de dominio; adiós a los archivos hosts manuales.", impact: "high" },
      { year: 1991, title: "HTTP / World Wide Web", desc: "Tim Berners-Lee publica la Web y el protocolo HTTP.", impact: "high" },
      { year: 1995, title: "SSL", desc: "Netscape crea SSL para cifrar el tráfico; base del futuro HTTPS.", impact: "medium" },
      { year: 1999, title: "TLS 1.0", desc: "SSL se estandariza como TLS; evoluciona hasta TLS 1.3 (2018).", impact: "medium" },
      { year: 2021, title: "HTTP/3 (QUIC)", desc: "HTTP sobre QUIC (UDP) reduce latencia y mejora la conexión móvil.", impact: "medium" },
    ],
  },
  {
    id: 3,
    module: 9,
    title: "Evolución de la seguridad WiFi",
    events: [
      { year: 1997, title: "WEP", desc: "Primer cifrado WiFi (RC4); se demostró roto pocos años después.", impact: "high" },
      { year: 2003, title: "WPA", desc: "Solución de transición con TKIP mientras se finalizaba WPA2.", impact: "medium" },
      { year: 2004, title: "WPA2 (802.11i)", desc: "Cifrado AES-CCMP; estándar dominante durante más de una década.", impact: "high" },
      { year: 2017, title: "Ataque KRACK", desc: "Vulnerabilidad en el 4-way handshake de WPA2; impulsó la urgencia de WPA3.", impact: "high" },
      { year: 2018, title: "WPA3", desc: "Introduce SAE (Dragonfly) y PMF obligatorio; frena el cracking offline.", impact: "high" },
    ],
  },
];

export function timelinesByModule(moduleId: number): HistoryTimeline[] {
  return TIMELINES.filter((t) => t.module === moduleId);
}
