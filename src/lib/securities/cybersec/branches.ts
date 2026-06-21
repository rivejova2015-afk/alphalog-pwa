// Ramas del campo de la ciberseguridad. Cada una enlaza a un track de certificación
// (ver certifications.ts) para que el usuario salte al roadmap correspondiente.

import type { FieldBranch } from "./types";

export const BRANCHES: FieldBranch[] = [
  {
    id: 1,
    module: 1,
    name: "Red Team / Ofensiva",
    color: "#ef4444",
    summary: "Simula adversarios reales: pentesting, explotación y red teaming para encontrar fallos antes que el atacante.",
    roles: ["Pentester", "Red Teamer", "Exploit Developer"],
    skills: ["Explotación", "Active Directory", "Scripting (Python/Bash)", "Evasión"],
    tools: ["Burp Suite", "Metasploit", "Cobalt Strike", "nmap"],
    track: "offensive",
  },
  {
    id: 2,
    module: 1,
    name: "Blue Team (SOC & IR)",
    color: "#22d3ee",
    summary: "Defiende y vigila: detección, monitorización y respuesta a incidentes en tiempo real.",
    roles: ["Analista SOC", "Incident Responder", "Threat Hunter"],
    skills: ["Análisis de logs", "Detección", "Respuesta a incidentes", "MITRE ATT&CK"],
    tools: ["SIEM (Splunk/ELK)", "EDR", "Sigma", "Wireshark"],
    track: "defensive",
  },
  {
    id: 3,
    module: 1,
    name: "Forense Digital (DFIR)",
    color: "#a78bfa",
    summary: "Investiga lo que pasó: adquisición y análisis de evidencias de disco, memoria, red y malware.",
    roles: ["Analista forense", "Malware Analyst", "DFIR Consultant"],
    skills: ["Forense de disco/memoria", "Cadena de custodia", "Reversing", "Timeline analysis"],
    tools: ["Autopsy", "Volatility", "FTK", "YARA"],
    track: "dfir",
  },
  {
    id: 4,
    module: 1,
    name: "AppSec / Seguridad Web",
    color: "#34d399",
    summary: "Construye y rompe aplicaciones de forma segura: desarrollo seguro y pruebas de seguridad de software.",
    roles: ["AppSec Engineer", "Pentester web", "DevSecOps"],
    skills: ["OWASP Top 10", "Revisión de código", "SAST/DAST", "Modelado de amenazas"],
    tools: ["Burp Suite", "OWASP ZAP", "Semgrep", "Snyk"],
    track: "appsec",
  },
  {
    id: 5,
    module: 1,
    name: "Cloud Security",
    color: "#60a5fa",
    summary: "Asegura infraestructura en la nube: AWS/Azure/GCP, contenedores y arquitectura cloud.",
    roles: ["Cloud Security Engineer", "Cloud Architect"],
    skills: ["IAM", "Hardening cloud", "Contenedores/K8s", "Infra as Code"],
    tools: ["Prowler", "ScoutSuite", "Trivy", "Terraform"],
    track: "cloud",
  },
  {
    id: 6,
    module: 1,
    name: "GRC / Auditoría",
    color: "#eab308",
    summary: "Gobierna el riesgo: gobernanza, cumplimiento, auditoría y arquitectura de seguridad.",
    roles: ["Analista GRC", "Auditor", "Security Architect"],
    skills: ["Gestión de riesgos", "ISO 27001", "NIST CSF", "Cumplimiento"],
    tools: ["Matrices de riesgo", "GRC platforms", "Frameworks (NIST/ISO)"],
    track: "grc",
  },
  {
    id: 7,
    module: 1,
    name: "Redes & Sistemas",
    color: "#f59e0b",
    summary: "La base de todo: infraestructura segura de redes, sistemas y operaciones.",
    roles: ["Administrador de redes/sistemas", "Network Security Engineer"],
    skills: ["TCP/IP", "Firewalls", "Hardening de SO", "Segmentación"],
    tools: ["Wireshark", "pfSense", "Linux/Windows Server"],
    track: "infra",
  },
  {
    id: 8,
    module: 1,
    name: "Generalista / Fundamentos",
    color: "#94a3b8",
    summary: "Punto de partida transversal antes de especializarte: bases de seguridad, redes y conceptos clave.",
    roles: ["Analista de seguridad junior", "IT Security"],
    skills: ["Tríada CIA", "Fundamentos de red", "Conceptos de amenazas"],
    tools: ["Security+", "Conceptos base"],
    track: "foundations",
  },
];

export function branchesByModule(moduleId: number): FieldBranch[] {
  return BRANCHES.filter((b) => b.module === moduleId);
}
