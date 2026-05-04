import type { ExamQuestion } from "./types";

// Final exam — 30 questions distilled across the 12 lessons. Pass threshold: 70%.
// The first 4 are from the original input; questions 5-30 are consolidated from
// the per-lesson quiz pool to keep the exam in sync with the lesson content.
export const EXAM: ExamQuestion[] = [
  { q: "La ciberseg combina:", o: ["HW, SW, FW", "Tecnología, Procesos, Personas", "Ataque, Defensa, Monitoreo"], c: 1 },
  { q: "Ransomware viola:", o: ["Confidencialidad", "Integridad", "Disponibilidad"], c: 2 },
  { q: "Zero Trust:", o: ["Confiar en red interna", "Never trust, always verify", "Solo admin tiene acceso"], c: 1 },
  { q: "Gusano vs virus:", o: ["Iguales", "Gusano se propaga solo", "Virus se propaga solo"], c: 1 },
  { q: "¿Qué equipo simula ataques?", o: ["Blue Team", "Red Team", "SOC"], c: 1 },
  { q: "En el Cyber Kill Chain, ¿qué fase es enviar el exploit?", o: ["Reconnaissance", "Delivery", "Exploitation"], c: 1 },
  { q: "WannaCry afectó:", o: ["10K equipos", "230K+ en 150 países", "1M en 50 países"], c: 1 },
  { q: "DDoS viola:", o: ["Confidencialidad", "Integridad", "Disponibilidad"], c: 2 },
  { q: "MFA combina:", o: ["Dos contraseñas", "2+ tipos de verificación", "Antivirus + firewall"], c: 1 },
  { q: "Menor privilegio:", o: ["Admin para todos", "Solo permisos mínimos necesarios", "Rotar permisos diario"], c: 1 },
  { q: "APT de Corea del Norte:", o: ["APT28", "APT41", "Lazarus Group"], c: 2 },
  { q: "MITRE ATT&CK cataloga:", o: ["Certificaciones", "TTPs de atacantes", "Vulnerabilidades"], c: 1 },
  { q: "Rootkit se caracteriza por:", o: ["Cifrar archivos", "Ocultarse profundamente", "Registrar teclas"], c: 1 },
  { q: "RaaS significa:", o: ["Recovery as a Service", "Ransomware as a Service", "Risk as a Service"], c: 1 },
  { q: "Funciones NIST CSF:", o: ["Atacar, Defender, Reportar, Parchear, Auditar", "Identificar, Proteger, Detectar, Responder, Recuperar", "Planear, Ejecutar, Verificar, Actuar, Mejorar"], c: 1 },
  { q: "Certificación inicial recomendada:", o: ["OSCP", "Security+", "CISSP"], c: 1 },
  { q: "ISO 27001 define:", o: ["Top 10 web vulns", "SGSI", "Reglas de tarjetas"], c: 1 },
  { q: "OSI tiene:", o: ["4", "5", "7"], c: 2 },
  { q: "HTTP opera en capa:", o: ["3", "4", "7"], c: 2 },
  { q: "ARP Poisoning ataca capa:", o: ["1", "2", "4"], c: 1 },
  { q: "TCP vs UDP:", o: ["TCP es más rápido", "UDP garantiza entrega", "TCP garantiza entrega, UDP no"], c: 2 },
  { q: "Puerto 443:", o: ["HTTP", "SSH", "HTTPS"], c: 2 },
  { q: "DNS usa puerto:", o: ["22", "53", "80"], c: 1 },
  { q: "192.168.1.1 es IP:", o: ["Pública", "Privada", "Localhost"], c: 1 },
  { q: "/24 = hosts usables:", o: ["24", "128", "254"], c: 2 },
  { q: "NAT traduce:", o: ["DNS→IP", "IP privada→pública", "MAC→IP"], c: 1 },
  { q: "Wireshark captura:", o: ["Contraseñas", "Paquetes de red", "Malware"], c: 1 },
  { q: "Scapy sirve para:", o: ["Cifrar archivos", "Manipular paquetes de red", "Crear GUIs"], c: 1 },
  { q: "XSS permite inyectar:", o: ["SQL en bases de datos", "JavaScript en páginas web", "Binarios en servidores"], c: 1 },
  { q: "SQL Injection básico:", o: ["<script>alert(1)</script>", "' OR 1=1 --", "sudo rm -rf /"], c: 1 },
  { q: "Buffer overflow sobrescribe:", o: ["El disco duro", "La return address en el stack", "La RAM completa"], c: 1 },
  { q: "ASLR protege contra:", o: ["XSS", "Predicción de direcciones de memoria", "SQL Injection"], c: 1 },
];

export const EXAM_PASS_RATIO = 0.7;
