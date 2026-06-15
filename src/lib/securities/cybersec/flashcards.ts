// Flashcards para repaso activo (active recall). Independientes de las lecciones:
// term (front) → definición (back), agrupadas por categoría del syllabus.
export interface Flashcard {
  id: number;
  cat: string;
  front: string;
  back: string;
}

export const FLASHCARDS: Flashcard[] = [
  // Fundamentos
  { id: 1, cat: "Fundamentos", front: "Tríada CIA", back: "Confidencialidad, Integridad y Disponibilidad — los 3 pilares de la seguridad." },
  { id: 2, cat: "Fundamentos", front: "Zero Trust", back: "Never trust, always verify. No confiar en nada dentro ni fuera de la red." },
  { id: 3, cat: "Fundamentos", front: "Cyber Kill Chain", back: "7 fases de un ataque: Recon, Weaponization, Delivery, Exploitation, Installation, C2, Actions." },
  { id: 4, cat: "Fundamentos", front: "MITRE ATT&CK", back: "Framework que cataloga las TTPs (tácticas, técnicas y procedimientos) de los atacantes." },
  // Redes
  { id: 5, cat: "Redes", front: "Modelo OSI", back: "7 capas: Física, Enlace, Red, Transporte, Sesión, Presentación, Aplicación." },
  { id: 6, cat: "Redes", front: "TCP vs UDP", back: "TCP: fiable, con handshake. UDP: rápido, sin garantía de entrega." },
  { id: 7, cat: "Redes", front: "WPA3 / SAE", back: "Estándar WiFi moderno con handshake Dragonfly y forward secrecy." },
  { id: 8, cat: "Redes", front: "NAT", back: "Traduce IPs privadas a una IP pública para salir a Internet." },
  // Sistemas
  { id: 9, cat: "Sistemas", front: "Bit SUID", back: "Hace que un binario corra con permisos del dueño; si es root y es explotable, hay escalada." },
  { id: 10, cat: "Sistemas", front: "Kerberoasting", back: "Ataque a AD: pedís el TGS de una cuenta de servicio (SPN) y crackeás su hash offline." },
  { id: 11, cat: "Sistemas", front: "Event ID 4625", back: "Windows: registra un logon fallido (indicador de brute force)." },
  { id: 12, cat: "Sistemas", front: "Golden Ticket", back: "Forjar TGTs válidos con el hash de la cuenta krbtgt → persistencia total en el dominio." },
  // Criptografía
  { id: 13, cat: "Criptografía", front: "AES-GCM", back: "Cifrado simétrico AEAD: cifra y autentica (detecta manipulación)." },
  { id: 14, cat: "Criptografía", front: "Salt", back: "Valor aleatorio único por usuario que frustra rainbow tables al hashear passwords." },
  { id: 15, cat: "Criptografía", front: "PKI / CA", back: "Infraestructura de clave pública; la Certificate Authority emite y firma certificados." },
  { id: 16, cat: "Criptografía", front: "Forward secrecy", back: "Aunque se filtre la clave privada, las sesiones pasadas no se pueden descifrar (ECDHE)." },
  // Web Security
  { id: 17, cat: "Web Security", front: "CSP", back: "Content-Security-Policy: controla qué scripts/recursos cargan → mitiga XSS." },
  { id: 18, cat: "Web Security", front: "IDOR", back: "Insecure Direct Object Reference: acceder a objetos ajenos cambiando un identificador." },
  { id: 19, cat: "Web Security", front: "SSRF", back: "Forzar al servidor a pedir URLs internas o metadata cloud (169.254.169.254)." },
  { id: 20, cat: "Web Security", front: "Prepared statements", back: "Consultas parametrizadas que separan datos de código SQL → previenen SQL Injection." },
  // Pentesting
  { id: 21, cat: "Pentesting", front: "Nmap -sV", back: "Detecta la versión de los servicios (clave para buscar CVEs)." },
  { id: 22, cat: "Pentesting", front: "Meterpreter", back: "Payload avanzado de Metasploit que corre en memoria con capacidades de post-explotación." },
  { id: 23, cat: "Pentesting", front: "Pass-the-Hash", back: "Autenticarse con el hash NTLM sin conocer la contraseña en texto." },
  { id: 24, cat: "Pentesting", front: "Pivoting", back: "Usar un host comprometido como trampolín para alcanzar redes internas." },
  // Social Eng.
  { id: 25, cat: "Social Eng.", front: "BEC", back: "Business Email Compromise: suplantar a un directivo para ordenar transferencias fraudulentas." },
  { id: 26, cat: "Social Eng.", front: "SPF/DKIM/DMARC", back: "Mecanismos de autenticación de email que frenan el spoofing del remitente." },
  // Malware
  { id: 27, cat: "Malware", front: "YARA", back: "Reglas para identificar malware por patrones (strings, bytes, condiciones)." },
  { id: 28, cat: "Malware", front: "Análisis estático vs dinámico", back: "Estático: examinar sin ejecutar. Dinámico: ejecutar en sandbox y observar el comportamiento." },
  { id: 29, cat: "Malware", front: "Packer", back: "Comprime/cifra el código del malware para evadir análisis (UPX, Themida)." },
  // Forense
  { id: 30, cat: "Forense", front: "Cadena de custodia", back: "Registro de quién tocó la evidencia, cuándo y dónde; si se rompe, se invalida en la corte." },
  { id: 31, cat: "Forense", front: "Orden de volatilidad", back: "Capturar de lo más volátil (RAM) a lo más persistente (disco/backups)." },
  { id: 32, cat: "Forense", front: "Volatility", back: "Framework de forense de memoria (RAM): pslist, netscan, malfind." },
  { id: 33, cat: "Forense", front: "Beaconing", back: "Conexiones periódicas y regulares a un destino → indicio de C2." },
  // Blue Team
  { id: 34, cat: "Blue Team", front: "SIEM", back: "Centraliza y correlaciona logs, y alerta. Es el corazón del SOC." },
  { id: 35, cat: "Blue Team", front: "Ciclo IR (NIST 800-61)", back: "Preparación → Detección/Análisis → Contención/Erradicación/Recuperación → Post-incidente." },
  { id: 36, cat: "Blue Team", front: "Threat Hunting", back: "Búsqueda proactiva del atacante (hypothesis-driven), sin esperar una alerta." },
  { id: 37, cat: "Blue Team", front: "SOAR", back: "Automatiza la respuesta (aislar host, bloquear IP) para reducir el tiempo de respuesta (MTTR)." },
  // Cloud
  { id: 38, cat: "Cloud", front: "Responsabilidad compartida", back: "El proveedor asegura la nube; el cliente asegura EN la nube (IAM, datos, config)." },
  { id: 39, cat: "Cloud", front: "S3 público", back: "Bucket expuesto por error: la causa #1 de brechas en cloud." },
  { id: 40, cat: "Cloud", front: "Trivy", back: "Escáner de imágenes de contenedores (vulnerabilidades, misconfigs, secrets)." },
  { id: 41, cat: "Cloud", front: "CSPM", back: "Cloud Security Posture Management: detecta misconfigs en multi-cloud de forma continua." },
  // Especializado / Programación
  { id: 42, cat: "Especializado", front: "Mirai", back: "Botnet (2016) que se propagó usando dispositivos IoT con credenciales por defecto." },
  { id: 43, cat: "Especializado", front: "binwalk", back: "Extrae el filesystem de una imagen de firmware para análisis IoT." },
  { id: 44, cat: "Programación", front: "scapy", back: "Librería de Python para crear, enviar y analizar paquetes de red." },
  { id: 45, cat: "Programación", front: "Validación client-side", back: "Mejora la UX pero NO es seguridad: toda validación de seguridad ocurre en el servidor." },
];

export const FLASHCARD_CATEGORIES = Array.from(new Set(FLASHCARDS.map((c) => c.cat)));

export function flashcardsByCategory(cat: string): Flashcard[] {
  return FLASHCARDS.filter((c) => c.cat === cat);
}
