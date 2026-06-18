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
];

export function timelinesByModule(moduleId: number): HistoryTimeline[] {
  return TIMELINES.filter((t) => t.module === moduleId);
}
