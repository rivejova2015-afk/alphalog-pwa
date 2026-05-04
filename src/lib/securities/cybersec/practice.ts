import type { PracticeExercise } from "./types";

// Matching exercises. The user drags/clicks each `s` (statement) onto one of `opts` (answers).
export const PRACTICE: PracticeExercise[] = [
  {
    id: 1,
    lesson: 1,
    title: "Ramas de CyberSec",
    items: [
      { s: "Simular ataques", a: "Red Team" },
      { s: "Monitorear amenazas", a: "Blue Team" },
      { s: "Investigar post-incidente", a: "Forense Digital" },
      { s: "Compliance y riesgos", a: "GRC" },
      { s: "Seguridad en desarrollo", a: "DevSecOps" },
    ],
    opts: ["Red Team", "Blue Team", "Forense Digital", "GRC", "DevSecOps"],
  },
  {
    id: 2,
    lesson: 2,
    title: "Clasifica por CIA",
    items: [
      { s: "Hacker lee emails sin cifrar", a: "Confidencialidad" },
      { s: "Ransomware cifra archivos", a: "Disponibilidad" },
      { s: "Modifican notas en la DB", a: "Integridad" },
      { s: "DDoS tumba la web", a: "Disponibilidad" },
      { s: "Virus corrompe backups", a: "Integridad" },
    ],
    opts: ["Confidencialidad", "Integridad", "Disponibilidad"],
  },
  {
    id: 3,
    lesson: 3,
    title: "Identifica el Malware",
    items: [
      { s: "Se adjunta a PDF, necesita click", a: "Virus" },
      { s: "Se propaga solo por la red", a: "Gusano" },
      { s: "Parece un juego legítimo", a: "Troyano" },
      { s: "Cifra archivos y pide Bitcoin", a: "Ransomware" },
      { s: "Se oculta a nivel del kernel", a: "Rootkit" },
    ],
    opts: ["Virus", "Gusano", "Troyano", "Ransomware", "Rootkit"],
  },
  {
    id: 4,
    lesson: 5,
    title: "Capas OSI y Ataques",
    items: [
      { s: "SQL Injection", a: "Capa 7" },
      { s: "SYN Flood", a: "Capa 4" },
      { s: "ARP Poisoning", a: "Capa 2" },
      { s: "IP Spoofing", a: "Capa 3" },
      { s: "Wiretapping", a: "Capa 1" },
    ],
    opts: ["Capa 1", "Capa 2", "Capa 3", "Capa 4", "Capa 7"],
  },
  {
    id: 5,
    lesson: 6,
    title: "Protocolos → Puertos",
    items: [
      { s: "SSH", a: "22" },
      { s: "HTTP", a: "80" },
      { s: "HTTPS", a: "443" },
      { s: "DNS", a: "53" },
      { s: "FTP", a: "21" },
      { s: "SMB", a: "445" },
      { s: "RDP", a: "3389" },
    ],
    opts: ["21", "22", "53", "80", "443", "445", "3389"],
  },
  {
    id: 6,
    lesson: 9,
    title: "Python: Librería → Uso",
    items: [
      { s: "Manipular paquetes de red", a: "scapy" },
      { s: "HTTP requests", a: "requests" },
      { s: "Protocolos Windows", a: "impacket" },
      { s: "Cifrado", a: "pycryptodome" },
      { s: "Forense de memoria", a: "volatility3" },
    ],
    opts: ["scapy", "requests", "impacket", "pycryptodome", "volatility3"],
  },
  {
    id: 7,
    lesson: 11,
    title: "SQL: Tipo de Ataque",
    items: [
      { s: "' OR 1=1 --", a: "Basic SQLi" },
      { s: "' UNION SELECT ...", a: "UNION-based" },
      { s: "' AND IF(1=1,SLEEP(5),0)", a: "Time-based blind" },
      { s: "' AND SUBSTRING(...)='a'", a: "Boolean blind" },
    ],
    opts: ["Basic SQLi", "UNION-based", "Time-based blind", "Boolean blind"],
  },
];

export function getPractice(id: number): PracticeExercise | undefined {
  return PRACTICE.find((p) => p.id === id);
}
