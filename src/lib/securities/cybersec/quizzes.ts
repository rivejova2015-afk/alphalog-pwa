import type { QuizQuestion, QuizLevel } from "./types";

// Quizzes keyed by lesson id. Each one is short (4-5 questions) so users can
// finish in a couple minutes. `c` is the index of the correct option in `o`.
// NOTA: este mapa es el nivel BÁSICO ('b') de cada lección — back-compat con el
// histórico de antes de los quizzes por nivel (Fase A). Los niveles intermedio
// ('i') y avanzado ('a') viven en QUIZZES_IA y se van autoríando por lotes.
export const QUIZZES: Record<number, QuizQuestion[]> = {
  1: [
    { q: "La ciberseguridad combina:", o: ["HW, SW, Cloud", "Tecnología, Procesos, Personas", "Ataque, Defensa, Análisis"], c: 1, e: "Tecnología + Procesos + Personas." },
    { q: "¿Qué equipo simula ataques?", o: ["Blue Team", "Red Team", "SOC"], c: 1, e: "Red Team = ofensivo." },
    { q: "En el Cyber Kill Chain, ¿qué fase es enviar el exploit?", o: ["Reconnaissance", "Delivery", "Exploitation"], c: 1, e: "Delivery = entregar el payload al objetivo." },
    { q: "WannaCry afectó:", o: ["10K equipos", "230K+ en 150 países", "1M en 50 países"], c: 1, e: "230K+ en 150 países." },
    { q: "DevSecOps integra seguridad en:", o: ["Redes", "Desarrollo de software", "Hardware"], c: 1, e: "DevSecOps = Security en Dev + Ops." },
  ],
  2: [
    { q: "Tríada CIA:", o: ["Cifrado, Internet, Auth", "Confidencialidad, Integridad, Disponibilidad", "Control, Inspección, Análisis"], c: 1, e: "CIA." },
    { q: "DDoS viola:", o: ["Confidencialidad", "Integridad", "Disponibilidad"], c: 2, e: "Impide acceso = disponibilidad." },
    { q: "Zero Trust significa:", o: ["Confiar en red interna", "Never trust, always verify", "Solo confiar en admins"], c: 1, e: "Verificar todo, confiar en nada." },
    { q: "MFA combina:", o: ["Dos contraseñas", "2+ tipos de verificación", "Antivirus + firewall"], c: 1, e: "Factores diferentes." },
    { q: "Menor privilegio:", o: ["Admin para todos", "Solo permisos mínimos necesarios", "Rotar permisos diario"], c: 1, e: "Mínimos permisos." },
  ],
  3: [
    { q: "Gusano vs virus:", o: ["Iguales", "Gusano se propaga solo", "Virus se propaga solo"], c: 1, e: "Gusano no necesita interacción." },
    { q: "APT de Corea del Norte:", o: ["APT28", "APT41", "Lazarus Group"], c: 2, e: "Lazarus = NK." },
    { q: "MITRE ATT&CK cataloga:", o: ["Certificaciones", "TTPs de atacantes", "Vulnerabilidades"], c: 1, e: "Framework de tácticas y técnicas." },
    { q: "Rootkit se caracteriza por:", o: ["Cifrar archivos", "Ocultarse profundamente", "Registrar teclas"], c: 1, e: "Extremadamente difícil de detectar." },
    { q: "RaaS significa:", o: ["Recovery as a Service", "Ransomware as a Service", "Risk as a Service"], c: 1, e: "Modelo de negocio criminal." },
  ],
  4: [
    { q: "Funciones NIST CSF:", o: ["Atacar, Defender, Reportar, Parchear, Auditar", "Identificar, Proteger, Detectar, Responder, Recuperar", "Planear, Ejecutar, Verificar, Actuar, Mejorar"], c: 1, e: "NIST: ID, PR, DE, RS, RC." },
    { q: "Certificación inicial recomendada:", o: ["OSCP", "Security+", "CISSP"], c: 1, e: "Security+ = puerta de entrada." },
    { q: "ISO 27001 define:", o: ["Top 10 web vulns", "SGSI", "Reglas de tarjetas"], c: 1, e: "Sistema de Gestión de SI." },
    { q: "PCI-DSS es para:", o: ["Cloud", "Tarjetas de crédito", "Salud"], c: 1, e: "Payment Card Industry." },
  ],
  5: [
    { q: "OSI tiene:", o: ["4", "5", "7"], c: 2, e: "7 capas." },
    { q: "HTTP opera en capa:", o: ["3", "4", "7"], c: 2, e: "Capa 7 (Aplicación)." },
    { q: "ARP Poisoning ataca capa:", o: ["1", "2", "4"], c: 1, e: "Capa 2 (Enlace)." },
    { q: "SYN Flood ataca capa:", o: ["2", "4", "7"], c: 1, e: "Capa 4 (Transporte)." },
  ],
  6: [
    { q: "TCP vs UDP:", o: ["TCP es más rápido", "UDP garantiza entrega", "TCP garantiza entrega, UDP no"], c: 2, e: "TCP = fiable con handshake." },
    { q: "Puerto 443:", o: ["HTTP", "SSH", "HTTPS"], c: 2, e: "443 = HTTPS." },
    { q: "DNS usa puerto:", o: ["22", "53", "80"], c: 1, e: "DNS = 53." },
    { q: "SMB puerto 445 fue explotado por:", o: ["Heartbleed", "WannaCry", "Log4Shell"], c: 1, e: "EternalBlue → SMBv1." },
  ],
  7: [
    { q: "192.168.1.1 es IP:", o: ["Pública", "Privada", "Localhost"], c: 1, e: "192.168.x.x = privada." },
    { q: "/24 = hosts usables:", o: ["24", "128", "254"], c: 2, e: "2^8 - 2 = 254." },
    { q: "NAT traduce:", o: ["DNS→IP", "IP privada→pública", "MAC→IP"], c: 1, e: "Privada a pública." },
  ],
  8: [
    { q: "Wireshark captura:", o: ["Contraseñas", "Paquetes de red", "Malware"], c: 1, e: "Analizador de protocolos." },
    { q: "Filtro para solo HTTP:", o: ["port 80", "http", "filter:http"], c: 1, e: "Display filter: http" },
    { q: "tcpdump se usa en:", o: ["Windows GUI", "CLI Linux", "Navegador"], c: 1, e: "Línea de comandos." },
  ],
  9: [
    { q: "Python es popular en ciberseg por:", o: ["Es el más rápido", "Simplicidad y enormes librerías", "Solo sirve para web"], c: 1, e: "Sintaxis simple + ecosistema enorme." },
    { q: "Scapy sirve para:", o: ["Cifrar archivos", "Manipular paquetes de red", "Crear GUIs"], c: 1, e: "Packet crafting y sniffing." },
    { q: "¿Qué librería se usa para protocolos Windows?", o: ["requests", "impacket", "beautifulsoup"], c: 1, e: "Impacket = SMB, NTLM, Kerberos." },
  ],
  10: [
    { q: "XSS permite inyectar:", o: ["SQL en bases de datos", "JavaScript en páginas web", "Binarios en servidores"], c: 1, e: "Cross-Site Scripting = JS injection." },
    { q: "document.cookie permite:", o: ["Borrar cookies", "Leer cookies del navegador", "Crear cookies seguras"], c: 1, e: "Accede a las cookies." },
    { q: "CSP header sirve para:", o: ["Cifrar tráfico", "Controlar qué scripts pueden ejecutarse", "Bloquear SQL injection"], c: 1, e: "Content Security Policy." },
  ],
  11: [
    { q: "SQL Injection básico:", o: ["<script>alert(1)</script>", "' OR 1=1 --", "sudo rm -rf /"], c: 1, e: "Tautología SQL clásica." },
    { q: "Prepared statements previenen:", o: ["XSS", "SQL Injection", "DDoS"], c: 1, e: "Separan datos de código SQL." },
    { q: "Blind SQLi usa:", o: ["Mensajes de error visibles", "Respuestas true/false o tiempo", "Archivos del servidor"], c: 1, e: "Boolean o time-based inference." },
  ],
  12: [
    { q: "Buffer overflow sobrescribe:", o: ["El disco duro", "La return address en el stack", "La RAM completa"], c: 1, e: "Sobrescribe EIP/RIP para redirigir ejecución." },
    { q: "ASLR protege contra:", o: ["XSS", "Predicción de direcciones de memoria", "SQL Injection"], c: 1, e: "Randomiza layout de memoria." },
    { q: "La mayoría de malware está escrito en:", o: ["Python", "JavaScript", "C/C++"], c: 2, e: "C/C++ = bajo nivel, acceso a memoria." },
  ],
  13: [
    { q: "¿Qué estándar WiFi usa SAE (Dragonfly)?", o: ["WEP", "WPA2", "WPA3"], c: 2, e: "WPA3 reemplaza el PSK handshake por SAE." },
    { q: "Un ataque de deauth sirve para:", o: ["Crackear el password directo", "Tirar clientes y forzar reconexión", "Clonar la MAC del router"], c: 1, e: "Los frames de deauth no están cifrados en WPA2." },
    { q: "Evil Twin es:", o: ["Un AP falso con el mismo SSID", "Un virus de router", "Un tipo de cifrado"], c: 0, e: "Suplanta la red legítima para capturar credenciales." },
    { q: "KRACK (2017) atacó:", o: ["WEP", "El 4-way handshake de WPA2", "WPS"], c: 1, e: "Key Reinstallation Attack reinstala una clave usada." },
  ],
  14: [
    { q: "¿Dónde están los hashes de contraseñas en Linux?", o: ["/etc/passwd", "/etc/shadow", "/var/log/auth.log"], c: 1, e: "/etc/shadow (solo root) guarda los hashes." },
    { q: "tail -f se usa para:", o: ["Borrar logs", "Ver logs en tiempo real", "Cifrar archivos"], c: 1, e: "Sigue el archivo a medida que crece." },
    { q: "¿Qué distro trae 600+ herramientas de pentesting?", o: ["Ubuntu Server", "Kali Linux", "Tails"], c: 1, e: "Kali está orientada a seguridad ofensiva." },
    { q: "ss -tulpn o netstat -tulpn muestra:", o: ["Usuarios logueados", "Puertos y conexiones de red", "Permisos de archivos"], c: 1, e: "Sockets/puertos en escucha y conexiones." },
  ],
  15: [
    { q: "El shebang #!/bin/bash indica:", o: ["Un comentario", "El intérprete del script", "Una variable"], c: 1, e: "Define qué programa ejecuta el script." },
    { q: "Para extraer la primera columna de /etc/passwd (separada por :) usás:", o: ["grep", "awk -F:", "sed"], c: 1, e: "awk con field separator ':'." },
    { q: "Para contar logins fallidos: grep 'Failed password' auth.log | ___", o: ["wc -l", "rm -f", "chmod 777"], c: 0, e: "wc -l cuenta las líneas coincidentes." },
    { q: "for i in $(seq 1 254) sirve típicamente para:", o: ["Un ping sweep", "Cifrar un disco", "Crear usuarios"], c: 0, e: "Itera la última octeto para barrer una /24." },
  ],
  16: [
    { q: "chmod 600 da permisos:", o: ["rwxr-xr-x", "rw------- (solo dueño)", "rwxrwxrwx"], c: 1, e: "6=rw para dueño, 0 para grupo y otros." },
    { q: "El bit SUID hace que el binario corra como:", o: ["El usuario que lo ejecuta", "El dueño del archivo", "root siempre"], c: 1, e: "Con permisos del dueño → riesgo de escalada si es root." },
    { q: "Para encontrar binarios SUID:", o: ["find / -perm -4000 -type f", "ls -la /etc", "chmod -R 777 /"], c: 0, e: "Busca el bit SUID (4000)." },
    { q: "SELinux y AppArmor implementan:", o: ["Cifrado de disco", "Control de acceso obligatorio (MAC)", "Un firewall"], c: 1, e: "Confinan procesos aunque sean comprometidos." },
  ],
  17: [
    { q: "El Event ID 4625 en Windows registra:", o: ["Logon exitoso", "Logon fallido", "Servicio nuevo"], c: 1, e: "4625 = fallo de autenticación (brute force)." },
    { q: "El Event ID 7045 suele indicar:", o: ["Cambio de password", "Instalación de un servicio nuevo", "Apagado del sistema"], c: 1, e: "Usado por PsExec y malware para persistencia." },
    { q: "AMSI sirve para:", o: ["Cifrar el disco", "Inspeccionar scripts en memoria antes de ejecutar", "Gestionar usuarios"], c: 1, e: "Antimalware Scan Interface; los atacantes intentan bypassearlo." },
    { q: "Las claves de registro Run/RunOnce se usan comúnmente para:", o: ["Persistencia de malware", "Cifrado", "Backups"], c: 0, e: "Ejecutan programas al inicio de sesión." },
  ],
  18: [
    { q: "El servidor que aloja Active Directory se llama:", o: ["Domain Controller", "Proxy", "Bastion"], c: 0, e: "DC = Domain Controller." },
    { q: "Kerberoasting explota:", o: ["Cuentas de servicio con SPN", "Puertos abiertos", "Contraseñas en texto plano"], c: 0, e: "Pedís el TGS y crackeás el hash offline." },
    { q: "Un Golden Ticket se forja con el hash de:", o: ["Administrator", "krbtgt", "El usuario víctima"], c: 1, e: "Con krbtgt forjás TGTs válidos para cualquiera." },
    { q: "DCSync abusa de:", o: ["La replicación entre Domain Controllers", "Un buffer overflow", "DNS"], c: 0, e: "Simula ser un DC para pedir hashes." },
  ],
  19: [
    { q: "Los cmdlets de PowerShell siguen el patrón:", o: ["Sustantivo-Verbo", "Verbo-Sustantivo", "solo-minúsculas"], c: 1, e: "Get-Process, Set-Item, etc." },
    { q: "El pipeline de PowerShell pasa:", o: ["Texto plano", "Objetos", "Bytes"], c: 1, e: "A diferencia de bash, pasa objetos .NET." },
    { q: "Script Block Logging (Event ID 4104) sirve para:", o: ["Acelerar scripts", "Auditar el código PowerShell ejecutado", "Cifrar scripts"], c: 1, e: "Clave para detectar PowerShell ofensivo." },
    { q: "IEX (New-Object Net.WebClient).DownloadString(...) suele indicar:", o: ["Una actualización normal", "Descarga y ejecución en memoria (sospechoso)", "Un backup"], c: 1, e: "Técnica fileless común en ataques." },
  ],
  20: [
    { q: "La criptografía simétrica usa:", o: ["Dos claves (pública y privada)", "La misma clave para cifrar y descifrar", "Ninguna clave"], c: 1, e: "Misma clave; rápida pero hay que distribuirla con cuidado." },
    { q: "¿Por qué ECB es inseguro?", o: ["Es muy lento", "Bloques iguales producen cifrado igual (revela patrones)", "No usa clave"], c: 1, e: "El 'pingüino cifrado' sigue visible." },
    { q: "¿Qué modo cifra Y autentica (AEAD)?", o: ["ECB", "CBC", "GCM"], c: 2, e: "GCM detecta manipulación además de cifrar." },
    { q: "Reutilizar un nonce/IV con la misma clave:", o: ["Mejora el rendimiento", "Rompe la seguridad de GCM/CTR", "No tiene efecto"], c: 1, e: "Nunca repitas nonce con la misma clave." },
  ],
  21: [
    { q: "En cifrado asimétrico, cifrás con la clave ___ y descifrás con la ___:", o: ["privada / pública", "pública / privada", "misma / misma"], c: 1, e: "Pública cifra, privada descifra." },
    { q: "ECC ofrece, frente a RSA:", o: ["Misma seguridad con claves más cortas", "Menos seguridad", "Solo sirve para firmas"], c: 0, e: "ECC 256 ≈ RSA 3072." },
    { q: "Diffie-Hellman sirve para:", o: ["Hashear passwords", "Acordar una clave compartida sobre canal público", "Firmar binarios"], c: 1, e: "Key exchange; ECDHE da forward secrecy." },
    { q: "El algoritmo de Shor (cuántico) amenaza a:", o: ["AES-256", "RSA y ECC", "SHA-3"], c: 1, e: "Por eso NIST estandarizó PQC (Kyber/Dilithium)." },
  ],
  22: [
    { q: "Una función hash es:", o: ["Reversible con la clave", "Unidireccional", "Un cifrado simétrico"], c: 1, e: "No se revierte; determinista." },
    { q: "El salt en password hashing sirve para:", o: ["Acelerar el login", "Frustrar rainbow tables y hashes iguales", "Cifrar la DB"], c: 1, e: "Valor único por usuario." },
    { q: "¿Cuál es el algoritmo recomendado hoy para passwords?", o: ["MD5", "SHA-256 simple", "Argon2"], c: 2, e: "Argon2 (o bcrypt/scrypt): lentos a propósito." },
    { q: "En PKI, ¿quién emite y firma certificados?", o: ["El navegador", "La Certificate Authority (CA)", "El servidor DNS"], c: 1, e: "Cadena de confianza CA raíz → intermedia → sitio." },
  ],
  23: [
    { q: "HTTPS es:", o: ["HTTP sobre TLS", "Un firewall", "Un tipo de VPN"], c: 0, e: "TLS cifra la comunicación HTTP." },
    { q: "TLS 1.3 frente a 1.2:", o: ["Es más lento e inseguro", "Más rápido y exige forward secrecy", "Es idéntico"], c: 1, e: "Eliminó ciphers inseguros, 1-RTT." },
    { q: "HSTS previene:", o: ["SQL Injection", "SSL stripping (degradar a HTTP)", "Buffer overflow"], c: 1, e: "Fuerza HTTPS en el navegador." },
    { q: "WireGuard se caracteriza por:", o: ["Ser viejo y pesado", "Código mínimo y criptografía moderna fija", "No cifrar"], c: 1, e: "VPN moderna (ChaCha20, Curve25519)." },
  ],
  24: [
    { q: "HTTP es:", o: ["Stateful por defecto", "Stateless (estado vía cookies/tokens)", "Cifrado por defecto"], c: 1, e: "Cada request es independiente." },
    { q: "¿Qué header frena principalmente el XSS?", o: ["Content-Security-Policy", "X-Frame-Options", "Referrer-Policy"], c: 0, e: "CSP controla qué scripts/recursos cargan." },
    { q: "La cookie con flag HttpOnly:", o: ["Solo viaja por HTTP no HTTPS", "No es accesible desde JavaScript", "Expira en 1 hora"], c: 1, e: "Mitiga el robo de cookies vía XSS." },
    { q: "Same-Origin Policy:", o: ["Permite leer cualquier origen", "Restringe el acceso entre orígenes distintos", "Es un cifrado"], c: 1, e: "CORS la relaja de forma controlada." },
    { q: "El gold standard de CSP en 2025 es:", o: ["Whitelist de hosts", "nonce + strict-dynamic + Trusted Types + object-src 'none'", "Solo HTTPS"], c: 1, e: "Nonce-based CSP con strict-dynamic mitiga la mayoría de bypasses. Google usa esto en Gmail/YouTube." },
    { q: "En Chrome desde 2020, las cookies sin SameSite explícito:", o: ["Son bloqueadas", "Se tratan como SameSite=Lax por default", "Se tratan como SameSite=None"], c: 1, e: "El cambio de default cortó la mayoría de CSRF por POST cross-site." },
    { q: "Access-Control-Allow-Origin reflejando el header Origin + Allow-Credentials=true es:", o: ["Configuración recomendada", "Catastrófico — cualquier evil.com lee con credenciales", "Necesario para APIs REST"], c: 1, e: "Whitelist estricta y exact-match del Origin, nunca reflejar." },
    { q: "HSTS con `preload` significa:", o: ["El browser precarga JS", "El browser sabe que el dominio es HTTPS-only antes de la primera visita (HSTS Preload List)", "Reduce la latencia de TLS"], c: 1, e: "hstspreload.org incluye el dominio en la lista embebida en Chromium." },
    { q: "SRI (Subresource Integrity) protege contra:", o: ["XSS DOM", "CDN comprometido que sirve JS modificado (browser verifica hash)", "SQL injection"], c: 1, e: "Requiere `crossorigin=\"anonymous\"` para funcionar." },
  ],
  25: [
    { q: "El #1 actual de OWASP Top 10 es:", o: ["Injection", "Broken Access Control", "SSRF"], c: 1, e: "A01 — control de acceso roto." },
    { q: "IDOR es un ejemplo de:", o: ["Broken Access Control", "Cryptographic Failures", "Misconfiguration"], c: 0, e: "Acceder a objetos ajenos cambiando el ID." },
    { q: "Insecure Design (A04) se corrige:", o: ["Con un parche puntual", "Repensando el diseño / threat modeling", "Reiniciando el servidor"], c: 1, e: "Es una falla de diseño, no de implementación." },
    { q: "Un bucket S3 público es un caso de:", o: ["Injection", "Security Misconfiguration", "Auth Failure"], c: 1, e: "A05 — mala configuración." },
    { q: "JWT con `alg: 'none'` es vulnerable si el server:", o: ["Rechaza tokens sin firma", "No hace whitelist explícita de algs y acepta el declarado en el header", "Usa RS256"], c: 1, e: "El header alg lo controla el atacante — validar contra whitelist antes de decidir key." },
    { q: "El ataque HS256/RS256 key confusion consiste en:", o: ["Cambiar el ID del user", "Firmar con HS256 usando la clave pública RSA como secret HMAC — server valida OK si no chequea alg antes", "Robar la clave privada"], c: 1, e: "Múltiples CVEs históricos: Auth0, Firebase, JWT libs varias." },
    { q: "En OAuth 2.0, el parámetro `state` sirve para:", o: ["Decorar el UI", "Prevenir CSRF: token opaco que el client verifica al callback", "Cifrar el code"], c: 1, e: "Sin state, atacante puede login-fixation." },
    { q: "BOLA / IDOR es #1 en:", o: ["OWASP Top 10 general", "OWASP API Security Top 10 (2023)", "OWASP Mobile Top 10"], c: 1, e: "APIs modernas expuestas por endpoint sin validación de ownership del objeto." },
    { q: "Un business logic bug típico es:", o: ["SQL injection", "Race condition en apply-coupon que permite aplicar 50%OFF varias veces en paralelo", "MD5 en passwords"], c: 1, e: "Cada request individualmente válido; la combinación rompe la lógica. Ningún scanner los encuentra." },
  ],
  26: [
    { q: "Log4Shell es un ejemplo de:", o: ["SSRF", "Vulnerable and Outdated Components", "CSRF"], c: 1, e: "A06 — componente vulnerable (Log4j)." },
    { q: "Falta de logs y alertas corresponde a:", o: ["A09 Logging & Monitoring Failures", "A03 Injection", "A01 Access Control"], c: 0, e: "Los ataques pasan desapercibidos." },
    { q: "Leer http://169.254.169.254 desde el servidor es típico de:", o: ["XSS", "SSRF (A10)", "CSRF"], c: 1, e: "Metadata cloud; caso Capital One." },
    { q: "Deserialización insegura cae bajo:", o: ["A08 Integrity Failures", "A02 Crypto Failures", "A07 Auth"], c: 0, e: "Confiar en datos sin verificar integridad." },
    { q: "XXE (XML External Entity) puede usarse para:", o: ["Solo DoS", "File disclosure, SSRF a metadata cloud, y billion laughs DoS", "Solo crackear passwords"], c: 1, e: "Cualquier parser XML sin external entities deshabilitadas." },
    { q: "Log4Shell (CVE-2021-44228) explotaba:", o: ["Buffer overflow en el logger", "JNDI lookup con `${jndi:ldap://...}` en cualquier campo loggeado → RCE via bytecode remoto", "CSRF"], c: 1, e: "Payload en User-Agent, subject email, chat Minecraft — cualquier campo que llegue a logger.info()." },
    { q: "La lección post-2016 sobre deserialización es:", o: ["Whitelist de clases es 100% seguro", "Nunca deserializar formato nativo binario controlado por el atacante — usar JSON/Protobuf", "Aumentar el tamaño del hash"], c: 1, e: "ObjectInputFilter, SerializationBinder ayudan pero no son garantía absoluta." },
    { q: "HPP (HTTP Parameter Pollution) explota que:", o: ["HTTPS es lento", "Diferentes componentes (WAF, framework) interpretan `?id=1&id=2` diferente, permitiendo bypass de WAF/auth", "GET no soporta múltiples params"], c: 1, e: "El WAF ve el primer param, el backend usa el segundo — desalineación explotable." },
    { q: "En GraphQL, la introspection habilitada en prod es peligrosa porque:", o: ["Consume RAM", "El atacante mapea todos los types/fields con `{ __schema { types { ... } } }` y descubre endpoints internos", "Rompe HTTPS"], c: 1, e: "Deshabilitar `introspection: false` en producción; batching y alias overloading requieren query complexity limits." },
  ],
  27: [
    { q: "' OR 1=1 -- es un payload de:", o: ["XSS", "SQL Injection", "CSRF"], c: 1, e: "Tautología que evade el WHERE." },
    { q: "La defensa principal contra SQLi es:", o: ["Un WAF", "Prepared statements / consultas parametrizadas", "Renombrar tablas"], c: 1, e: "Separan datos de código SQL." },
    { q: "<img src=x onerror=alert(document.cookie)> es:", o: ["SQLi", "Stored XSS", "SSRF"], c: 1, e: "Inyecta JS que roba cookies." },
    { q: "HttpOnly + CSP + output encoding mitigan:", o: ["SQLi", "XSS", "Buffer overflow"], c: 1, e: "Defensa en capas contra XSS." },
    { q: "En blind SQLi time-based, el atacante:", o: ["Ve el error directamente", "Usa SLEEP(5)/WAITFOR/pg_sleep para inferir si la condición fue true por el delay de response", "Necesita XSS"], c: 1, e: "sqlmap --technique=T automatiza; útil cuando la app no refleja errores ni resultados." },
    { q: "En MongoDB, el payload `{ pass: { \"$ne\": \"\" } }` en login sirve para:", o: ["Cifrar la password", "Auth bypass: matches cualquier password si el server no type-checkea el input", "DoS"], c: 1, e: "Fix: `if (typeof pass !== 'string') reject`." },
    { q: "Un DOM XSS ocurre porque:", o: ["El server refleja el input", "El JS del cliente lee de un source (location.hash) y escribe en un sink (innerHTML) sin sanitizar — sin server involvement", "El WAF falló"], c: 1, e: "Sin logs server; CSP nonce solo no ayuda. Trusted Types + DOMPurify son la defensa." },
    { q: "Prototype pollution en JavaScript ocurre cuando:", o: ["Se usa TypeScript", "Un merge/clone recursivo permite escribir en `__proto__` — todos los objetos heredan el gadget", "Se cierra la sesión"], c: 1, e: "Fix: `Object.create(null)`, `Object.freeze(Object.prototype)`, o `--disable-proto=throw`." },
    { q: "DOM Clobbering permite:", o: ["Solo XSS con JS ejecutable", "Sobrescribir globals con HTML injection sin `<script>` — bypass de CSP `script-src 'none'`", "Cifrar cookies"], c: 1, e: "`<a id=config><a id=config name=url href=\"//evil\">` sobrescribe `window.config.url`." },
  ],
  28: [
    { q: "CSRF funciona porque el navegador:", o: ["Ejecuta SQL", "Adjunta las cookies automáticamente", "Ignora HTTPS"], c: 1, e: "La sesión de la víctima se reutiliza." },
    { q: "El flag de cookie que mitiga CSRF es:", o: ["HttpOnly", "SameSite", "Secure"], c: 1, e: "SameSite=Lax/Strict limita envío cross-site." },
    { q: "IDOR se previene:", o: ["Ocultando el ID en el cliente", "Verificando autorización por objeto en el servidor", "Usando HTTPS"], c: 1, e: "En AlphaLog lo cubre RLS de Supabase." },
    { q: "Validar uploads por extensión (.jpg) en vez de contenido:", o: ["Es suficiente", "Es bypasseable (shell.php.jpg, magic bytes)", "Mejora el rendimiento"], c: 1, e: "Validá por contenido real, no por nombre." },
    { q: "HTTP Request Smuggling (CL.TE/TE.CL) explota que:", o: ["El TLS es débil", "Front-end y back-end interpretan el fin de un request diferente (Content-Length vs Transfer-Encoding) → smuggling de bytes al próximo user", "El WAF está desactivado"], c: 1, e: "James Kettle 2019. Bug bounties de 6 cifras. Impact: el next user recibe el prefix del atacante." },
    { q: "Cache poisoning con unkeyed input hace que:", o: ["La cache se vuelva más rápida", "El atacante envenena la cache con response maliciosa (X-Forwarded-Host reflejado) → todos los users siguientes reciben el XSS", "Se pierda persistencia"], c: 1, e: "Blast radius enorme: un solo request afecta millones. Herramienta: Param Miner (Burp)." },
    { q: "DNS rebinding en SSRF se usa cuando:", o: ["No hay validación", "La app valida hostname y resuelve DNS 1x — atacante devuelve IP diferente en la 2da resolución (TOCTOU)", "El WAF bloquea IPs privadas"], c: 1, e: "Fix: resolver DNS una vez y usar la IP resuelta; validar IP tras resolución." },
    { q: "El protocol smuggling con `gopher://` en SSRF permite:", o: ["Solo HTTP", "Mandar bytes raw a Redis/Memcached/SMTP internos (curl con gopher habilitado por default)", "Cifrar el request"], c: 1, e: "Fix: `curl --proto '=https'` o whitelist estricta de protocolos." },
    { q: "Un polyglot file (JPEG + PHP) bypassa:", o: ["Solo CSP", "Validación por magic bytes Y extension whitelist si el server ejecuta como PHP → RCE", "El HSTS"], c: 1, e: "Fix: reprocess con Sharp/Pillow — el output es garantizado no polyglot." },
  ],
  29: [
    { q: "El reconocimiento pasivo se caracteriza por:", o: ["Escanear puertos del objetivo", "No tocar al objetivo (solo fuentes públicas)", "Explotar vulnerabilidades"], c: 1, e: "OSINT; es indetectable." },
    { q: "Shodan es:", o: ["Un antivirus", "Un buscador de dispositivos/servicios expuestos en Internet", "Un cifrador"], c: 1, e: "Mapea la superficie expuesta." },
    { q: "site:ejemplo.com filetype:pdf es un ejemplo de:", o: ["SQL Injection", "Google Dorking", "Un payload XSS"], c: 1, e: "Operadores de búsqueda para recon." },
    { q: "theHarvester sirve para obtener:", o: ["Hashes de passwords", "Emails, subdominios y hosts", "Exploits"], c: 1, e: "Recolección OSINT." },
  ],
  30: [
    { q: "nmap -sn realiza:", o: ["UDP scan", "Ping sweep (qué hosts están vivos)", "OS detection"], c: 1, e: "Descubrimiento de hosts." },
    { q: "Para detectar la versión de los servicios usás:", o: ["-sV", "-sn", "-f"], c: 0, e: "Clave para luego buscar CVEs." },
    { q: "El SYN scan (-sS) es:", o: ["El más ruidoso", "Sigiloso (half-open), requiere root", "Solo para UDP"], c: 1, e: "No completa el handshake." },
    { q: "-D RND:10 en Nmap agrega:", o: ["10 puertos", "Decoys (IPs señuelo) para evadir IDS", "10 segundos de delay"], c: 1, e: "Técnica de evasión." },
  ],
  31: [
    { q: "snmpwalk con community 'public' suele:", o: ["Estar siempre bloqueado", "Exponer mucha información del dispositivo", "Cifrar el tráfico"], c: 1, e: "SNMP mal configurado filtra datos." },
    { q: "dig axfr intenta:", o: ["Un ping", "Una transferencia de zona DNS", "Un brute force"], c: 1, e: "Zone transfer revela registros DNS internos." },
    { q: "enum4linux se usa para enumerar:", o: ["Servidores web", "SMB/Windows (usuarios, shares)", "Bases de datos SQL"], c: 1, e: "Enumeración de Samba/Windows." },
    { q: "El dicho del pentester sobre enumeración es:", o: ["'menos es más'", "'enumeration is key'", "'shoot first'"], c: 1, e: "Cuanto más enumerás, más vectores hallás." },
  ],
  32: [
    { q: "Un vulnerability scanner como Nessus:", o: ["Explota automáticamente todo", "Correlaciona servicios/versiones con CVEs", "Cifra la red"], c: 1, e: "Detecta, no necesariamente explota." },
    { q: "CVSS mide:", o: ["El precio de un exploit", "La severidad de una vulnerabilidad (0-10)", "La velocidad de la red"], c: 1, e: "Score base con AV/AC/PR/UI/S/CIA." },
    { q: "Para priorizar parches conviene mirar si el CVE está en:", o: ["Wikipedia", "CISA KEV (explotado activamente)", "Reddit"], c: 1, e: "Explotabilidad real + exposición." },
    { q: "Antes de reportar un hallazgo de scanner conviene:", o: ["Confiar ciegamente", "Validarlo manualmente (falsos positivos)", "Ignorarlo"], c: 1, e: "El scanner es un punto de partida." },
  ],
  33: [
    { q: "En Metasploit, el 'payload' es:", o: ["La vulnerabilidad", "Lo que se ejecuta tras explotar (ej: shell)", "El escáner"], c: 1, e: "Exploit abre la puerta, payload actúa." },
    { q: "Meterpreter corre principalmente:", o: ["En disco", "En memoria", "En la BIOS"], c: 1, e: "Payload avanzado en memoria." },
    { q: "msfvenom sirve para:", o: ["Escanear puertos", "Generar payloads standalone", "Crackear hashes"], c: 1, e: "Genera payloads fuera de msfconsole." },
    { q: "¿Dónde se practica Metasploit legalmente?", o: ["Cualquier IP de Internet", "Metasploitable / HackTheBox / labs propios", "El router del vecino"], c: 1, e: "Solo con autorización." },
  ],
  34: [
    { q: "Burp Suite se sitúa:", o: ["En el servidor", "Como proxy entre tu navegador y el servidor", "En el router"], c: 1, e: "Intercepta y modifica el tráfico web." },
    { q: "Para reenviar y modificar un request manualmente usás:", o: ["Intruder", "Repeater", "Sequencer"], c: 1, e: "Ideal para probar SQLi/IDOR." },
    { q: "Intruder se usa para:", o: ["Cifrar tráfico", "Automatizar fuzzing/brute force", "Ver el sitemap"], c: 1, e: "Payloads en posiciones definidas." },
    { q: "Para ver tráfico HTTPS en Burp necesitás:", o: ["Nada extra", "Instalar su certificado CA", "Desactivar el firewall"], c: 1, e: "Si no, el navegador alerta por el MITM." },
  ],
  35: [
    { q: "LinPEAS sirve para:", o: ["Cifrar archivos", "Automatizar la búsqueda de vectores de privesc", "Escanear puertos"], c: 1, e: "Enumeración local en Linux." },
    { q: "sudo -l muestra:", o: ["Los usuarios del sistema", "Qué comandos podés ejecutar como root", "Los puertos abiertos"], c: 1, e: "Binarios sudo abusables → shell." },
    { q: "GTFOBins documenta:", o: ["CVEs de Windows", "Binarios Unix abusables para escapar restricciones", "Reglas de firewall"], c: 1, e: "SUID/sudo/capabilities explotables." },
    { q: "Un kernel viejo (uname -a) puede permitir:", o: ["Mejor rendimiento", "Kernel exploits (Dirty COW/Pipe)", "Cifrado más fuerte"], c: 1, e: "Riesgoso pero efectivo si está sin parchear." },
  ],
  36: [
    { q: "En Windows el objetivo de la escalada es llegar a:", o: ["guest", "SYSTEM/Administrator", "anonymous"], c: 1, e: "Máximo privilegio." },
    { q: "La familia 'Potato' (JuicyPotato, PrintSpoofer) abusa de:", o: ["SeImpersonatePrivilege / COM-NTLM", "DNS", "TLS"], c: 0, e: "Escala de servicio a SYSTEM." },
    { q: "Un 'unquoted service path' se explota cuando:", o: ["El servicio usa HTTPS", "La ruta tiene espacios sin comillas", "El servicio está detenido"], c: 1, e: "Windows busca binarios en rutas intermedias." },
    { q: "Mimikatz se usa para:", o: ["Escanear puertos", "Dumpear credenciales de memoria", "Compilar exploits"], c: 1, e: "sekurlsa::logonpasswords." },
  ],
  37: [
    { q: "El pivoting consiste en:", o: ["Borrar logs", "Usar un host comprometido como trampolín a otras redes", "Cifrar el disco"], c: 1, e: "Acceder a redes no alcanzables directamente." },
    { q: "ssh -D crea:", o: ["Un local forward", "Un proxy SOCKS dinámico", "Un backup"], c: 1, e: "Combinado con proxychains." },
    { q: "Pass-the-Hash permite:", o: ["Autenticar con el hash NTLM sin la password", "Crackear AES", "Saltar el firewall físico"], c: 0, e: "Movimiento lateral en redes Windows." },
    { q: "chisel y ligolo-ng sirven para:", o: ["Escanear webs", "Crear túneles/pivoting (a veces sobre HTTP)", "Hashear passwords"], c: 1, e: "Tunneling para bypassear firewalls." },
  ],
  38: [
    { q: "La ingeniería social explota principalmente:", o: ["Bugs de software", "La psicología de las personas", "Puertos abiertos"], c: 1, e: "El humano es el eslabón más débil." },
    { q: "Hacerse pasar por el CEO usa el principio de:", o: ["Escasez", "Autoridad", "Reciprocidad"], c: 1, e: "Cialdini: autoridad." },
    { q: "Dejar un USB infectado para que alguien lo conecte es:", o: ["Tailgating", "Baiting", "Vishing"], c: 1, e: "Cebo que explota la curiosidad." },
    { q: "La mejor defensa contra ingeniería social es:", o: ["Un firewall más caro", "Capacitación y verificación out-of-band", "Cifrar el disco"], c: 1, e: "La cultura y la conciencia." },
  ],
  39: [
    { q: "Spear phishing se diferencia del phishing en que es:", o: ["Masivo y genérico", "Dirigido a una persona específica (con OSINT)", "Solo por SMS"], c: 1, e: "Personalizado, más creíble." },
    { q: "BEC significa:", o: ["Basic Email Cipher", "Business Email Compromise", "Backend Encryption Control"], c: 1, e: "Suplantar a un directivo para ordenar pagos." },
    { q: "micros0ft.com es un ejemplo de:", o: ["Dominio lookalike (typosquatting)", "Un subdominio legítimo", "Un certificado válido"], c: 0, e: "Engaña por similitud visual." },
    { q: "SPF, DKIM y DMARC sirven para:", o: ["Cifrar el disco", "Autenticar el email y frenar spoofing", "Escanear adjuntos"], c: 1, e: "Anti-suplantación de remitente." },
  ],
  40: [
    { q: "¿Dónde se debe analizar malware?", o: ["En tu máquina de trabajo", "En una VM aislada / sandbox", "En el servidor de producción"], c: 1, e: "Aislado, con snapshots y red simulada." },
    { q: "Un IoC es:", o: ["Un tipo de cifrado", "Un indicador de compromiso (hash, IP C2, etc.)", "Un puerto"], c: 1, e: "Alimenta detección y respuesta." },
    { q: "YARA sirve para:", o: ["Cifrar malware", "Identificar malware por patrones (reglas)", "Acelerar la VM"], c: 1, e: "Reglas con strings y condiciones." },
    { q: "ANY.RUN y Cuckoo son:", o: ["Disassemblers", "Sandboxes de análisis de comportamiento", "Packers"], c: 1, e: "Ejecutan la muestra y reportan." },
  ],
  41: [
    { q: "El análisis estático examina el binario:", o: ["Ejecutándolo", "Sin ejecutarlo", "Solo en memoria"], c: 1, e: "Strings, hashes, PE headers, disassembly." },
    { q: "Las APIs importadas (IAT) revelan:", o: ["El color del icono", "Las capacidades del malware", "El precio"], c: 1, e: "VirtualAllocEx → inyección, etc." },
    { q: "Ghidra es:", o: ["Un antivirus", "Un disassembler/decompiler gratuito (NSA)", "Un packer"], c: 1, e: "Para entender la lógica del binario." },
    { q: "Un packer (UPX, Themida):", o: ["Comprime/cifra el código para evadir análisis", "Es un IoC", "Acelera el malware"], c: 0, e: "Hay que hacer unpacking." },
  ],
  42: [
    { q: "El análisis dinámico observa el malware:", o: ["Sin ejecutarlo", "Ejecutándolo en un entorno controlado", "Solo su hash"], c: 1, e: "Revela comportamiento que el estático no ve." },
    { q: "Process Monitor (ProcMon) registra:", o: ["Solo la RAM", "Actividad de archivos, registro y procesos", "El tráfico cifrado"], c: 1, e: "Comportamiento en Windows." },
    { q: "Que el malware detecte VMware y no se ejecute es:", o: ["Un falso positivo", "Sandbox/VM evasion (anti-análisis)", "Un IoC de red"], c: 1, e: "Malware consciente del entorno." },
    { q: "Para evadir el packing, el forense de memoria captura el malware:", o: ["Comprimido", "Ya descifrado en RAM", "En el disco"], c: 1, e: "Volatility analiza la memoria." },
  ],
  43: [
    { q: "La regla de oro del forense es:", o: ["Apagar todo de inmediato", "No alterar la evidencia original (trabajar sobre copias)", "Borrar logs viejos"], c: 1, e: "Admisibilidad legal." },
    { q: "Romper la cadena de custodia:", o: ["No importa", "Invalida la evidencia en la corte", "Acelera el análisis"], c: 1, e: "Registro de quién/cuándo/dónde." },
    { q: "Según el orden de volatilidad, primero capturás:", o: ["El disco", "La RAM", "Los backups"], c: 1, e: "Lo más volátil primero." },
    { q: "Un write blocker sirve para:", o: ["Cifrar la imagen", "Evitar modificar el medio original", "Acelerar la copia"], c: 1, e: "Adquisición forense sin alterar." },
  ],
  44: [
    { q: "File carving recupera:", o: ["Contraseñas", "Archivos borrados por su firma", "Tráfico de red"], c: 1, e: "foremost, scalpel." },
    { q: "Volatility se usa para:", o: ["Forense de disco", "Forense de memoria (RAM)", "Análisis de PCAP"], c: 1, e: "pslist, malfind, netscan." },
    { q: "El plugin windows.malfind de Volatility detecta:", o: ["Usuarios creados", "Código inyectado en procesos", "Puertos abiertos"], c: 1, e: "Inyección en memoria." },
    { q: "El prefetch de Windows evidencia:", o: ["Ejecución de programas", "Cookies del navegador", "Reglas de firewall"], c: 0, e: "Artefacto de ejecución." },
  ],
  45: [
    { q: "Un archivo PCAP contiene:", o: ["Hashes", "Tráfico de red capturado", "Logs del registro"], c: 1, e: "Se analiza con Wireshark/tshark." },
    { q: "NetworkMiner sirve para:", o: ["Escanear puertos", "Extraer archivos/credenciales/hosts de un PCAP", "Cifrar tráfico"], c: 1, e: "Forense de red automatizado." },
    { q: "El beaconing es un indicio de:", o: ["Backup normal", "Comunicación C2 (conexiones periódicas)", "Un escaneo de puertos"], c: 1, e: "Patrón regular hacia un destino." },
    { q: "JA3 es:", o: ["Un cifrado", "Un fingerprint de handshakes TLS", "Un puerto"], c: 1, e: "Identifica clientes aunque cifren." },
  ],
  46: [
    { q: "Un SIEM sirve para:", o: ["Cifrar discos", "Centralizar y correlacionar logs + alertar", "Escanear puertos"], c: 1, e: "Corazón del SOC." },
    { q: "Detectar N fallos de login seguidos de un éxito es una regla de:", o: ["Backup", "Correlación (brute force)", "Cifrado"], c: 1, e: "SPL/KQL en el SIEM." },
    { q: "SOAR aporta:", o: ["Más falsos positivos", "Automatización de la respuesta (aislar host, bloquear IP)", "Cifrado de logs"], c: 1, e: "Reduce el MTTR." },
    { q: "La fatiga de alertas ocurre cuando:", o: ["Hay pocos logs", "Demasiados falsos positivos hacen ignorar los reales", "El SIEM está apagado"], c: 1, e: "Por eso se afinan las reglas." },
  ],
  47: [
    { q: "El ciclo de IR de NIST 800-61 empieza con:", o: ["Recuperación", "Preparación", "Erradicación"], c: 1, e: "Plan, equipo, playbooks antes del incidente." },
    { q: "Contención significa:", o: ["Borrar la evidencia", "Limitar el daño (aislar, bloquear)", "Pagar el rescate"], c: 1, e: "Corto y largo plazo." },
    { q: "Si no se erradica la causa raíz:", o: ["No pasa nada", "El atacante puede volver", "Se acelera la recuperación"], c: 1, e: "Backdoors/cuentas deben eliminarse." },
    { q: "GDPR exige notificar una brecha en:", o: ["72 horas", "30 días", "1 año"], c: 0, e: "Comunicación es parte del IR." },
  ],
  48: [
    { q: "El threat hunting es:", o: ["Esperar alertas", "Buscar proactivamente al atacante (hypothesis-driven)", "Un antivirus"], c: 1, e: "Asume que el atacante ya está dentro." },
    { q: "En la Pyramid of Pain, lo más difícil de cambiar para el atacante son:", o: ["Los hashes", "Las TTPs (comportamiento)", "Las IPs"], c: 1, e: "Cazar por comportamiento es más robusto." },
    { q: "Las hipótesis de hunting suelen basarse en:", o: ["MITRE ATT&CK", "El horóscopo", "El uptime del servidor"], c: 0, e: "Técnicas conocidas → buscás su evidencia." },
    { q: "PowerShell con EncodedCommand desde %TEMP% es:", o: ["Normal", "Una anomalía a investigar", "Un backup"], c: 1, e: "Patrón común de actividad maliciosa." },
  ],
  49: [
    { q: "El modelo de responsabilidad compartida dice que el cliente asegura:", o: ["El hardware de AWS", "IAM, datos y configuración (EN la nube)", "El hipervisor"], c: 1, e: "AWS asegura la nube; vos, en la nube." },
    { q: "La causa #1 de brechas cloud suele ser:", o: ["Fallas de AWS", "Misconfiguración del cliente (ej: S3 público)", "Ataques cuánticos"], c: 1, e: "Bloqueá public access, mínimo privilegio." },
    { q: "CloudTrail provee:", o: ["Detección de malware", "Auditoría de las llamadas a la API (forense)", "Cifrado de S3"], c: 1, e: "Registro de actividad." },
    { q: "Un Security Group con 0.0.0.0/0 en el puerto 22 es:", o: ["Buena práctica", "Una mala configuración (SSH abierto a Internet)", "Obligatorio"], c: 1, e: "Restringí el acceso administrativo." },
  ],
  50: [
    { q: "Microsoft Entra ID (ex Azure AD) gestiona:", o: ["Bases de datos", "Identidad y acceso", "Redes físicas"], c: 1, e: "RBAC, Conditional Access, PIM." },
    { q: "En GCP, las service accounts sobre-privilegiadas son:", o: ["Recomendadas", "Un riesgo común", "Imposibles"], c: 1, e: "Aplicá mínimo privilegio." },
    { q: "El equivalente a AWS GuardDuty en Azure es:", o: ["CloudTrail", "Defender for Cloud", "S3"], c: 1, e: "En GCP es Security Command Center." },
    { q: "CSPM sirve para:", o: ["Cifrar discos", "Detectar misconfigs en multi-cloud de forma continua", "Escanear puertos"], c: 1, e: "Wiz, Prisma, Scout Suite." },
  ],
  51: [
    { q: "Los contenedores comparten con el host:", o: ["El kernel", "La RAM física exclusiva", "El disco completo"], c: 0, e: "Por eso un escape es crítico." },
    { q: "Una buena práctica en el Dockerfile es:", o: ["Correr como root", "Definir un USER no-root", "Hardcodear secretos"], c: 1, e: "Mínimo privilegio." },
    { q: "Trivy se usa para:", o: ["Orquestar pods", "Escanear imágenes por vulns/secrets", "Balancear carga"], c: 1, e: "Integrado en el pipeline." },
    { q: "En Kubernetes, las Network Policies sirven para:", o: ["Cifrar el disco", "Segmentar el tráfico entre pods (default deny)", "Escalar nodos"], c: 1, e: "Limitan el blast radius." },
  ],
  52: [
    { q: "Shift-left significa:", o: ["Probar seguridad solo en producción", "Detectar problemas lo más temprano posible", "Mover el servidor"], c: 1, e: "Más barato arreglar temprano." },
    { q: "SAST analiza:", o: ["La app corriendo", "El código fuente", "El tráfico de red"], c: 1, e: "DAST ataca la app en ejecución." },
    { q: "gitleaks/trufflehog detectan:", o: ["Puertos abiertos", "Secretos commiteados en el repo", "Malware"], c: 1, e: "Secrets scanning en CI." },
    { q: "Un SBOM es:", o: ["Un firewall", "Un inventario de componentes del software", "Un tipo de cifrado"], c: 1, e: "Clave para supply chain security." },
  ],
  53: [
    { q: "La botnet Mirai (2016) se propagó usando:", o: ["Un 0-day de Windows", "IoT con credenciales por defecto", "Phishing"], c: 1, e: "Defaults de fábrica sin cambiar." },
    { q: "binwalk se usa para:", o: ["Escanear puertos", "Extraer el filesystem de un firmware", "Crackear WiFi"], c: 1, e: "Análisis de firmware IoT." },
    { q: "Para analizar una app Android decompilás el:", o: ["PCAP", "APK (con jadx/apktool)", "Registro"], c: 1, e: "El APK es un zip con el código." },
    { q: "OWASP MASVS aplica a:", o: ["Cloud", "Seguridad de aplicaciones móviles", "Redes WiFi"], c: 1, e: "Estándar de verificación mobile." },
  ],
  54: [
    { q: "Antes de cualquier pentest se necesita:", o: ["Un exploit 0-day", "Autorización por escrito (scoping)", "Acceso físico"], c: 1, e: "Sin permiso es ilegal." },
    { q: "El resumen ejecutivo de un reporte va dirigido a:", o: ["Otros pentesters", "Directivos (riesgo de negocio, sin tecnicismos)", "El atacante"], c: 1, e: "Lenguaje no técnico." },
    { q: "Cada hallazgo del reporte debe incluir:", o: ["Solo el CVSS", "Descripción, evidencia, impacto y remediación", "Solo el payload"], c: 1, e: "Accionable para el cliente." },
    { q: "Una certificación ofensiva práctica reconocida es:", o: ["OSCP", "ISO 27001", "PMP"], c: 0, e: "Examen hands-on de 24h." },
  ],
  55: [
    { q: "En Python, re.findall se usa para:", o: ["Abrir sockets", "Extraer patrones (IPs, hashes) con regex", "Cifrar archivos"], c: 1, e: "Parsing de logs." },
    { q: "La API de VirusTotal sirve para:", o: ["Escanear puertos", "Consultar reputación de hashes/URLs", "Pivotar"], c: 1, e: "Threat intel automatizada." },
    { q: "Para escaneos concurrentes en Python usás:", o: ["Solo loops for", "threading / asyncio", "Nada, es secuencial"], c: 1, e: "Paralelismo = velocidad." },
    { q: "argparse aporta:", o: ["Cifrado", "CLIs profesionales con flags", "Acceso a la red"], c: 1, e: "Interfaz de línea de comandos." },
  ],
  56: [
    { q: "Una gran ventaja de Go para tools de seguridad es:", o: ["Necesita un intérprete instalado", "Binarios estáticos y cross-compilation", "Solo corre en Linux"], c: 1, e: "Un ejecutable autocontenido." },
    { q: "Las goroutines sirven para:", o: ["Cifrar datos", "Concurrencia (escaneos masivos)", "Renderizar HTML"], c: 1, e: "Paralelismo ligero." },
    { q: "nuclei, subfinder y httpx están escritos en:", o: ["Python", "Go", "Ruby"], c: 1, e: "ProjectDiscovery usa Go." },
    { q: "Cross-compilation en Go permite:", o: ["Compilar para otros OS desde una sola máquina", "Cifrar el binario", "Evadir AV siempre"], c: 0, e: "Windows/Linux/Mac desde un host." },
  ],
  57: [
    { q: "Metasploit está escrito en:", o: ["Python", "Ruby", "Go"], c: 1, e: "Por eso extenderlo requiere Ruby." },
    { q: "En un módulo MSF, initialize define:", o: ["La lógica del exploit", "La metadata (nombre, autor, targets)", "Los puertos del firewall"], c: 1, e: "Información del módulo." },
    { q: "Un módulo auxiliary típicamente es:", o: ["Un scanner/fuzzer", "Un payload", "Un encoder"], c: 0, e: "No necesariamente explota." },
    { q: "El mejor camino para crear módulos es:", o: ["Empezar de cero", "Leer y adaptar módulos existentes similares", "Evitar los labs"], c: 1, e: "Reload_all y probar en lab." },
  ],
  58: [
    { q: "Un <form> HTML puede enviar datos a:", o: ["Solo al mismo dominio", "Cualquier destino (action)", "Solo por HTTPS"], c: 1, e: "Base de las páginas de phishing." },
    { q: "La validación client-side (JS/required):", o: ["Es suficiente para seguridad", "NO es seguridad: el servidor debe validar", "Reemplaza al backend"], c: 1, e: "El cliente nunca es de confianza." },
    { q: "Un homograph attack usa:", o: ["Buffer overflows", "Caracteres unicode similares en el dominio", "SQL Injection"], c: 1, e: "аpple.com con 'а' cirílica." },
    { q: "Para detectar una página de phishing conviene revisar:", o: ["El color de fondo", "La URL real, el certificado y a dónde apunta el form", "La velocidad de carga"], c: 1, e: "No te fíes de la apariencia." },
  ],
  // ── Doctorate Track ──
  59: [
    { q: "tcache poisoning consiste en sobrescribir:", o: ["El size del top chunk", "El puntero fd de un chunk en tcache", "La GOT"], c: 1, e: "Dos malloc después devuelven la dirección objetivo." },
    { q: "Un Use-After-Free se explota reclamando:", o: ["El chunk liberado con datos controlados", "El kernel", "Un socket"], c: 0, e: "Típico: secuestrar una vtable de C++." },
    { q: "House of Force abusa del:", o: ["fastbin", "size del top chunk", "stack canary"], c: 1, e: "Un size enorme hace que malloc devuelva cualquier dirección." },
    { q: "Safe-linking (glibc ≥2.32) protege:", o: ["La stack", "Los punteros fd de las listas de chunks (XOR con cookie)", "El registro RIP"], c: 1, e: "Dificulta el tcache/fastbin poisoning." },
  ],
  60: [
    { q: "En Linux, un objetivo clásico de la escalada de kernel es:", o: ["Sobrescribir la struct cred (uid=0)", "Cifrar el disco", "Cerrar puertos"], c: 0, e: "O modprobe_path." },
    { q: "SMEP impide que el kernel:", o: ["Acceda a memoria de user", "Ejecute páginas de user space", "Use ASLR"], c: 1, e: "Mata ret2usr → se evade con kROP." },
    { q: "Dirty Pipe (CVE-2022-0847) permite:", o: ["Escanear puertos", "Escribir en archivos de solo lectura", "Crackear WPA2"], c: 1, e: "Primitiva de escritura en el page cache." },
    { q: "Para vencer KASLR el exploit necesita:", o: ["Más RAM", "Un info leak de una dirección de kernel", "Apagar el firewall"], c: 1, e: "Randomiza la base del kernel." },
  ],
  61: [
    { q: "Un exploit full-chain de navegador suele necesitar:", o: ["Un solo bug", "Un bug en el renderer + un sandbox escape", "Acceso físico"], c: 1, e: "El renderer corre sandboxeado." },
    { q: "Las primitivas addrof/fakeobj otorgan:", o: ["R/W arbitrario en el renderer", "Acceso al kernel", "Una shell directa"], c: 0, e: "Base de la explotación de JS engines." },
    { q: "Una type confusion en el JS engine ocurre cuando:", o: ["El engine asume un tipo y recibe otro", "Se agota la RAM", "Falla el TLS"], c: 0, e: "Ej: cambiar el shape/map de un objeto." },
    { q: "Tras lograr RCE en el renderer, el atacante todavía debe:", o: ["Escapar del sandbox", "Reiniciar el navegador", "Nada más"], c: 0, e: "Vía IPC/broker o un bug del SO." },
  ],
  62: [
    { q: "ROP existe principalmente para evadir:", o: ["ASLR", "DEP/NX (stack no ejecutable)", "Stack canaries"], c: 1, e: "Reutiliza código existente en vez de inyectar." },
    { q: "Un gadget de ROP termina típicamente en:", o: ["ret", "nop", "hlt"], c: 0, e: "JOP usa jmp/call en su lugar." },
    { q: "Para construir una cadena ROP con ASLR activo hace falta:", o: ["Un info leak para calcular la base", "Más gadgets", "Apagar DEP"], c: 0, e: "Sin leak no conocés las direcciones." },
    { q: "El Shadow Stack de Intel CET detecta:", o: ["XSS", "ROP que altera las return addresses", "SQL Injection"], c: 1, e: "IBT (endbr64) ataca además el JOP." },
  ],
  63: [
    { q: "El principio de Kerckhoffs dice que es secreta:", o: ["Solo la clave (el sistema es público)", "Todo el algoritmo", "La longitud del mensaje"], c: 0, e: "La seguridad no debe depender del secreto del diseño." },
    { q: "El criptoanálisis diferencial estudia:", o: ["El consumo eléctrico", "Cómo se propaga una diferencia (XOR) por las rondas", "El tiempo de red"], c: 1, e: "Biham–Shamir, aplicado a DES." },
    { q: "FLUSH+RELOAD es un ataque de:", o: ["Padding", "Caché (side-channel)", "Fuerza bruta"], c: 1, e: "Filtra accesos a tablas como las T-tables de AES." },
    { q: "El ataque de Bleichenbacher explota:", o: ["Un padding oracle sobre RSA PKCS#1", "Nonce reuse en AES", "Colisiones de SHA-256"], c: 0, e: "Recupera la clave de sesión consulta a consulta (ROBOT)." },
  ],
  64: [
    { q: "El algoritmo de Shor rompe:", o: ["AES y SHA-3", "RSA, Diffie-Hellman y ECC", "Argon2"], c: 1, e: "Factorización y logaritmo discreto en tiempo polinómico." },
    { q: "Grover afecta a la criptografía simétrica:", o: ["La rompe por completo", "Reduce su seguridad a la mitad", "No la afecta"], c: 1, e: "Manejable subiendo el tamaño de clave." },
    { q: "La familia PQC más versátil y eficiente se basa en:", o: ["Isogenias", "Lattices (retículos)", "Curvas elípticas"], c: 1, e: "Kyber y Dilithium son Module-LWE." },
    { q: "'Harvest now, decrypt later' significa:", o: ["Capturar tráfico cifrado hoy para descifrarlo con cuántica futura", "Minar criptomonedas", "Borrar claves viejas"], c: 0, e: "Motiva migrar a PQC ya." },
  ],
  65: [
    { q: "La propiedad 'zero-knowledge' garantiza que el verificador:", o: ["Aprende el secreto", "No aprende nada salvo la validez", "Obtiene la clave privada"], c: 1, e: "Completitud + soundness + ZK." },
    { q: "A diferencia de los zk-SNARKs, los zk-STARKs:", o: ["Requieren trusted setup", "Son transparentes y post-cuánticos (solo hashes)", "No son sucintos"], c: 1, e: "A cambio de pruebas más grandes." },
    { q: "MPC permite:", o: ["Computar una función sobre entradas privadas sin revelarlas", "Cifrar discos", "Escanear puertos"], c: 0, e: "Garbled circuits, secret sharing." },
    { q: "Una firma de umbral (t de n) sirve para:", o: ["Acelerar el hashing", "Repartir una clave sin un único punto de fallo", "Comprimir datos"], c: 1, e: "Custodia distribuida de claves." },
  ],
  66: [
    { q: "El cifrado homomórfico permite:", o: ["Operar sobre datos sin descifrarlos", "Cifrar más rápido", "Romper RSA"], c: 0, e: "Enc(a)⊕Enc(b)=Enc(a+b)." },
    { q: "Paillier es homomórfico:", o: ["Multiplicativo", "Aditivo", "Totalmente (FHE)"], c: 1, e: "RSA es el multiplicativo; ambos son PHE." },
    { q: "El bootstrapping en FHE sirve para:", o: ["Acelerar la red", "Reducir el ruido acumulado para seguir operando", "Generar claves"], c: 1, e: "Lo resolvió Gentry (2009); es costoso." },
    { q: "El esquema CKKS es ideal para:", o: ["Aritmética aproximada sobre reales (ML)", "Booleanos", "Hashing"], c: 0, e: "BFV/BGV son exactos sobre enteros." },
  ],
  67: [
    { q: "Un ejemplo adversarial es:", o: ["Un bug del framework", "Una entrada con perturbación mínima que engaña al modelo", "Un dato faltante"], c: 1, e: "Imperceptible para un humano." },
    { q: "FGSM y PGD son ataques de:", o: ["Entrenamiento (poisoning)", "Inferencia (evasión)", "Red"], c: 1, e: "Usan el gradiente de la pérdida." },
    { q: "Un backdoor (BadNets) hace que el modelo:", o: ["Falle siempre", "Funcione normal salvo ante un trigger específico", "No entrene"], c: 1, e: "Ataque en tiempo de entrenamiento." },
    { q: "La defensa más efectiva contra adversariales es:", o: ["Adversarial training", "Más capas", "Bajar el learning rate"], c: 0, e: "Costosa y reduce precisión limpia." },
  ],
  68: [
    { q: "El model extraction consiste en:", o: ["Cifrar el modelo", "Clonar un modelo consultando su API", "Borrar el dataset"], c: 1, e: "Roba IP y habilita evasión black-box." },
    { q: "El membership inference determina:", o: ["Si un registro estuvo en el entrenamiento", "El learning rate", "La arquitectura"], c: 0, e: "Se apoya en el overfitting." },
    { q: "Los LLMs pueden sufrir:", o: ["Training data extraction (regurgitar PII)", "Sólo DDoS", "Nada de privacidad"], c: 0, e: "Memorizan parte del corpus." },
    { q: "DP-SGD protege la privacidad agregando:", o: ["Más datos", "Clipping de gradientes + ruido calibrado", "Capas extra"], c: 1, e: "Provee un presupuesto ε." },
  ],
  69: [
    { q: "El problema de fondo de los LLMs es que:", o: ["Son lentos", "No distinguen instrucciones de datos (todo es texto)", "No tienen API"], c: 1, e: "Base de la prompt injection." },
    { q: "La prompt injection indirecta llega vía:", o: ["El system prompt", "Datos externos que el LLM procesa (web, email, PDF)", "El teclado físico"], c: 1, e: "La más peligrosa en agentes." },
    { q: "La salida de un LLM debe tratarse como:", o: ["Confiable", "Entrada NO confiable (puede causar XSS/SQLi/RCE)", "Cifrada"], c: 1, e: "Insecure output handling." },
    { q: "Excessive agency se mitiga con:", o: ["Más herramientas", "Least privilege + human-in-the-loop", "Más tokens"], c: 1, e: "Limitar permisos del agente." },
  ],
  70: [
    { q: "Cargar un modelo en formato pickle puede:", o: ["Ejecutar código arbitrario (RCE)", "Acelerar la inferencia", "Cifrar el modelo"], c: 0, e: "Por eso existe safetensors." },
    { q: "safetensors es más seguro porque:", o: ["Comprime mejor", "Solo guarda tensores, sin código ejecutable", "Usa GPU"], c: 1, e: "Evita la deserialización peligrosa." },
    { q: "Un MLBOM / SBOM de ML inventaria:", o: ["Solo el código", "Datasets, modelos base y dependencias", "Los usuarios"], c: 1, e: "Clave para provenance e integridad." },
    { q: "El monitoreo en producción de un modelo busca:", o: ["Drift, evasión y abuso por queries", "Subir la precisión sola", "Nada, ya está desplegado"], c: 0, e: "La seguridad no termina al desplegar." },
  ],
  71: [
    { q: "Spectre y Meltdown explotan:", o: ["Un bug de software puntual", "La ejecución especulativa/out-of-order del CPU", "WiFi"], c: 1, e: "Dejan trazas microarquitectónicas en caché." },
    { q: "KPTI mitiga Meltdown pero no Spectre porque:", o: ["Spectre cruza el predictor de saltos, no solo kernel/user", "Spectre es más viejo", "KPTI desactiva el CPU"], c: 0, e: "Separar page tables no cubre el branch prediction." },
    { q: "FLUSH+RELOAD recupera el secreto midiendo:", o: ["El voltaje", "El tiempo de recarga de líneas de caché", "El tráfico de red"], c: 1, e: "El byte secreto se usa como índice de un array." },
    { q: "Estos ataques demuestran que:", o: ["El software es siempre seguro", "El aislamiento puede romperse por debajo, en el silicio", "La caché no importa"], c: 1, e: "Procesos/VMs/enclaves afectados." },
  ],
  72: [
    { q: "El voltage glitching busca:", o: ["Cifrar datos", "Inducir un fallo (saltear una instrucción/corromper un cálculo)", "Acelerar el chip"], c: 1, e: "Ej: bypassear una verificación de firma." },
    { q: "DPA/CPA recuperan una clave correlacionando:", o: ["El consumo eléctrico con valores intermedios", "El hash con la clave", "El tiempo de red"], c: 0, e: "Estadística sobre muchas trazas." },
    { q: "Una interfaz JTAG/UART abierta en producción:", o: ["Es inofensiva", "Da acceso a memoria y consola del dispositivo", "Cifra el firmware"], c: 1, e: "Hay que deshabilitarla (fuses)." },
    { q: "Un sensor anti-tamper típicamente:", o: ["Acelera el boot", "Borra las claves (zeroization) ante manipulación", "Sube el voltaje"], c: 1, e: "Detecta voltaje/temperatura/luz anómalos." },
  ],
  73: [
    { q: "El firmware es un blanco de oro porque:", o: ["Es lento", "Persiste por debajo del SO (sobrevive a reinstalarlo)", "No tiene privilegios"], c: 1, e: "Corre antes que cualquier AV/EDR." },
    { q: "Secure Boot garantiza que el firmware:", o: ["Cifra el disco", "Solo ejecuta bootloaders firmados por claves de confianza", "Acelera el arranque"], c: 1, e: "Bloquea bootkits no firmados." },
    { q: "LoJax (APT28) fue notable por:", o: ["Ser un ransomware", "Ser un UEFI rootkit que persiste en el SPI flash", "Atacar WiFi"], c: 1, e: "Sobrevive a reinstalar el SO." },
    { q: "chipsec se usa para:", o: ["Crackear WPA2", "Auditar la configuración de seguridad del firmware", "Generar payloads"], c: 1, e: "SPI protection, Secure Boot, SMM." },
  ],
  74: [
    { q: "Un root of trust debe estar anclado en:", o: ["Software", "Hardware (no modificable por software)", "La red"], c: 1, e: "Si el ancla es software, se subvierte." },
    { q: "Los PCRs de un TPM almacenan:", o: ["Las claves en claro", "Las mediciones (hashes) del arranque", "Los logs de red"], c: 1, e: "Habilitan sealing y attestation." },
    { q: "Intel SGX / AMD SEV proveen:", o: ["Enclaves/VMs aislados del SO y el hipervisor", "Un antivirus", "Cifrado de red"], c: 0, e: "Base del confidential computing." },
    { q: "Foreshadow y SGAxe demuestran que un TEE:", o: ["Es invulnerable", "Puede caer ante side-channels microarquitectónicos", "No usa hardware"], c: 1, e: "No es una bala de plata." },
  ],
  75: [
    { q: "El control-flow flattening dificulta el RE porque:", o: ["Cifra el disco", "Convierte el flujo en un gran switch dirigido por estado", "Borra los strings"], c: 1, e: "El tracing dinámico ayuda a vencerlo." },
    { q: "La obfuscación basada en virtualización (VMProtect):", o: ["Comprime el binario", "Compila el código a bytecode de una VM custom", "Cifra la red"], c: 1, e: "Reversear exige reconstruir el intérprete." },
    { q: "Frida sirve para:", o: ["Instrumentación dinámica (hooks en runtime)", "Compilar exploits", "Escanear puertos"], c: 0, e: "Inspecciona/modifica funciones en apps vivas." },
    { q: "Unicorn Engine permite:", o: ["Emular fragmentos de código en aislamiento (ej: descifrar strings)", "Cifrar firmware", "Crackear WPA2"], c: 0, e: "Útil para deobfuscación/unpacking." },
  ],
  76: [
    { q: "La ejecución simbólica usa un SMT solver (Z3) para:", o: ["Cifrar datos", "Hallar inputs que satisfacen las restricciones de un camino", "Acelerar la CPU"], c: 1, e: "Razona en vez de probar por fuerza bruta." },
    { q: "angr se usa típicamente para:", o: ["Resolver crackmes / hallar inputs sin fuerza bruta", "Renderizar gráficos", "Servir webs"], c: 0, e: "explore(find=..., avoid=...)." },
    { q: "El principal problema de la ejecución simbólica es:", o: ["Path explosion (caminos exponenciales)", "Que es muy rápida", "Que no usa CPU"], c: 0, e: "La concólica/DSE ayuda a podar." },
    { q: "Un hash criptográfico fuerte para el SMT solver es:", o: ["Trivial de invertir", "Esencialmente irresoluble (por diseño)", "Un opaque predicate"], c: 1, e: "Límite claro de la técnica." },
  ],
  77: [
    { q: "Un rootkit busca principalmente:", o: ["Acelerar el sistema", "Ocultar su presencia y mantener acceso", "Cifrar archivos"], c: 1, e: "Cuanto más profundo, más sigiloso." },
    { q: "DKOM (Direct Kernel Object Manipulation) oculta un proceso:", o: ["Cifrándolo", "Desenlazándolo de la lista del kernel (sin hook)", "Renombrándolo"], c: 1, e: "Desaparece de la enumeración." },
    { q: "BYOVD consiste en:", o: ["Cargar un driver legítimo pero vulnerable para ejecutar en kernel", "Traer tu propio antivirus", "Un tipo de phishing"], c: 0, e: "Usado para desactivar el EDR." },
    { q: "Para detectar un rootkit bien hecho conviene:", o: ["Confiar en lo que reporta el SO", "Analizar desde afuera (memoria volcada, boot confiable)", "Reiniciar"], c: 1, e: "Desde adentro te miente." },
  ],
  78: [
    { q: "Un implant fileless evade el AV porque:", o: ["Se ejecuta en memoria sin tocar el disco", "Es de código abierto", "Usa HTTPS"], c: 0, e: "El AV basado en archivos no lo ve." },
    { q: "Las syscalls directas/indirectas evaden al EDR porque:", o: ["Cifran el payload", "No pasan por la ntdll enganchada en userland", "Apagan el firewall"], c: 1, e: "Hell's Gate, SysWhispers." },
    { q: "Domain fronting sirve para:", o: ["Acelerar el C2", "Esconder el destino real tras un dominio de alta reputación", "Cifrar el disco"], c: 1, e: "Disfraza el tráfico C2." },
    { q: "La detección robusta de evasión se apoya en:", o: ["Telemetría de kernel/ETW (que userland no falsea)", "Solo el hash del archivo", "El color del icono"], c: 0, e: "Comportamiento + ATT&CK." },
  ],
  79: [
    { q: "El vulnerability research busca:", o: ["Parchear CVEs viejos", "Bugs desconocidos (0-days)", "Instalar antivirus"], c: 1, e: "Empieza mapeando la superficie de ataque." },
    { q: "El fuzzing coverage-guided prioriza inputs que:", o: ["Son más cortos", "Alcanzan código nuevo", "Vienen de Internet"], c: 1, e: "AFL++, libFuzzer." },
    { q: "AddressSanitizer (ASAN) sirve para:", o: ["Cifrar memoria", "Convertir corrupciones silenciosas en crashes detectables", "Acelerar el fuzzer"], c: 1, e: "Fuzzing + sanitizers = la dupla clave." },
    { q: "El fuzzing híbrido suma un solver concólico para:", o: ["Comprimir el corpus", "Desbloquear checks 'mágicos' que el fuzzer no adivina", "Cifrar inputs"], c: 1, e: "Driller, QSYM." },
  ],
  80: [
    { q: "En CTI, las TTPs son más valiosas que los IoCs porque:", o: ["Son más fáciles de cambiar", "Son más caras de cambiar para el actor (más duraderas)", "Son secretas"], c: 1, e: "Pyramid of Pain." },
    { q: "El Diamond Model describe una intrusión con:", o: ["Adversario, capacidad, infraestructura, víctima", "5 capas OSI", "3 colores"], c: 0, e: "Se pivota entre vértices." },
    { q: "La atribución de un ataque:", o: ["Es siempre certera", "Es difícil y se hace con cautela (false flags)", "No importa"], c: 1, e: "Se expresa en niveles de confianza." },
    { q: "STIX/TAXII son estándares para:", o: ["Cifrar discos", "Representar e intercambiar CTI de forma automatizable", "Escanear puertos"], c: 1, e: "MISP, OpenCTI." },
  ],
  81: [
    { q: "La Coordinated Vulnerability Disclosure implica:", o: ["Publicar todo de inmediato", "Reportar al vendor en privado con un plazo para parchear", "No reportar nunca"], c: 1, e: "Plazo típico de 90 días." },
    { q: "Un CNA es quien:", o: ["Explota la vuln", "Asigna identificadores CVE", "Paga el bug bounty"], c: 1, e: "Vendors y MITRE." },
    { q: "CISA KEV cataloga:", o: ["Vulnerabilidades explotadas activamente", "Certificaciones", "Puertos"], c: 0, e: "Prioridad de parcheo." },
    { q: "Las top conferences académicas de seguridad incluyen:", o: ["IEEE S&P, USENIX Security, CCS", "Solo Black Hat", "Ninguna"], c: 0, e: "Más NDSS; Black Hat/DEF CON son de industria." },
  ],
  82: [
    { q: "Según Dijkstra, el testing puede mostrar:", o: ["La ausencia de bugs", "La presencia de bugs, nunca su ausencia", "El rendimiento"], c: 1, e: "Los métodos formales prueban ausencia." },
    { q: "El model checking (TLA+/SPIN):", o: ["Explora exhaustivamente los estados de un modelo", "Compila más rápido", "Cifra datos"], c: 0, e: "Sufre explosión de estados." },
    { q: "seL4 es notable por ser:", o: ["Un antivirus", "Un microkernel formalmente verificado", "Un fuzzer"], c: 1, e: "Prueba de corrección y aislamiento." },
    { q: "El punto débil de la verificación formal es:", o: ["La spec (si está mal, el bug pasa)", "Que es muy rápida", "Que no usa matemática"], c: 0, e: "La prueba es tan buena como la especificación." },
  ],
  83: [
    { q: "En el modelo AAA, 'autorización' responde a:", o: ["¿Quién sos?", "¿Qué podés hacer?", "¿Cuándo entraste?"], c: 1, e: "Autenticación prueba identidad; autorización define permisos." },
    { q: "MFA significa combinar:", o: ["Dos contraseñas", "2+ factores de distinto tipo", "Usuario y correo"], c: 1, e: "Factores diferentes: algo que sabés/tenés/sos." },
    { q: "SSO permite:", o: ["Un único inicio de sesión para varias apps", "Cifrar la contraseña", "Bloquear cuentas"], c: 0, e: "Single Sign-On reduce fricción y reutilización de credenciales." },
    { q: "Una cuenta 'huérfana' es:", o: ["Una cuenta sin permisos", "Una cuenta activa de alguien que ya no debería tener acceso", "Una cuenta de servicio"], c: 1, e: "Surge de un deprovisioning tardío en el ciclo de vida." },
    { q: "El principio de menor privilegio implica:", o: ["Dar admin para evitar problemas", "Otorgar solo los permisos necesarios", "Rotar contraseñas a diario"], c: 1, e: "Reduce la superficie de abuso si la cuenta se compromete." },
    { q: "¿Cuántos factores de autenticación modernos se distinguen?", o: ["Solo 2 (usuario y contraseña)", "3 (sabés, tenés, sos)", "5 (sabés, tenés, sos, dónde estás, cómo actuás)"], c: 2, e: "Los 5 modernos: conocimiento, posesión, inherencia, ubicación y comportamiento." },
    { q: "¿Cuál de estas combinaciones es MFA de verdad?", o: ["Contraseña + PIN", "Contraseña + passkey", "Pregunta de seguridad + fecha de nacimiento"], c: 1, e: "MFA requiere factores de categorías DISTINTAS. Contraseña y PIN son ambos 'algo que sabés'." },
    { q: "¿Por qué las passkeys/FIDO2 son inmunes al phishing?", o: ["Porque usan biometría", "Porque la credencial está ligada al dominio (origin binding)", "Porque son más largas que una contraseña"], c: 1, e: "Un sitio phishing tiene distinto origen; el navegador no reutiliza la credencial ahí." },
    { q: "El ataque 'MFA fatigue' consiste en:", o: ["Bombardear con pushes hasta que la víctima acepta por cansancio", "Cambiar la SIM del usuario", "Robar el token del backend"], c: 0, e: "Requiere tener la contraseña previa (dump o phishing). Uber 2022 cayó así." },
  ],
  84: [
    { q: "Defensa en profundidad significa:", o: ["Un control muy fuerte", "Varias capas de controles redundantes", "Cifrar dos veces"], c: 1, e: "Si una capa falla, otra contiene el ataque." },
    { q: "'Security by obscurity' es:", o: ["Un buen principio", "Confiar en el secreto del diseño como única defensa (mala práctica)", "Cifrado fuerte"], c: 1, e: "El principio de diseño abierto recomienda lo contrario." },
    { q: "Un sistema 'fail-secure' ante un error:", o: ["Queda abierto para no molestar", "Queda en estado seguro (denegando)", "Se reinicia sin más"], c: 1, e: "Prioriza la seguridad sobre la disponibilidad ante fallos." },
    { q: "La segmentación de red sirve para:", o: ["Acelerar el WiFi", "Limitar el alcance (blast radius) de un compromiso", "Eliminar el firewall"], c: 1, e: "Contiene el movimiento lateral del atacante." },
    { q: "'Secure by default' implica que:", o: ["La opción segura viene activada de fábrica", "El usuario debe endurecer todo manualmente", "No hay configuración"], c: 0, e: "La configuración predeterminada ya es la segura." },
  ],
  85: [
    { q: "GRC son las siglas de:", o: ["Gobernanza, Riesgo y Cumplimiento", "Gestión de Redes Corporativas", "Guía de Respuesta a Crisis"], c: 0, e: "Governance, Risk & Compliance." },
    { q: "El 'apetito de riesgo' es:", o: ["El riesgo máximo que la organización acepta asumir", "La cantidad de incidentes al año", "Un tipo de control"], c: 0, e: "Marca el umbral para decidir tratar o aceptar riesgos." },
    { q: "El riesgo se suele expresar como:", o: ["Probabilidad × impacto", "Costo del firewall", "Número de usuarios"], c: 0, e: "Sobre un activo, dada una amenaza y una vulnerabilidad." },
    { q: "Contratar un seguro cibernético es un ejemplo de:", o: ["Mitigar", "Transferir el riesgo", "Evitar"], c: 1, e: "Se traslada el impacto financiero a un tercero." },
    { q: "El 'riesgo residual' es:", o: ["El riesgo antes de cualquier control", "El riesgo que queda tras aplicar controles", "Un riesgo inventado"], c: 1, e: "Debe quedar dentro del apetito de riesgo aprobado." },
  ],
  86: [
    { q: "El RGPD regula:", o: ["Datos de tarjetas", "Datos personales en la UE", "Configuración de firewalls"], c: 1, e: "General Data Protection Regulation, datos de personas físicas." },
    { q: "PCI-DSS aplica a:", o: ["Datos de salud", "Datos de tarjetas de pago", "Datos del sector público"], c: 1, e: "Payment Card Industry Data Security Standard." },
    { q: "ISO 27001 certifica:", o: ["Un firewall", "Un Sistema de Gestión de Seguridad de la Información (SGSI)", "Un lenguaje de programación"], c: 1, e: "Es la norma certificable del SGSI." },
    { q: "Una 'evidencia' de auditoría puede ser:", o: ["Un log o una política firmada", "Una opinión personal", "Un rumor"], c: 0, e: "Debe ser verificable y trazable." },
    { q: "El RGPD exige notificar una brecha de datos personales en, como máximo:", o: ["72 horas", "30 días", "1 año"], c: 0, e: "72 horas a la autoridad de control desde que se tiene constancia." },
  ],
};

// ─── Quizzes por nivel (Fase A) ──────────────────────────────────────────────
// Niveles intermedio ('i') y avanzado ('a') por lección. El básico ('b') sigue en
// QUIZZES (back-compat). Se autoría por lotes; una lección sin entrada acá solo
// tiene nivel básico disponible. Las preguntas siguen el mismo shape (c = índice
// de la opción correcta).
export const QUIZZES_IA: Record<number, { i?: QuizQuestion[]; a?: QuizQuestion[] }> = {
  // ── Bloque Fundamentos ──
  1: {
    i: [
      { q: "En el Cyber Kill Chain de Lockheed Martin, ¿qué fase sigue a 'Weaponization'?", o: ["Reconnaissance", "Delivery", "Installation"], c: 1, e: "Recon → Weaponization → Delivery → Exploitation → Installation → C2 → Actions." },
      { q: "Un modelo de amenazas busca principalmente:", o: ["Cifrar los datos en reposo", "Identificar activos, amenazas y mitigaciones antes de construir", "Reemplazar al firewall"], c: 1, e: "Threat modeling es preventivo: se hace en diseño." },
      { q: "El ataque a SolarWinds (2020) fue un ejemplo de:", o: ["Phishing masivo", "Compromiso de la cadena de suministro", "Ataque de fuerza bruta"], c: 1, e: "Se troyanizó la build de Orion (supply chain)." },
      { q: "Un IoC (Indicator of Compromise) es:", o: ["Una política de seguridad", "Una evidencia observable de una intrusión", "Un tipo de firewall"], c: 1, e: "Hashes, IPs, dominios maliciosos, etc." },
    ],
    a: [
      { q: "En STRIDE, la 'S' corresponde a:", o: ["Spoofing", "Scanning", "Sniffing"], c: 0, e: "STRIDE: Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege." },
      { q: "DREAD se usa para:", o: ["Cifrar tráfico", "Priorizar/puntuar riesgos", "Escanear puertos"], c: 1, e: "Damage, Reproducibility, Exploitability, Affected users, Discoverability." },
      { q: "La 'E' de STRIDE (Elevation of privilege) viola principalmente:", o: ["Disponibilidad", "Autorización", "No repudio"], c: 1, e: "Obtener permisos mayores a los asignados." },
      { q: "Un 'attack tree' modela:", o: ["La topología de red", "Las rutas alternativas para lograr un objetivo de ataque", "El presupuesto de seguridad"], c: 1, e: "Raíz = objetivo; ramas = formas de alcanzarlo." },
    ],
  },
  2: {
    i: [
      { q: "Separación de deberes (SoD) busca:", o: ["Acelerar procesos", "Que ninguna persona controle un proceso crítico de punta a punta", "Reducir el número de empleados"], c: 1, e: "Evita fraude/error con control dividido." },
      { q: "El principio de menor privilegio aplica a:", o: ["Solo administradores", "Usuarios, procesos y servicios", "Solo cuentas de servicio"], c: 1, e: "Todo sujeto recibe el mínimo necesario." },
      { q: "Defensa en profundidad significa:", o: ["Un solo control muy fuerte", "Múltiples capas de controles redundantes", "Cifrar dos veces"], c: 1, e: "Si una capa falla, otra contiene." },
      { q: "El modelo AAA incluye Authentication, Authorization y:", o: ["Auditing/Accounting", "Availability", "Allocation"], c: 0, e: "Accounting/Auditing = registro de actividad." },
    ],
    a: [
      { q: "El pilar central de Zero Trust es:", o: ["Confiar en la red interna", "Never trust, always verify", "VPN siempre activa"], c: 1, e: "No hay perímetro de confianza implícito." },
      { q: "En Zero Trust, el acceso se decide por:", o: ["Ubicación de red únicamente", "Identidad + contexto + postura del dispositivo", "Dirección MAC"], c: 1, e: "Decisión dinámica basada en señales." },
      { q: "BeyondCorp (Google) eliminó la dependencia de:", o: ["Contraseñas", "La VPN/perímetro de red", "La autenticación"], c: 1, e: "Acceso basado en identidad/dispositivo, sin red de confianza." },
      { q: "Un 'policy decision point' (PDP) en ZTA:", o: ["Cifra el tráfico", "Evalúa políticas y autoriza/deniega cada acceso", "Almacena logs"], c: 1, e: "El PDP decide; el PEP (enforcement point) aplica." },
    ],
  },
  3: {
    i: [
      { q: "Una APT se caracteriza por:", o: ["Ataques rápidos y ruidosos", "Persistencia prolongada y sigilo, usualmente con respaldo estatal", "Solo afectar a usuarios domésticos"], c: 1, e: "Advanced Persistent Threat = largo plazo, sigilosa." },
      { q: "Un IoC de tipo comportamental sería:", o: ["Un hash de archivo", "Un patrón de beaconing C2 cada N segundos", "Una IP"], c: 1, e: "Comportamiento > artefacto estático." },
      { q: "El 'dwell time' mide:", o: ["El tiempo de cifrado", "Cuánto permanece el atacante sin ser detectado", "La latencia de red"], c: 1, e: "Tiempo entre intrusión y detección." },
      { q: "Living off the land (LOTL) se refiere a:", o: ["Usar herramientas legítimas del sistema para atacar", "Sembrar malware en USB", "Atacar granjas de servidores"], c: 0, e: "PowerShell, WMI, etc. para evadir detección." },
    ],
    a: [
      { q: "MITRE ATT&CK organiza el conocimiento en:", o: ["Vulnerabilidades CVE", "Tácticas y técnicas de adversarios", "Certificaciones"], c: 1, e: "Matriz de TTPs por fase." },
      { q: "Una 'táctica' en ATT&CK responde a:", o: ["El cómo (técnica específica)", "El por qué (objetivo del adversario)", "El cuándo"], c: 1, e: "Táctica = objetivo (p.ej. Persistence); técnica = cómo." },
      { q: "Threat intelligence 'estratégica' está dirigida a:", o: ["Analistas SOC en tiempo real", "Decisores/ejecutivos (tendencias y riesgo)", "Firewalls"], c: 1, e: "Estratégica = alto nivel; táctica/operacional = técnica." },
      { q: "Mapear detecciones a ATT&CK ayuda a:", o: ["Cifrar mejor", "Medir cobertura y gaps de detección", "Reducir el ancho de banda"], c: 1, e: "Identifica técnicas sin cobertura." },
    ],
  },
  4: {
    i: [
      { q: "Los CIS Controls se caracterizan por estar:", o: ["Ordenados sin prioridad", "Priorizados por grupos de implementación (IG1-IG3)", "Solo para gobierno"], c: 1, e: "IG1 (básico) → IG3 (avanzado)." },
      { q: "Un control 'preventivo' busca:", o: ["Detectar tras el hecho", "Evitar que el incidente ocurra", "Recuperar datos"], c: 1, e: "Preventivo vs detectivo vs correctivo." },
      { q: "El 'inventario de activos' es el control CIS #1 porque:", o: ["Es el más barato", "No puedes proteger lo que no sabes que tienes", "Lo exige la ley"], c: 1, e: "Visibilidad es la base." },
      { q: "NIST CSF se compone de Funciones, Categorías y:", o: ["Subcategorías", "Certificaciones", "Multas"], c: 0, e: "Functions → Categories → Subcategories." },
    ],
    a: [
      { q: "SOC 2 Type II evalúa:", o: ["El diseño de controles en un punto del tiempo", "La efectividad operativa de los controles durante un período", "Solo la confidencialidad"], c: 1, e: "Type I = diseño puntual; Type II = operación sostenida." },
      { q: "Los Trust Services Criteria de SOC 2 incluyen Security y:", o: ["Availability, Processing Integrity, Confidentiality, Privacy", "Solo Privacy", "Velocidad"], c: 0, e: "5 criterios; Security es obligatorio." },
      { q: "En una auditoría de cumplimiento, una 'no conformidad mayor' implica:", o: ["Una observación menor", "Una falla sistémica del control", "Un elogio"], c: 1, e: "Compromete el objetivo del control." },
      { q: "La diferencia clave entre ISO 27001 y NIST CSF es:", o: ["ISO es certificable; NIST CSF es un marco voluntario", "Son idénticos", "NIST es obligatorio mundialmente"], c: 0, e: "ISO 27001 se certifica; CSF guía, no certifica." },
    ],
  },
  // ── Bloque Redes ──
  5: {
    i: [
      { q: "La PDU de la capa de Transporte (OSI 4) se llama:", o: ["Trama (frame)", "Segmento", "Paquete"], c: 1, e: "Bits→Trama(2)→Paquete(3)→Segmento(4)." },
      { q: "El encapsulamiento agrega cabeceras:", o: ["De capa superior a inferior al enviar", "Solo en la capa física", "Únicamente al recibir"], c: 0, e: "Cada capa envuelve los datos de la superior." },
      { q: "TLS opera principalmente entre las capas:", o: ["1 y 2", "Sesión/Presentación (5-6) sobre Transporte", "Solo capa 7"], c: 1, e: "Asegura sesiones sobre TCP." },
      { q: "Un switch opera nativamente en la capa:", o: ["1 (Física)", "2 (Enlace)", "3 (Red)"], c: 1, e: "Conmuta por dirección MAC." },
    ],
    a: [
      { q: "ARP poisoning es un ataque de capa 2 que permite:", o: ["Agotar puertos TCP", "Man-in-the-middle en la LAN", "Romper TLS directamente"], c: 1, e: "Asocia la MAC del atacante a una IP legítima." },
      { q: "Un ataque de capa 7 típico es:", o: ["SYN flood", "HTTP flood / Slowloris", "MAC flooding"], c: 1, e: "Explota la lógica de aplicación." },
      { q: "MAC flooding contra un switch busca:", o: ["Llenar la CAM table y forzar fail-open (hub-like)", "Cifrar el tráfico", "Cambiar la IP"], c: 0, e: "Saturada la tabla, el switch difunde a todos." },
      { q: "VLAN hopping (double tagging) explota:", o: ["DNS", "El manejo de etiquetas 802.1Q en trunks", "Certificados"], c: 1, e: "Capa 2: salta entre VLANs." },
    ],
  },
  6: {
    i: [
      { q: "El three-way handshake de TCP es:", o: ["SYN → SYN-ACK → ACK", "ACK → SYN → FIN", "SYN → FIN → ACK"], c: 0, e: "Establece la conexión fiable." },
      { q: "DNS sobre UDP usa el puerto 53, pero recurre a TCP cuando:", o: ["Nunca usa TCP", "La respuesta excede el tamaño (p.ej. zone transfer)", "Se usa HTTPS"], c: 1, e: "AXFR y respuestas grandes usan TCP/53." },
      { q: "Un registro DNS tipo MX define:", o: ["El servidor de correo del dominio", "La IP del host", "El alias"], c: 0, e: "MX = mail exchanger." },
      { q: "El flag TCP que solicita cerrar ordenadamente la conexión es:", o: ["RST", "FIN", "PSH"], c: 1, e: "RST aborta; FIN cierra ordenado." },
    ],
    a: [
      { q: "DNS cache poisoning busca:", o: ["Inyectar registros falsos en el resolver", "Saturar el ancho de banda", "Robar certificados"], c: 0, e: "Redirige a hosts maliciosos." },
      { q: "DNSSEC mitiga el poisoning mediante:", o: ["Cifrado del payload", "Firmas criptográficas que validan la integridad de las respuestas", "Cambiar el puerto"], c: 1, e: "Autentica el origen e integridad, no confidencialidad." },
      { q: "En Wireshark, el filtro 'tcp.flags.syn==1 && tcp.flags.ack==0' aísla:", o: ["Respuestas del servidor", "Intentos de inicio de conexión (posible scan)", "Tráfico cifrado"], c: 1, e: "SYN sin ACK = primer paquete del handshake." },
      { q: "DNS tunneling se detecta observando:", o: ["Consultas TXT/anormalmente largas y de alta frecuencia", "Pings ICMP", "Tráfico HTTPS normal"], c: 0, e: "Exfiltra datos codificados en consultas DNS." },
    ],
  },
  7: {
    i: [
      { q: "La máscara /26 deja para hosts usables:", o: ["62", "64", "30"], c: 0, e: "2^6 - 2 = 62." },
      { q: "NAT de tipo PAT (overload) permite:", o: ["Una IP pública por host", "Muchos hosts privados compartiendo una IP pública vía puertos", "Solo IPv6"], c: 1, e: "Multiplexa por puerto de origen." },
      { q: "El rango 10.0.0.0/8 es:", o: ["Público", "Privado (RFC 1918)", "Multicast"], c: 1, e: "10/8, 172.16/12, 192.168/16 son privados." },
      { q: "CIDR permite:", o: ["Subneteo de longitud variable (VLSM)", "Solo clases A/B/C fijas", "Eliminar el routing"], c: 0, e: "Asignación eficiente con prefijos arbitrarios." },
    ],
    a: [
      { q: "Una DMZ se diseña para:", o: ["Alojar servicios públicos aislados de la red interna", "Acelerar el WiFi", "Reemplazar el firewall"], c: 0, e: "Zona intermedia entre Internet y LAN." },
      { q: "La segmentación de red limita el:", o: ["Ancho de banda total", "Movimiento lateral del atacante", "Número de switches"], c: 1, e: "Contención: un segmento comprometido no expone todo." },
      { q: "Una arquitectura de red 'three-tier' separa:", o: ["Core, distribución y acceso", "WAN, MAN y PAN", "TCP, UDP e ICMP"], c: 0, e: "Modelo jerárquico clásico de Cisco." },
      { q: "Microsegmentación se diferencia de VLAN tradicional en que:", o: ["Aísla a nivel de carga de trabajo/host con políticas finas", "Usa cables más rápidos", "No requiere políticas"], c: 0, e: "Granularidad por workload, alineada a Zero Trust." },
    ],
  },
  8: {
    i: [
      { q: "El display filter de Wireshark para aislar un host es:", o: ["ip.addr == 10.0.0.5", "host=10.0.0.5", "filter ip 10.0.0.5"], c: 0, e: "Sintaxis de display filter." },
      { q: "'Follow TCP Stream' sirve para:", o: ["Reensamblar el flujo de una conexión y leerlo", "Cifrar paquetes", "Generar tráfico"], c: 0, e: "Reconstruye la conversación completa." },
      { q: "Credenciales en texto plano se ven típicamente en protocolos como:", o: ["HTTPS y SSH", "FTP, Telnet y HTTP", "TLS 1.3"], c: 1, e: "Protocolos sin cifrado exponen credenciales." },
      { q: "La diferencia entre capture filter y display filter es:", o: ["No hay diferencia", "Capture limita lo que se graba; display filtra lo ya capturado", "Display es más lento siempre"], c: 1, e: "Capture (BPF) en captura; display tras capturar." },
    ],
    a: [
      { q: "Un patrón de muchos SYN a puertos secuenciales desde una IP sugiere:", o: ["Transferencia de archivos", "Un escaneo de puertos (p.ej. Nmap)", "Tráfico de VoIP"], c: 1, e: "Barrido de puertos clásico." },
      { q: "tshark se prefiere sobre Wireshark GUI cuando:", o: ["Se necesita análisis automatizado/por línea de comandos", "Hay poca RAM siempre", "No existe la GUI"], c: 0, e: "Scripting y captura headless." },
      { q: "ARP spoofing en una captura se evidencia por:", o: ["Múltiples respuestas ARP mapeando una IP a distintas MAC", "Paquetes ICMP grandes", "Consultas DNS TXT"], c: 0, e: "Conflicto IP↔MAC = envenenamiento." },
      { q: "Para detectar DNS tunneling en Wireshark se observa:", o: ["Subdominios largos y codificados con alta frecuencia", "Handshakes TLS normales", "Pocos paquetes UDP"], c: 0, e: "Volumen y entropía anómalos en consultas DNS." },
    ],
  },
  9: {
    i: [
      { q: "En Python, qué función es la forma segura de ejecutar un comando del sistema evitando shell injection?", o: ["subprocess.run(['ls', '-l'], shell=False)", "eval(cmd)", "os.system(cmd) con la cadena completa"], c: 0, e: "subprocess.run con una lista de argumentos y shell=False evita la interpretación del shell, mitigando la inyección de comandos." },
      { q: "Qué librería de Python se usa comúnmente para construир y enviar paquetes de red a bajo nivel?", o: ["Flask", "Pandas", "Scapy"], c: 2, e: "Scapy permite forjar, enviar, capturar y decodificar paquetes de red, muy usada en pentesting." },
      { q: "Cuál es el riesgo principal de usar pickle.loads() sobre datos no confiables?", o: ["No soporta enteros grandes", "Solo consume mucha memoria", "Ejecución arbitraria de código al deserializar"], c: 2, e: "pickle puede ejecutar código arbitrario durante la deserialización; nunca debe usarse con datos no confiables." },
      { q: "Qué módulo de la librería estándar permite generar tokens criptográficamente seguros?", o: ["random", "secrets", "uuid"], c: 1, e: "El módulo secrets genera valores aleatorios aptos para criptografía; random no es seguro para tokens." },
    ],
    a: [
      { q: "Por qué eval() sobre entrada del usuario es peligroso incluso restringiendo globals?", o: ["Porque se puede escapar el sandbox accediendo a __builtins__ vía atributos de objetos", "Porque es lento", "Porque no acepta listas"], c: 0, e: "Los sandboxes de eval suelen romperse navegando atributos como __class__, __bases__, __subclasses__ hasta llegar a builtins peligrosos." },
      { q: "Qué técnica usa un atacante para ofuscar payloads de Python evitando detección estática?", o: ["Codificación base64 + exec de la cadena decodificada", "Usar type hints", "Indentar con tabs"], c: 0, e: "Encadenar base64/zlib + exec/compile dinámico oculta el código fuente real de los escáneres estáticos simples." },
      { q: "En un GIL-bound script de fuerza bruta, qué enfoque maximiza el paralelismo real?", o: ["multiprocessing o asyncio según tipo de carga", "threading puro", "más recursión"], c: 0, e: "El GIL serializa hilos CPU-bound; multiprocessing usa procesos separados (CPU-bound) y asyncio sirve para I/O-bound." },
      { q: "Cómo se logra path traversal explotando os.path.join con entrada absoluta del usuario?", o: ["Si el segundo argumento es absoluto, os.path.join descarta el prefijo base", "join lanza excepción", "join siempre concatena seguro"], c: 0, e: "os.path.join('/base', '/etc/passwd') devuelve '/etc/passwd' porque un componente absoluto descarta los anteriores." },
    ],
  },
  10: {
    i: [
      { q: "Qué cabecera HTTP mitiga ataques XSS restringiendo orígenes de scripts?", o: ["Accept-Language", "Content-Security-Policy", "X-Powered-By"], c: 1, e: "CSP limita las fuentes desde donde se puede cargar y ejecutar contenido, reduciendo el impacto de XSS." },
      { q: "Qué atributo de cookie evita que JavaScript del cliente pueda leerla?", o: ["SameSite", "Secure", "HttpOnly"], c: 2, e: "HttpOnly impide el acceso a la cookie desde document.cookie, mitigando robo de sesión vía XSS." },
      { q: "Cuál es la diferencia clave entre XSS reflejado y almacenado?", o: ["El almacenado persiste en el servidor y afecta a múltiples víctimas", "No hay diferencia", "El reflejado se guarda en la base de datos"], c: 0, e: "El XSS almacenado queda guardado (ej. en un comentario) y se sirve a cada visitante; el reflejado depende de un enlace manipulado." },
      { q: "Qué función de JavaScript debe evitarse por permitir ejecución dinámica de código?", o: ["Array.map()", "eval()", "JSON.parse()"], c: 1, e: "eval() ejecuta cadenas como código; con entrada no confiable habilita XSS y otras inyecciones." },
    ],
    a: [
      { q: "Qué permite un ataque de prototype pollution en JavaScript?", o: ["Acelerar el motor V8", "Cifrar el DOM", "Modificar Object.prototype para inyectar propiedades que afectan a todos los objetos"], c: 2, e: "Contaminar Object.prototype puede alterar lógica de la app, llevar a bypass de auth o incluso RCE en backends Node." },
      { q: "Cómo bypassa un atacante una CSP basada en nonce mal implementada?", o: ["Quitando la cabecera desde el cliente", "Reusando un nonce estático/predecible o vía dangling markup", "Usando HTTPS"], c: 1, e: "Si el nonce no es aleatorio por respuesta o hay sinks como JSONP/script-gadgets permitidos, la CSP se evade." },
      { q: "Qué hace efectivo un ataque DOM clobbering?", o: ["Borrar el CSS", "Cambiar el favicon", "Sobrescribir variables globales usando atributos id/name de elementos HTML"], c: 2, e: "Elementos con id/name crean propiedades en window/document que pueden sobrescribir variables y romper checks de seguridad." },
      { q: "En un ataque de deserialización en Node.js, qué gadget se busca típicamente?", o: ["Un import ESM", "Un comentario JSDoc", "Una cadena que invoque child_process o funciones tipo IIFE en la reconstrucción"], c: 2, e: "Librerías inseguras que reconstruyen funciones permiten gadgets que ejecutan código (ej. _$$ND_FUNC$$_ en node-serialize)." },
    ],
  },
  11: {
    i: [
      { q: "Cuál es la defensa principal contra SQL injection?", o: ["Escapar manualmente las comillas", "Consultas parametrizadas (prepared statements)", "Usar SELECT *"], c: 1, e: "Las prepared statements separan código de datos, impidiendo que la entrada altere la estructura de la consulta." },
      { q: "Qué tipo de SQLi extrae datos observando si la consulta es verdadera o falsa sin ver el resultado?", o: ["Blind SQL injection", "Union-based directa", "Error-based con mensaje completo"], c: 0, e: "En blind SQLi el atacante infiere datos por respuestas booleanas o tiempos, sin output directo." },
      { q: "Qué principio reduce el daño de una SQLi exitosa a nivel de cuenta de base de datos?", o: ["Privilegio mínimo en el usuario de la aplicación", "Usar root para todo", "Desactivar el firewall"], c: 0, e: "Si la cuenta de la app solo tiene permisos necesarios, una inyección no podrá hacer DROP, ni leer otras tablas." },
      { q: "Qué payload clásico prueba una inyección booleana simple?", o: ["' OR '1'='1", "SELECT version()", "DELETE FROM users"], c: 0, e: "' OR '1'='1 fuerza una condición siempre verdadera, típico para bypass de login o detección." },
    ],
    a: [
      { q: "Cómo se realiza una time-based blind SQLi en MySQL?", o: ["Con un simple ORDER BY", "Con SELECT * FROM info", "Con SLEEP() condicional, midiendo el retardo de respuesta"], c: 2, e: "Inyectar IF(condición, SLEEP(5), 0) revela datos bit a bit según el tiempo de respuesta del servidor." },
      { q: "Qué permite un ataque SQLi de segundo orden (second-order)?", o: ["Solo afecta a NoSQL", "Inyectar en un campo que se almacena y se ejecuta peligrosamente en una consulta posterior", "Es lo mismo que un union directo"], c: 1, e: "El payload se guarda benignamente y se dispara más tarde cuando otra parte de la app lo usa en SQL sin sanear." },
      { q: "Cómo se exfiltra data vía out-of-band SQLi en SQL Server?", o: ["Con un GROUP BY", "Imposible sin output directo", "Usando funciones como xp_dirtree o consultas DNS/HTTP hacia un servidor del atacante"], c: 2, e: "OOB usa canales externos (DNS, SMB, HTTP) para sacar datos cuando no hay respuesta visible ni temporal fiable." },
      { q: "Por qué la concatenación con stored procedures dinámicos sigue siendo vulnerable?", o: ["Porque cifran la consulta", "Si el SP construye SQL dinámico con EXEC sobre input, la inyección persiste", "Porque los SP siempre son seguros"], c: 1, e: "Un stored procedure que arma cadenas con EXEC/sp_executesql sin parametrizar reintroduce la inyección." },
    ],
  },
  12: {
    i: [
      { q: "Qué función de C es notoriamente insegura por no limitar el tamaño de copia?", o: ["strncpy()", "strcpy()", "memmove()"], c: 1, e: "strcpy() copia hasta el null sin verificar el tamaño del buffer destino, causando desbordamientos." },
      { q: "Qué protección del compilador detecta corrupción del stack en tiempo de ejecución?", o: ["Comentarios", "Optimización -O2", "Stack canary"], c: 2, e: "El stack canary coloca un valor centinela antes del return address; si cambia, se aborta el programa." },
      { q: "Qué vulnerabilidad surge al usar memoria después de liberarla?", o: ["Integer overflow", "Type confusion exclusivamente", "Use-after-free"], c: 2, e: "Use-after-free ocurre al desreferenciar un puntero a memoria ya liberada, explotable para control de flujo." },
      { q: "Qué hace la protección ASLR?", o: ["Aleatoriza las direcciones de memoria del proceso", "Cifra el binario", "Elimina punteros"], c: 0, e: "ASLR randomiza la ubicación de stack, heap y librerías, dificultando que el atacante prediga direcciones." },
    ],
    a: [
      { q: "Qué técnica permite explotar binarios con DEP/NX activado?", o: ["Desactivar el kernel", "Return-Oriented Programming (ROP)", "Inyectar shellcode en el stack directamente"], c: 1, e: "ROP encadena gadgets existentes (terminados en ret) para lograr ejecución sin inyectar código en regiones no ejecutables." },
      { q: "Cómo se aprovecha una vulnerabilidad de format string como printf(user)?", o: ["Con %n se puede escribir en memoria y con %x/%s leerla", "Solo permite imprimir texto", "Requiere root siempre"], c: 0, e: "Los especificadores como %n escriben el número de bytes impresos en una dirección, permitiendo escrituras arbitrarias." },
      { q: "Qué objetivo busca un ataque de heap grooming/feng shui?", o: ["Liberar toda la RAM", "Ordenar el heap para colocar objetos en posiciones predecibles y explotables", "Cifrar el heap"], c: 1, e: "Manipular asignaciones/liberaciones controla el layout del heap para que overflows caigan sobre estructuras útiles." },
      { q: "Por qué un integer overflow puede derivar en un buffer overflow?", o: ["Porque acelera el cálculo", "No tienen relación", "Un tamaño que desborda se vuelve pequeño y se asigna un buffer insuficiente"], c: 2, e: "Si el cálculo del tamaño desborda y queda pequeño, malloc reserva poco y la copia posterior sobrescribe memoria adyacente." },
    ],
  },
  13: {
    i: [
      { q: "Qué protocolo de seguridad WiFi está roto y nunca debe usarse?", o: ["WPA2-Enterprise", "WEP", "WPA3"], c: 1, e: "WEP usa RC4 con IVs débiles y se rompe en minutos capturando suficiente tráfico." },
      { q: "Qué hace un ataque de deauthentication en redes WiFi?", o: ["Cifra el tráfico", "Aumenta la señal", "Envía tramas para desconectar clientes del AP"], c: 2, e: "El atacante envía tramas de deauth (no autenticadas en redes sin PMF) forzando reconexión y captura del handshake." },
      { q: "Qué es un ataque Evil Twin?", o: ["Un AP falso que imita el SSID legítimo para capturar credenciales", "Un cifrado doble", "Dos routers en serie"], c: 0, e: "El Evil Twin clona el SSID/BSSID para que las víctimas se conecten y el atacante intercepte su tráfico." },
      { q: "Qué mejora introduce WPA3 sobre WPA2 en redes personales?", o: ["Elimina el cifrado", "SAE (Simultaneous Authentication of Equals) resistente a ataques offline", "Vuelve a usar RC4"], c: 1, e: "SAE (Dragonfly) reemplaza el PSK handshake, evitando ataques de diccionario offline sobre el handshake capturado." },
    ],
    a: [
      { q: "Qué explota la vulnerabilidad KRACK en WPA2?", o: ["La reinstalación de la clave en el 4-way handshake reiniciando nonces", "Un fallo de WEP", "Una contraseña débil"], c: 0, e: "KRACK fuerza la reinstalación de una clave ya usada, reseteando nonces y permitiendo descifrado/replay de tramas." },
      { q: "Cómo permite PMKID un ataque sin capturar el 4-way handshake completo?", o: ["El AP expone el PMKID en el primer mensaje EAPOL, crackeable offline", "Requiere un cliente conectado siempre", "Solo funciona en WEP"], c: 0, e: "El ataque PMKID (hashcat 16800) deriva la PMK del PMKID que el AP envía, sin esperar a un cliente." },
      { q: "Qué objetivo tiene el ataque Dragonblood contra WPA3-SAE?", o: ["Side-channels y downgrade que filtran info de la contraseña", "Romper AES-256 por fuerza bruta", "Desactivar el firmware"], c: 0, e: "Dragonblood usa fugas timing/cache y forzado de downgrade a WPA2 para recuperar el password pese a SAE." },
      { q: "En 802.1X/EAP, qué ataque permite robar credenciales con un AP falso?", o: ["Un ataque de deauth solo", "Evil Twin con servidor RADIUS rogue capturando el challenge/response de EAP", "WPS PIN brute force"], c: 1, e: "Sin validación del certificado del servidor, un RADIUS rogue captura el handshake MSCHAPv2 para crackear offline." },
    ],
  },
  14: {
    i: [
      { q: "Qué comando muestra los procesos en ejecución de forma interactiva?", o: ["ls", "top", "cat"], c: 1, e: "top (o htop) muestra procesos, uso de CPU y memoria en tiempo real." },
      { q: "Qué representa el primer carácter 'd' en la salida de ls -l?", o: ["Un dispositivo", "Un enlace simbólico", "Un directorio"], c: 2, e: "En ls -l, 'd' indica directorio; '-' archivo regular y 'l' enlace simbólico." },
      { q: "Dónde se almacenan tradicionalmente los hashes de contraseñas en Linux?", o: ["/etc/shadow", "/etc/hosts", "/etc/passwd"], c: 0, e: "/etc/shadow guarda los hashes y solo es legible por root; /etc/passwd ya no contiene los hashes." },
      { q: "Qué hace el comando chmod 600 archivo?", o: ["Ejecución para el grupo", "Lectura para todos", "Lectura/escritura solo para el propietario"], c: 2, e: "600 da rw al propietario y nada a grupo/otros (rw-------)." },
    ],
    a: [
      { q: "Qué información obtiene un atacante de /proc/[pid]/environ?", o: ["Solo el PID", "Variables de entorno del proceso, posibles secretos/tokens", "El kernel completo"], c: 1, e: "environ puede contener credenciales o tokens pasados por env; legible según permisos del proceso." },
      { q: "Qué permite la capability CAP_SETUID a un binario sin ser SUID root?", o: ["Cifrar discos", "Cambiar el UID del proceso, posible escalada", "Reiniciar el sistema"], c: 1, e: "Las Linux capabilities otorgan privilegios granulares; CAP_SETUID permite manipular UIDs y escalar si está mal asignada." },
      { q: "Cómo se usa LD_PRELOAD para escalada o evasión?", o: ["Forzando la carga de una librería maliciosa que intercepta llamadas", "Borrando el kernel", "Cambiando el SSID"], c: 0, e: "LD_PRELOAD inyecta una .so que hookea funciones; si un binario privilegiado la respeta, permite ejecución de código." },
      { q: "Qué técnica de persistencia abusa de los namespaces y cgroups en contenedores?", o: ["Editar /etc/motd", "Cambiar el hostname", "Escape de contenedor montando el host vía /proc o capabilities excesivas"], c: 2, e: "Contenedores privilegiados o con CAP_SYS_ADMIN permiten montar el filesystem del host y escapar al nodo." },
    ],
  },
  15: {
    i: [
      { q: "Qué hace el shebang #!/bin/bash al inicio de un script?", o: ["Cifra el script", "Es un comentario ignorado", "Indica el intérprete que ejecutará el script"], c: 2, e: "El shebang le dice al sistema qué intérprete usar para ejecutar el archivo." },
      { q: "Cómo se capturan correctamente todos los argumentos de un script preservando espacios?", o: ["$@ entre comillas dobles", "$*", "$#"], c: 0, e: "'$@' (con comillas) expande cada argumento por separado preservando espacios; $* los une en una sola palabra." },
      { q: "Qué operador ejecuta el segundo comando solo si el primero tiene éxito?", o: [";", "&&", "||"], c: 1, e: "&& encadena por éxito (exit 0); || ejecuta si falla; ; ejecuta siempre." },
      { q: "Qué riesgo introduce usar variables sin comillas en rutas de archivo?", o: ["Cifrado automático", "Mayor velocidad", "Word splitting y globbing inesperados"], c: 2, e: "Sin comillas, Bash separa por espacios y expande comodines, causando bugs y vulnerabilidades de inyección de rutas." },
    ],
    a: [
      { q: "Por qué eval con datos no confiables en Bash es peligroso?", o: ["Re-interpreta la cadena como comandos, permitiendo inyección", "Solo imprime texto", "Acelera el script"], c: 0, e: "eval reevalúa su argumento como código de shell; con input controlado por el atacante deriva en ejecución arbitraria." },
      { q: "Qué vulnerabilidad explotó Shellshock en Bash?", o: ["Un overflow del prompt", "Un fallo de SSH keys", "Definiciones de funciones en variables de entorno ejecutaban código tras su declaración"], c: 2, e: "Bash ejecutaba el código que seguía a una función exportada en una env var, explotable vía CGI/HTTP." },
      { q: "Cómo se mitiga una condición de carrera (TOCTOU) en scripts que crean temporales?", o: ["Correr como root", "Usar /tmp/archivo fijo", "Usar mktemp con permisos seguros y evitar nombres predecibles"], c: 2, e: "mktemp crea ficheros únicos atómicamente con permisos restringidos, evitando symlink attacks y races." },
      { q: "Qué permite la inyección por IFS (Internal Field Separator) manipulado?", o: ["Alterar cómo Bash divide cadenas, cambiando rutas o argumentos parseados", "Cifrar el script", "Acelerar loops"], c: 0, e: "Modificar IFS cambia el splitting de palabras; en scripts SUID/CGI puede redirigir la ejecución de comandos." },
    ],
  },
  16: {
    i: [
      { q: "Qué representa el bit SUID en un binario ejecutable?", o: ["Se ejecuta con los privilegios del propietario del archivo", "Se borra al ejecutarse", "Solo lo puede leer root"], c: 0, e: "SUID hace que el binario corra con el UID del dueño (a menudo root), origen frecuente de escaladas." },
      { q: "Qué comando lista los permisos sudo del usuario actual?", o: ["sudo -l", "chmod sudo", "sudo su"], c: 0, e: "sudo -l muestra qué comandos puede ejecutar el usuario vía sudo y bajo qué condiciones." },
      { q: "Qué hace AppArmor en un sistema Linux?", o: ["Gestiona paquetes", "Cifra el disco", "Confina programas mediante perfiles de control de acceso obligatorio"], c: 2, e: "AppArmor aplica MAC por ruta de archivo, limitando lo que cada programa confinado puede hacer." },
      { q: "Cómo se encuentran binarios SUID en el sistema?", o: ["ls -l /etc", "cat /etc/passwd", "find / -perm -4000 -type f 2>/dev/null"], c: 2, e: "El permiso 4000 es el bit SUID; find con -perm -4000 los enumera, paso típico de enumeración para escalada." },
    ],
    a: [
      { q: "Cómo se explota una entrada sudo NOPASSWD sobre un binario con función de shell (GTFOBins)?", o: ["Invocando la función de escape del binario para obtener una shell root", "No es explotable nunca", "Solo borrando logs"], c: 0, e: "Muchos binarios (vim, less, find) permiten escapar a una shell; si sudo los permite sin password, dan root." },
      { q: "Qué riesgo introduce un SGID en un directorio compartido mal configurado?", o: ["Borra el directorio", "Cifra todo", "Los archivos nuevos heredan el grupo, exponiendo datos a miembros del grupo"], c: 2, e: "SGID en directorios propaga el grupo a archivos creados; con grupos amplios puede filtrar información sensible." },
      { q: "Qué permite un módulo PAM malicioso instalado por un atacante?", o: ["Capturar contraseñas o crear backdoors de autenticación", "Acelerar el login", "Cifrar /etc"], c: 0, e: "PAM controla la autenticación; un módulo trojanizado puede registrar credenciales o aceptar una contraseña maestra." },
      { q: "Por qué SELinux en modo enforcing puede frustrar una escalada aún con root comprometido?", o: ["Porque desactiva sudo", "Porque cifra la RAM", "Las políticas MAC restringen acciones según el contexto, incluso para root"], c: 2, e: "SELinux aplica controles obligatorios por tipo/contexto; un proceso confinado puede no poder hacer lo que su UID permitiría." },
    ],
  },
  17: {
    i: [
      { q: "Dónde se configuran las claves de ejecución automática al inicio en Windows?", o: ["En el Registro, claves Run/RunOnce", "En el Firewall", "En el Visor de eventos"], c: 0, e: "HKCU/HKLM ...\\CurrentVersion\\Run y RunOnce son ubicaciones clásicas de persistencia." },
      { q: "Qué herramienta de Windows centraliza los registros de seguridad y sistema?", o: ["Bloc de notas", "Paint", "Visor de eventos (Event Viewer)"], c: 2, e: "El Event Viewer muestra logs de Seguridad, Sistema y Aplicación, clave para detección e investigación." },
      { q: "Qué permite GPO (Group Policy Object) en un dominio?", o: ["Reemplazar el kernel", "Cifrar el BIOS", "Aplicar configuraciones de seguridad de forma centralizada"], c: 2, e: "Las GPO distribuyen políticas (contraseñas, restricciones, scripts) a usuarios y equipos del dominio." },
      { q: "Qué componente de Windows inspecciona scripts antes de su ejecución?", o: ["WSUS", "AMSI (Antimalware Scan Interface)", "DHCP"], c: 1, e: "AMSI permite que antimalware escanee contenido en memoria (PowerShell, macros) antes de ejecutarse." },
    ],
    a: [
      { q: "Cómo se realiza un bypass común de AMSI en memoria?", o: ["Parcheando AmsiScanBuffer o seteando amsiInitFailed para neutralizar el escaneo", "Reiniciando el equipo", "Desinstalando .NET"], c: 0, e: "Atacantes parchean la función AmsiScanBuffer o fuerzan errores de inicialización para que AMSI no analice payloads." },
      { q: "Qué busca un atacante al deshabilitar/evadir ETW (Event Tracing for Windows)?", o: ["Cifrar archivos", "Reducir la telemetría que ven los EDR para operar sin ser detectado", "Acelerar el disco"], c: 1, e: "Muchos EDR consumen eventos ETW; cegarlo (patching de EtwEventWrite) limita la visibilidad de la actividad maliciosa." },
      { q: "Qué técnica de persistencia abusa de los servicios de Windows?", o: ["Editar el hosts", "Cambiar el fondo de pantalla", "Crear o modificar un servicio con binario malicioso que arranca con SYSTEM"], c: 2, e: "Servicios con ImagePath controlado o débilmente protegidos corren como SYSTEM en cada arranque, persistencia y escalada." },
      { q: "Qué es el unhooking de DLLs respecto a un EDR?", o: ["Restaurar las funciones originales de ntdll para evitar los hooks del EDR", "Cifrar la RAM", "Desinstalar Windows"], c: 0, e: "El malware recarga una copia limpia de ntdll.dll desde disco para sobrescribir los hooks inline que el EDR colocó." },
    ],
  },
  18: {
    i: [
      { q: "Qué protocolo de autenticación usa principalmente Active Directory?", o: ["Kerberos", "SNMP", "FTP"], c: 0, e: "Kerberos es el protocolo principal de autenticación en AD, basado en tickets emitidos por el KDC." },
      { q: "Qué servicio del Domain Controller emite los tickets Kerberos?", o: ["Print Spooler", "DHCP", "KDC (Key Distribution Center)"], c: 2, e: "El KDC, compuesto por AS y TGS, emite el TGT y los service tickets en Kerberos." },
      { q: "Qué protocolo se usa para consultar el directorio en AD?", o: ["LDAP", "SMTP", "POP3"], c: 0, e: "LDAP permite buscar y modificar objetos del directorio (usuarios, grupos, equipos)." },
      { q: "Qué representa un TGT en Kerberos?", o: ["Un ticket que permite solicitar otros tickets de servicio", "Un certificado TLS", "La contraseña en claro"], c: 0, e: "El Ticket Granting Ticket se obtiene tras autenticarse y sirve para pedir service tickets al TGS." },
    ],
    a: [
      { q: "En qué consiste el ataque Kerberoasting?", o: ["Robar el TGT del DC por red", "Forzar el reinicio del KDC", "Solicitar service tickets de cuentas con SPN y crackear offline su hash RC4"], c: 2, e: "El TGS cifra el ticket con el hash de la cuenta de servicio; cualquier usuario puede pedirlo y crackearlo offline." },
      { q: "Qué permite el ataque DCSync?", o: ["Apagar el dominio", "Cambiar el SSID", "Simular un DC y solicitar la replicación de hashes de contraseñas (krbtgt incluido)"], c: 2, e: "Con permisos de replicación (DS-Replication-Get-Changes), DCSync extrae hashes vía el protocolo MS-DRSR sin tocar el disco del DC." },
      { q: "Qué es un Golden Ticket?", o: ["Un certificado de CA pública", "Un ticket de soporte", "Un TGT forjado con el hash de krbtgt que otorga acceso persistente al dominio"], c: 2, e: "Con el hash de krbtgt se forjan TGTs arbitrarios (cualquier usuario/grupo), persistencia casi total hasta rotar krbtgt dos veces." },
      { q: "Qué habilita el ataque AS-REP Roasting?", o: ["Robar certificados", "Cuentas con preautenticación Kerberos deshabilitada exponen un hash crackeable offline", "Bypass de MFA siempre"], c: 1, e: "Sin pre-auth, el AS responde con datos cifrados con el hash del usuario, obtenibles sin credenciales y crackeables." },
    ],
  },
  19: {
    i: [
      { q: "Qué cmdlet de PowerShell descarga contenido de una URL?", o: ["Invoke-WebRequest", "Stop-Service", "Get-Help"], c: 0, e: "Invoke-WebRequest (o Invoke-RestMethod) realiza peticiones HTTP, usado tanto en administración como en ataques." },
      { q: "Qué política de PowerShell controla la ejecución de scripts?", o: ["Firewall", "ExecutionPolicy", "BitLocker"], c: 1, e: "ExecutionPolicy (Restricted, RemoteSigned, etc.) regula si se permiten scripts, aunque no es una barrera de seguridad real." },
      { q: "Qué cmdlet lista los procesos en ejecución?", o: ["New-Item", "Get-Process", "Set-Location"], c: 1, e: "Get-Process devuelve los procesos activos con su PID y uso de recursos." },
      { q: "Por qué ExecutionPolicy no es un control de seguridad?", o: ["Porque solo afecta a Linux", "Porque cifra los scripts", "Porque se puede evadir fácilmente (-ExecutionPolicy Bypass, pipe a powershell)"], c: 2, e: "Es una medida de seguridad operativa, no de seguridad; existen múltiples bypass triviales documentados por Microsoft." },
    ],
    a: [
      { q: "Qué ventaja ofrece al atacante ejecutar PowerShell sin lanzar powershell.exe?", o: ["Mayor velocidad de disco", "Evadir application whitelisting/logging usando runspaces vía .NET (System.Management.Automation)", "Cifrado nativo"], c: 1, e: "Cargar el runtime de PowerShell por DLL/runspace evita detecciones basadas en el binario powershell.exe." },
      { q: "Qué registra el Script Block Logging de PowerShell?", o: ["Solo la hora", "El contenido de los bloques de script ejecutados, incluso ofuscados deofuscados", "Nada relevante"], c: 1, e: "Script Block Logging (event 4104) captura el código ejecutado y a menudo lo desofusca, clave para detección." },
      { q: "Qué es el Constrained Language Mode y por qué lo evaden los atacantes?", o: ["Cifra variables", "Limita las capacidades del lenguaje; se busca bypass para ejecutar payloads completos", "Acelera scripts"], c: 1, e: "CLM (a menudo con AppLocker/WDAC) restringe tipos y métodos; los atacantes buscan bypass para recuperar Full Language." },
      { q: "Cómo abusa un atacante de WMI/CIM desde PowerShell para persistencia?", o: ["Borrando logs solamente", "Creando suscripciones a eventos WMI permanentes que ejecutan código ante un trigger", "Editando el wallpaper"], c: 1, e: "Las suscripciones permanentes WMI (filter+consumer+binding) ejecutan payloads fileless ante eventos del sistema." },
    ],
  },
  20: {
    i: [
      { q: "Qué caracteriza a la criptografía simétrica?", o: ["Usa claves pública y privada distintas", "No usa claves", "Usa la misma clave para cifrar y descifrar"], c: 2, e: "En cifrado simétrico ambas partes comparten la misma clave secreta (ej. AES)." },
      { q: "Por qué el modo ECB es inseguro para datos estructurados?", o: ["No soporta AES", "Bloques iguales producen ciphertext igual, filtrando patrones", "Es muy lento"], c: 1, e: "ECB cifra cada bloque independientemente; patrones del plaintext (ej. una imagen) se ven en el ciphertext." },
      { q: "Qué aporta el modo GCM frente a CBC?", o: ["Solo confidencialidad", "Cifrado autenticado (confidencialidad + integridad)", "Compresión"], c: 1, e: "GCM es un modo AEAD: cifra y genera un tag de autenticación que detecta manipulaciones." },
      { q: "Qué es un cifrado de flujo (stream cipher)?", o: ["Es asimétrico", "Cifra solo bloques de 1KB", "Cifra bit a bit o byte a byte usando un keystream"], c: 2, e: "Los stream ciphers (ej. ChaCha20) generan un keystream que se XOR-ea con el plaintext." },
    ],
    a: [
      { q: "Por qué reutilizar un nonce en AES-GCM es catastrófico?", o: ["Permite recuperar el authentication key (H) y falsificar tags / filtrar plaintext", "Solo hace el cifrado más lento", "No tiene efecto"], c: 0, e: "Reutilizar nonce con la misma clave en GCM rompe la autenticación (forgeable) y permite XOR de plaintexts." },
      { q: "Qué es un ataque de padding oracle contra CBC?", o: ["Un fallo de GCM", "Romper AES por fuerza bruta", "Inferir el plaintext observando si el padding es válido en las respuestas"], c: 2, e: "Si el sistema revela errores de padding distintos, se descifra byte a byte sin conocer la clave." },
      { q: "Por qué CTR y GCM requieren nunca reutilizar el par (clave, nonce)?", o: ["Porque cifran dos veces", "Porque generan un keystream determinista; reuso permite XOR de mensajes", "Porque son asimétricos"], c: 1, e: "En modos basados en keystream, mismo (clave,nonce) produce mismo keystream; XOR de dos ciphertexts cancela la clave." },
      { q: "Qué problema resuelve un esquema AEAD respecto a 'encrypt-then-MAC' manual?", o: ["Integra cifrado e integridad evitando errores de composición y soportando AAD", "Reemplaza al hashing", "Hace innecesaria la clave"], c: 0, e: "AEAD (GCM, ChaCha20-Poly1305) provee confidencialidad e integridad de datos y de cabeceras (AAD) de forma robusta." },
    ],
  },
  21: {
    i: [
      { q: "Qué clave se usa para cifrar un mensaje dirigido a un destinatario en criptografía asimétrica?", o: ["La clave pública del destinatario", "La clave privada del emisor", "Una clave simétrica compartida"], c: 0, e: "Se cifra con la clave pública del destinatario, que solo él puede descifrar con su privada." },
      { q: "Para qué sirve la clave privada al firmar digitalmente?", o: ["Cifra para todos", "Reemplaza al hash", "Genera la firma que se verifica con la clave pública"], c: 2, e: "La firma se crea con la privada del firmante y cualquiera la verifica con la pública correspondiente." },
      { q: "Qué ventaja ofrece ECC frente a RSA?", o: ["Es simétrico", "No necesita claves", "Mismo nivel de seguridad con claves mucho más pequeñas"], c: 2, e: "ECC logra seguridad equivalente con tamaños de clave menores, ideal para móviles y TLS modernos." },
      { q: "Qué resuelve el intercambio Diffie-Hellman?", o: ["Firmar documentos", "Comprimir datos", "Acordar una clave secreta compartida sobre un canal inseguro"], c: 2, e: "DH permite a dos partes derivar un secreto común sin transmitirlo, base del key exchange en TLS." },
    ],
    a: [
      { q: "Por qué Diffie-Hellman clásico es vulnerable a man-in-the-middle sin autenticación?", o: ["Porque usa RSA", "Porque la clave es pública", "Un atacante puede negociar claves separadas con cada parte e interceptar todo"], c: 2, e: "DH establece secretos pero no autentica a los pares; sin firmas/certificados, un MITM negocia dos secretos." },
      { q: "Qué riesgo introduce usar RSA sin padding (textbook RSA)?", o: ["Es demasiado lento", "Es determinista y maleable, vulnerable a ataques como el de Bleichenbacher / chosen-ciphertext", "No se puede cifrar"], c: 1, e: "RSA sin OAEP es determinista y homomórfico parcialmente; permite ataques de recuperación y maleabilidad." },
      { q: "Qué propiedad ofrece la Perfect Forward Secrecy (PFS) con ECDHE?", o: ["Acelera el handshake", "Elimina los certificados", "Comprometer la clave a largo plazo no descifra sesiones pasadas (claves efímeras)"], c: 2, e: "Las claves efímeras por sesión hacen que el robo futuro de la clave estática no exponga tráfico previamente capturado." },
      { q: "Qué falla criptográfica explota un ataque de curva inválida en ECC?", o: ["Enviar puntos que no pertenecen a la curva para filtrar bits de la clave privada", "Reutilizar nonce en AES", "Romper SHA-256"], c: 0, e: "Si la implementación no valida que el punto está en la curva correcta, opera en una curva débil y filtra la clave." },
    ],
  },
  22: {
    i: [
      { q: "Por qué SHA-256 no es adecuado por sí solo para almacenar contraseñas?", o: ["No produce hash fijo", "Es demasiado lento", "Es muy rápido y permite ataques de fuerza bruta masivos"], c: 2, e: "Las contraseñas requieren funciones lentas y con sal (bcrypt, argon2); SHA-256 puro es demasiado rápido de atacar." },
      { q: "Qué aporta el salt a un hash de contraseña?", o: ["Cifra el hash", "Evita rainbow tables y que hashes iguales se repitan", "Acelera la verificación"], c: 1, e: "El salt único por usuario hace inútiles las tablas precomputadas y oculta contraseñas repetidas." },
      { q: "Qué rol cumple una CA (Certificate Authority) en PKI?", o: ["Emite y firma certificados validando identidades", "Genera nonces", "Cifra el tráfico simétricamente"], c: 0, e: "La CA es la entidad de confianza que firma certificados, vinculando una clave pública a una identidad." },
      { q: "Qué algoritmo está diseñado específicamente para hashing de contraseñas y es resistente a GPU?", o: ["MD5", "CRC32", "argon2"], c: 2, e: "argon2 (ganador de la PHC) es memory-hard, resistiendo ataques con GPU/ASIC mejor que hashes rápidos." },
    ],
    a: [
      { q: "Qué hace inseguro a MD5 y SHA-1 para integridad/firmas hoy?", o: ["No producen salida fija", "Existen ataques de colisión prácticos", "Son demasiado lentos"], c: 1, e: "Se han demostrado colisiones prácticas (ej. SHAttered en SHA-1), por lo que no sirven para integridad ni certificados." },
      { q: "Qué previene un ataque de length extension y qué construcción lo evita?", o: ["Afecta a MD5/SHA-2 (Merkle-Damgard); HMAC o SHA-3 (sponge) lo evitan", "Afecta a AES; se evita con CBC", "Afecta a RSA; se evita con OAEP"], c: 0, e: "Las funciones Merkle-Damgard permiten extender un hash sin la clave; HMAC y SHA-3 (Keccak) no son vulnerables." },
      { q: "Qué garantiza el Certificate Transparency (CT)?", o: ["Cifra el certificado", "Acelera TLS", "Logs públicos auditables de certificados emitidos para detectar emisiones fraudulentas"], c: 2, e: "CT obliga a registrar certificados en logs públicos, permitiendo detectar certificados mal emitidos por una CA." },
      { q: "Por qué el factor de coste (cost/work factor) en bcrypt debe subir con el tiempo?", o: ["Para reducir el tamaño del hash", "Para compensar el aumento de poder de cómputo y mantener el hashing costoso", "Para eliminar el salt"], c: 1, e: "Aumentar el work factor mantiene el coste de cracking alto frente a hardware cada vez más potente." },
    ],
  },
  23: {
    i: [
      { q: "En un handshake TLS, ¿qué garantiza Perfect Forward Secrecy (PFS)?", o: ["Que la clave privada del servidor nunca caduca", "Que comprometer la clave privada a largo plazo no permite descifrar sesiones pasadas", "Que el certificado se renueva automáticamente"], c: 1, e: "PFS usa claves efímeras (ECDHE/DHE) por sesión, así que robar la clave del servidor no descifra tráfico previo." },
      { q: "¿Qué algoritmo de intercambio de claves provee PFS en TLS?", o: ["RSA key exchange", "Static Diffie-Hellman", "ECDHE"], c: 2, e: "ECDHE (Elliptic Curve Diffie-Hellman Ephemeral) genera claves efímeras por sesión, otorgando forward secrecy." },
      { q: "¿Qué protocolo VPN moderno usa la curva Curve25519 y ChaCha20-Poly1305 por defecto?", o: ["IPsec/IKEv1", "WireGuard", "PPTP"], c: 1, e: "WireGuard es un protocolo VPN minimalista que usa Curve25519, ChaCha20-Poly1305 y BLAKE2s." },
      { q: "En IPsec, ¿qué modo cifra todo el paquete IP original incluyendo la cabecera?", o: ["Modo transporte", "Modo túnel", "Modo transparente"], c: 1, e: "El modo túnel encapsula y cifra el paquete IP completo, usado en VPNs site-to-site." },
    ],
    a: [
      { q: "En un ataque de downgrade tipo POODLE, ¿qué debilidad se explota?", o: ["Una colisión en SHA-256", "El relleno (padding) no autenticado en CBC de SSL 3.0", "Reuso de nonce en GCM"], c: 1, e: "POODLE explota el padding determinista y no verificado de CBC en SSL 3.0 tras forzar un downgrade." },
      { q: "¿Qué propiedad de una cipher suite AEAD como AES-GCM evita ataques tipo padding oracle?", o: ["Combina cifrado y autenticación en una operacion, sin padding CBC", "Usa claves mas largas", "Comprime antes de cifrar"], c: 0, e: "AEAD (Authenticated Encryption with Associated Data) integra confidencialidad e integridad sin el padding vulnerable de CBC." },
      { q: "En TLS 1.3, ¿qué cambio reduce el handshake a 1-RTT y elimina suites inseguras?", o: ["Se eliminó la negociación de versión", "Se obligó a usar certificados autofirmados", "Se eliminaron RSA key exchange, CBC y MD5/SHA1, dejando solo AEAD + (EC)DHE"], c: 2, e: "TLS 1.3 elimina key exchange estático, CBC y hashes débiles, dejando solo (EC)DHE con PFS y cifrados AEAD." },
      { q: "El ataque 0-RTT de TLS 1.3 introduce qué riesgo de seguridad?", o: ["Replay de los datos enviados en early data", "Filtración del certificado raíz", "Colisión de nonce en HKDF"], c: 0, e: "Los datos 0-RTT (early data) no tienen protección anti-replay completa, por lo que pueden reenviarse." },
    ],
  },
  24: {
    i: [
      { q: "¿Qué hace el atributo de cookie SameSite=Strict?", o: ["Hace la cookie accesible solo por HTTPS", "Impide que la cookie se envíe en peticiones cross-site, incluyendo navegación de enlaces", "Cifra el valor de la cookie"], c: 1, e: "SameSite=Strict bloquea el envío de la cookie en cualquier contexto cross-site, mitigando CSRF." },
      { q: "¿Qué flag de cookie impide que JavaScript del lado cliente la lea vía document.cookie?", o: ["HttpOnly", "Secure", "Path"], c: 0, e: "HttpOnly impide el acceso desde JavaScript, mitigando el robo de cookies vía XSS." },
      { q: "¿Qué cabecera CORS permite que un origen específico acceda al recurso?", o: ["Access-Control-Allow-Origin", "Content-Security-Policy", "X-Frame-Options"], c: 0, e: "Access-Control-Allow-Origin define qué orígenes pueden leer la respuesta en peticiones cross-origin." },
      { q: "¿Qué directiva de CSP restringe desde dónde se pueden cargar scripts?", o: ["script-src", "frame-ancestors", "img-src"], c: 0, e: "script-src controla los orígenes válidos para cargar y ejecutar JavaScript, mitigando XSS." },
      { q: "El default cambio de SameSite a Lax en Chrome (2020) rompió:", o: ["Todos los login flows", "CSRF vía POST cross-site sin token, y algunos OAuth redirect flows con SameSite=Strict", "La compatibilidad con HTTPS"], c: 1, e: "OAuth con SameSite=Strict falla porque el callback es cross-site; Lax lo permite." },
      { q: "El prefijo `__Host-` en Set-Cookie fuerza:", o: ["HTTP-only", "Secure + Path=/ + sin Domain= — cierra cookie fixation vía subdominios", "Cifrado del valor"], c: 1, e: "Ejemplo: `Set-Cookie: __Host-session=X; Secure; HttpOnly; SameSite=Strict; Path=/`." },
      { q: "En CSP, `strict-dynamic` combinado con nonce hace que:", o: ["Todos los scripts se bloqueen", "Los scripts con nonce válido pueden cargar otros scripts dinámicamente sin necesidad de whitelist de hosts", "El CSP se desactive"], c: 1, e: "Elimina la necesidad de whitelist de dominios; menos bypasses documentados." },
      { q: "SRI requiere `crossorigin=\"anonymous\"` porque:", o: ["Es una convención", "Sin CORS habilitado el browser no puede verificar el hash y bloquea silenciosamente", "Reduce la latencia"], c: 1, e: "SRI + CORS es el par obligatorio; sin CORS, fetch silent-fail." },
      { q: "El header `Vary: X-Forwarded-Host` en cache poisoning previene:", o: ["Todos los ataques", "Que responses con X-Forwarded-Host distintos compartan cache key", "SQL injection"], c: 1, e: "Fix de unkeyed input: incluir en el Vary lo que la app refleja." },
    ],
    a: [
      { q: "¿Por qué una configuración CORS con Access-Control-Allow-Origin reflejado y Allow-Credentials true es peligrosa?", o: ["Desactiva HTTPS", "Bloquea todas las peticiones legítimas", "Permite a cualquier origen leer respuestas autenticadas con cookies de la víctima"], c: 2, e: "Reflejar el Origin atacante con credentials=true permite exfiltrar datos autenticados cross-origin." },
      { q: "¿Qué mecanismo de CSP mitiga XSS permitiendo solo scripts con un valor único por respuesta?", o: ["nonce o hash en script-src", "unsafe-inline", "report-uri"], c: 0, e: "Los nonces/hashes permiten inline scripts legítimos identificados, bloqueando inyecciones sin el valor correcto." },
      { q: "Un atacante usa SameSite=Lax como bypass: ¿qué tipo de petición sigue enviando la cookie?", o: ["Peticiones fetch con credenciales", "Navegaciones top-level GET iniciadas por el usuario", "Peticiones POST cross-site automáticas"], c: 1, e: "SameSite=Lax permite la cookie en navegaciones top-level GET, lo que aún puede abusarse para CSRF vía GET." },
      { q: "¿Qué riesgo introduce la directiva CSP con 'unsafe-eval' habilitada?", o: ["Permite eval() y constructores de Function, ampliando la superficie de XSS", "Desactiva el reporte de violaciones", "Bloquea WebSockets"], c: 0, e: "unsafe-eval habilita eval/Function, permitiendo ejecución dinámica de strings que facilita el XSS." },
      { q: "Trusted Types con `require-trusted-types-for 'script'` fuerza que:", o: ["Los inline scripts se bloqueen siempre", "Asignaciones a innerHTML/eval reciban solo objetos TrustedHTML/TrustedScript producidos por una policy registrada — string plano lanza TypeError", "Todos los scripts sean async"], c: 1, e: "Google usa esto en Gmail/Docs. Corta el 99% de XSS DOM antes de que ejecute." },
      { q: "Un bypass clásico de CSP con whitelist de hosts es:", o: ["Usar HTTP en vez de HTTPS", "JSONP endpoints en el CDN whitelisted (ej: `?callback=alert(1)`) o angular templates viejos", "Cifrar el payload"], c: 1, e: "Whitelist de `googleapis.com` o `cdnjs.cloudflare.com` sin filtro fine-grained ha sido explotado múltiples veces." },
      { q: "La HSTS Preload List de Chromium tiene un downside:", o: ["Latencia mayor", "Enviar `preload` es prácticamente irreversible (delays de meses en la remoción)", "Requiere pago"], c: 1, e: "Antes de enviar preload, verificar exhaustivamente que TODA la infra soporta HTTPS." },
      { q: "En un ataque SSL Strip 2 (2013), el vector residual sobre HSTS es:", o: ["Bypass total de HSTS", "Dominios sin preload en la PRIMERA visita — no hay HSTS aún, MITM strippea, HSTS cachea HTTP fake permanentemente", "Downgrade a TLS 1.0"], c: 1, e: "Fix: preload list + HSTS con includeSubDomains desde el primer despliegue." },
      { q: "El `Access-Control-Allow-Origin: null` acepta cuando:", o: ["No hay Origin header", "El Origin viene de <iframe sandbox>, data:, o file:// — `null` es una string válida y explotable desde iframes maliciosos", "Es HTTPS"], c: 1, e: "Vector histórico: iframe con sandbox permite Origin: null y explota configs mal escritas." },
    ],
  },
  25: {
    i: [
      { q: "Según OWASP Top 10 2021, ¿qué categoría ocupa el primer puesto?", o: ["Injection", "Cryptographic Failures", "Broken Access Control"], c: 2, e: "A01:2021 Broken Access Control subió al primer lugar por ser la falla más frecuente." },
      { q: "¿Qué describe la categoría Cryptographic Failures (A02)?", o: ["Configuraciones por defecto inseguras", "Datos sensibles expuestos por cifrado débil o ausente", "Errores de validación de entrada"], c: 1, e: "A02 (antes Sensitive Data Exposure) cubre fallos en proteger datos en tránsito y reposo." },
      { q: "Un IDOR (Insecure Direct Object Reference) pertenece a qué categoría?", o: ["A01 Broken Access Control", "A07 Identification and Authentication Failures", "A03 Injection"], c: 0, e: "Los IDOR son fallos de control de acceso donde se accede a objetos ajenos cambiando un identificador." },
      { q: "¿Qué categoría cubre SQLi, NoSQLi, comandos OS y LDAP injection?", o: ["A05 Security Misconfiguration", "A06 Vulnerable Components", "A03 Injection"], c: 2, e: "A03:2021 Injection agrupa todas las inyecciones donde datos no confiables se interpretan como código/consulta." },
      { q: "En OAuth 2.0, PKCE (Proof Key for Code Exchange) fue creado para:", o: ["Reemplazar HTTPS", "Proteger clients públicos (SPA, mobile) que no pueden guardar client_secret — code_verifier random + code_challenge", "Cifrar el password"], c: 1, e: "Sin PKCE, el authorization code interceptado se puede intercambiar. Con PKCE, se requiere el verifier original." },
      { q: "Un JWT firmado con HS256 y secret 'secret' o 'password' es vulnerable a:", o: ["XSS", "Cracking offline con hashcat mode 16500 → atacante forja tokens arbitrarios", "SSRF"], c: 1, e: "hashcat con rockyou.txt crackea secrets débiles en segundos. Usar secrets ≥256 bits aleatorios." },
      { q: "El principal riesgo de una app OAuth con implicit flow (deprecado) es:", o: ["Lento", "El access_token viaja en el fragment de URL → filtración vía Referer, extensiones, service workers", "No soporta MFA"], c: 1, e: "OAuth 2.1 prohíbe implicit flow por esto." },
      { q: "Un ataque de mass assignment en API modernas es:", o: ["Enviar muchos requests", "PATCH /users/me con `{ role: 'admin' }` — server acepta el field sin whitelist → escalada de privilegio", "SQL injection"], c: 1, e: "OWASP API Top 10: BOLA + Mass Assignment son los top 2 bugs." },
      { q: "Un business logic bug NO es detectable por:", o: ["Scanners automáticos (SAST/DAST) — requiere entender el negocio", "Testing manual", "Threat modeling"], c: 0, e: "Race conditions en checkout, coupon abuse, free-tier abuse — requieren pensar como fraudster." },
    ],
    a: [
      { q: "¿Cómo se diferencia A04 Insecure Design de A05 Security Misconfiguration?", o: ["A04 solo aplica a APIs", "A04 es una falla de diseño/arquitectura previa al código; A05 es configuración incorrecta de algo bien diseñado", "Son la misma categoría con distinto nombre"], c: 1, e: "Insecure Design es una falla conceptual de threat modeling; misconfiguration es implementación/config errónea." },
      { q: "Para mitigar Broken Access Control a escala, ¿qué patrón de diseño se recomienda?", o: ["Validar permisos solo en el frontend", "Denegar por defecto y validar autorización en el servidor en cada petición", "Confiar en ocultar la URL"], c: 1, e: "Deny-by-default con verificación server-side por solicitud previene bypass de controles client-side." },
      { q: "¿Qué técnica del lado servidor mitiga inyecciones SQL de forma robusta?", o: ["Escapar caracteres con regex propios", "Filtrar solo la palabra SELECT", "Consultas parametrizadas/prepared statements con binding de variables"], c: 2, e: "Las prepared statements separan código de datos, eliminando la causa raíz de la inyección." },
      { q: "En Cryptographic Failures, ¿por qué es inseguro almacenar contraseñas con SHA-256 simple?", o: ["No produce hash de longitud fija", "Es rápido y sin salt permite ataques de diccionario/rainbow tables masivos", "SHA-256 es reversible"], c: 1, e: "Los hashes rápidos sin salt/work-factor facilitan crackeo; se deben usar bcrypt/scrypt/Argon2." },
      { q: "En un JWT trust policy con HS256/RS256 confusion, el fix es:", o: ["Usar tokens más cortos", "Whitelist explícita: `if (header.alg !== 'RS256') reject` — decidir key basándose en alg VALIDADO, no declarado", "Deshabilitar OAuth"], c: 1, e: "Auth0 CVE-2020-28460 es el caso emblemático." },
      { q: "En OAuth con redirect_uri validation, el bug fue en 'startsWith' cuando:", o: ["El uri termina en /", "`miapp.com` matchea `miapp.com.evil.com` — el atacante controla el subdominio como sufijo", "El uri es HTTPS"], c: 1, e: "Fix: exact-match, no startsWith. Grammarly 2019 cayó exactamente así." },
      { q: "En BOLA, el patrón de mitigación server-side más robusto es:", o: ["Ocultar IDs", "Row-level security en la DB (Postgres RLS: `USING (user_id = auth.uid())`) — filtro obligatorio a nivel de motor", "Comentarios en el código"], c: 1, e: "Middleware de authorization se puede olvidar; RLS es cierre a nivel DB para cada query." },
      { q: "En un ataque de refresh token reuse, el detection pattern es:", o: ["Log solo", "Detectar que un refresh token ya usado se presenta de nuevo → revocar toda la familia (token family invalidation)", "Ignorar"], c: 1, e: "Auth0, Okta, Firebase implementan token family detection." },
      { q: "El SSTI (Server-Side Template Injection) escala a RCE en Jinja2 vía:", o: ["Comentarios HTML", "`{{ ''.__class__.__mro__[1].__subclasses__() }}` → enumera subclasses hasta Popen → shell arbitrario", "SQL union"], c: 1, e: "Uber 2016: Jinja2 SSTI en dashboard → RCE. Fix: SandboxedEnvironment." },
    ],
  },
  26: {
    i: [
      { q: "¿Qué describe A06 Vulnerable and Outdated Components?", o: ["Falta de logging", "Uso de librerías/frameworks con vulnerabilidades conocidas o sin parches", "Errores de cifrado"], c: 1, e: "A06 cubre dependencias desactualizadas o vulnerables que amplían la superficie de ataque." },
      { q: "¿Qué categoría cubre la falta de logs y monitoreo de incidentes?", o: ["A08 Software and Data Integrity Failures", "A09 Security Logging and Monitoring Failures", "A10 SSRF"], c: 1, e: "A09 trata la ausencia de logging/monitoreo que impide detectar y responder a ataques." },
      { q: "SSRF (Server-Side Request Forgery) corresponde a qué categoría 2021?", o: ["A07 Authentication Failures", "A10 Server-Side Request Forgery", "A03 Injection"], c: 1, e: "SSRF entró como categoría propia A10:2021 por su impacto en arquitecturas cloud." },
      { q: "¿Qué falla incluye A07 Identification and Authentication Failures?", o: ["Cifrado obsoleto de datos", "Componentes vulnerables", "Permitir contraseñas débiles y ataques de credential stuffing"], c: 2, e: "A07 cubre autenticación débil, gestión de sesiones deficiente y falta de protección anti-fuerza bruta." },
      { q: "XXE con `<!ENTITY xxe SYSTEM \"file:///etc/passwd\">` puede exfiltrar:", o: ["Solo XML", "Archivos locales del server (file://), o hacer SSRF a metadata cloud (http://169.254.169.254)", "Solo cookies"], c: 1, e: "Deshabilitar external entities en el parser: defusedxml en Python, LIBXML_NOENT off en PHP." },
      { q: "El billion laughs XML bomb es un ataque de:", o: ["RCE", "DoS por expansión exponencial de entidades XML anidadas (10^9 entradas en KB de source)", "SSRF"], c: 1, e: "Fix: límites de expansión en el parser; muchos parsers modernos ya los tienen." },
      { q: "Log4Shell fue tan devastador porque:", o: ["Solo afectaba Windows", "El payload en CUALQUIER campo loggeado (User-Agent, chat, subject email) alcanzaba Log4j.info() → JNDI → RCE remoto", "Requería MFA"], c: 1, e: "Muchos vectores: Minecraft chat, Elasticsearch queries, form fields, User-Agent." },
      { q: "En un pipeline CI comprometido a lo SolarWinds, el fix ES A08 es:", o: ["Deshabilitar tests", "Verificar integridad de artefactos con firmas (cosign/Sigstore) + provenance (SLSA) + reproducible builds", "Usar HTTP"], c: 1, e: "El troyano SUNBURST fue inyectado en el proceso de build y firmado legítimamente." },
      { q: "Deserialización de un JWT (que es Base64, no serialización nativa) es segura porque:", o: ["No lo es", "El JWT solo contiene JSON parseado — no invoca constructores arbitrarios como Java ObjectInputStream / Python pickle. El riesgo es la validación de firma, no el parsing", "JWT usa AES"], c: 1, e: "Distinción clave: JWT parsing vs deserialización binaria." },
    ],
    a: [
      { q: "¿Qué ejemplo representa A08 Software and Data Integrity Failures?", o: ["Pipeline CI/CD que descarga dependencias sin verificar firma/integridad", "Una cookie sin HttpOnly", "Un puerto abierto innecesario"], c: 0, e: "A08 cubre actualizaciones/datos sin verificación de integridad, como deserialización insegura y supply chain." },
      { q: "Para mitigar SSRF en un entorno cloud (AWS), ¿qué control es clave?", o: ["Bloquear acceso al endpoint de metadata (169.254.169.254) e imponer IMDSv2", "Usar HTTP en lugar de HTTPS", "Desactivar el firewall"], c: 0, e: "Restringir el endpoint de metadata y exigir IMDSv2 (token-based) evita robo de credenciales vía SSRF." },
      { q: "La deserialización insegura puede llevar a RCE porque...", o: ["Expone el código fuente", "Solo causa denegación de servicio", "Permite instanciar objetos arbitrarios cuyos métodos (gadgets) ejecutan código"], c: 2, e: "Cadenas de gadgets en datos serializados maliciosos pueden encadenar llamadas hasta ejecución de código." },
      { q: "¿Qué medida de A09 mejora la detección sin generar falsos negativos?", o: ["Desactivar logs en producción por rendimiento", "Loggear eventos de seguridad con suficiente contexto y alertas en tiempo casi real", "Guardar logs solo en el cliente"], c: 1, e: "Logging server-side con contexto y alertas centralizadas permite detección y respuesta efectiva." },
      { q: "El **Phar deserialization** en PHP explota que:", o: ["PHP siempre es inseguro", "Los stream wrappers `phar://` invocan unserialize() implícitamente en funciones como file_exists(), md5_file() — vector oculto sin llamada explícita", "PHP no soporta clases"], c: 1, e: "Fix: filtro de stream wrappers permitidos + no procesar filenames del user." },
      { q: "En HPP, el WAF bypass más común aprovecha que:", o: ["El WAF es lento", "El WAF valida el primer parámetro (benign) mientras el backend Node.js/Rails toma el segundo (payload malicioso) — desalineación de framework", "El WAF requiere HTTPS"], c: 1, e: "Auditar mediante `parameterLimit: 1` y whitelist estricta." },
      { q: "GraphQL alias overloading permite:", o: ["Bypass de rate-limit por HTTP request enviando 1000 login attempts como aliases en una sola query", "Compresión", "MFA bypass automático"], c: 0, e: "`{ a1: login(...), a2: login(...), ..., a1000: login(...) }` — contramedida: query complexity limit, no HTTP rate-limit." },
      { q: "En A06 Vulnerable Components, el mayor blind-spot es:", o: ["Dependencies directas", "Dependencies transitivas (grandchildren en la cadena) — muchas apps no sabían que tenían Log4j vía otra lib", "El OS"], c: 1, e: "SBOM + SCA con análisis de dependencias transitivas es indispensable." },
      { q: "En A09, un canary token efectivo para Log4Shell es:", o: ["Nada especial", "Enviar `${jndi:ldap://canarytokens.com/uuid}` en User-Agent a tus propios servicios y alertar si el canary se dispara — detecta procesamiento vulnerable", "Aumentar timeouts"], c: 1, e: "canarytokens.org tiene generación gratuita." },
    ],
  },
  27: {
    i: [
      { q: "¿Qué diferencia un XSS almacenado (stored) de uno reflejado (reflected)?", o: ["El stored solo afecta al atacante", "El stored persiste en el servidor y afecta a múltiples víctimas; el reflected viaja en la petición", "El reflected es siempre más peligroso"], c: 1, e: "El XSS stored se guarda en la BD/servidor y se sirve a todos; el reflected requiere que la víctima envíe el payload." },
      { q: "En SQL injection, ¿qué payload clásico intenta bypass de login?", o: ["<script>alert(1)</script>", "../../etc/passwd", "' OR '1'='1"], c: 2, e: "' OR '1'='1 hace que la condición WHERE siempre sea verdadera, evadiendo la autenticación." },
      { q: "¿Qué caracteriza a un DOM-based XSS?", o: ["Siempre se almacena en base de datos", "El payload se ejecuta por manipulación insegura del DOM en el cliente, sin pasar por el servidor", "Solo funciona en HTTP"], c: 1, e: "En DOM XSS el sink inseguro (innerHTML, eval) procesa datos controlados por el atacante en el navegador." },
      { q: "¿Qué técnica usa el blind SQL injection para extraer datos?", o: ["Lectura directa del archivo de configuración", "Inferencia por respuestas booleanas o tiempos de respuesta", "Mensajes de error detallados"], c: 1, e: "El blind SQLi infiere datos bit a bit observando diferencias booleanas o retardos (time-based)." },
      { q: "En NoSQL injection contra MongoDB, `{ pass: { \"$ne\": \"\" } }` funciona porque:", o: ["MongoDB es inseguro", "El server pasa el input JSON directo al query sin type-check — matches cualquier password", "Bug en Node.js"], c: 1, e: "Fix trivial: `if (typeof pass !== 'string') reject`." },
      { q: "Un DOM XSS via postMessage sin validación de origin permite:", o: ["Solo debug", "Inyección cross-frame desde iframes maliciosos — atacante hace `victim.postMessage('<script>', '*')` y el handler `innerHTML = e.data`", "SQL"], c: 1, e: "Fix: siempre `if (e.origin !== 'https://trusted.com') return`." },
      { q: "Prototype pollution en Node.js puede escalar a RCE via:", o: ["Directo shell exec", "Contaminar propiedades usadas por libs (Express router, Handlebars options con eval, fastify plugins) → gadget chain a RCE", "SSH keys"], c: 1, e: "Fix: `Object.freeze(Object.prototype)` al bootstrap + schema validation JSON." },
      { q: "DOM Clobbering bypassa CSP `script-src 'none'` porque:", o: ["Rompe CSP", "El vector es HTML injection sin script — clobbering sobrescribe globals con elementos `<a id=X>` → app code usa el global contaminado", "Requiere JS"], c: 1, e: "DOMPurify con SANITIZE_DOM + FORBID_ATTR id/name es la defensa." },
      { q: "El WAF bypass con `UN/**/ION` funciona porque:", o: ["El WAF filtra por regex simple de 'UNION'", "El SQL parser del backend ignora comentarios `/**/` y ejecuta el UNION intacto", "Ambos"], c: 2, e: "WAF debe hacer normalization semántica, no solo regex de strings." },
    ],
    a: [
      { q: "En un time-based blind SQLi en MySQL, ¿qué función induce un retardo condicional?", o: ["LENGTH()", "BENCHMARK() o SLEEP() dentro de una condición", "CONCAT()"], c: 1, e: "SLEEP(5) o BENCHMARK() ejecutados condicionalmente permiten inferir datos por el tiempo de respuesta." },
      { q: "¿Por qué un WAF con blacklist de '<script>' no detiene un XSS robusto?", o: ["Porque el WAF cifra la entrada", "Porque el navegador ignora scripts", "Existen vectores alternativos como <img onerror>, eventos SVG o codificación"], c: 2, e: "Hay múltiples vectores (handlers de eventos, SVG, encoding) que evaden filtros basados en firmas simples." },
      { q: "¿Qué hace una técnica de SQLi out-of-band (OOB)?", o: ["Inyecta JavaScript", "Exfiltra datos por canales externos como DNS o HTTP cuando no hay salida directa", "Solo borra tablas"], c: 1, e: "El OOB SQLi usa funciones que generan peticiones DNS/HTTP al atacante para exfiltrar sin respuesta visible." },
      { q: "¿Cuál es la defensa más efectiva contra XSS además de output encoding?", o: ["Una Content Security Policy estricta con nonces y sin unsafe-inline", "Validar solo la longitud de entrada", "Desactivar JavaScript globalmente"], c: 0, e: "Una CSP estricta limita la ejecución de scripts inyectados aunque exista un fallo de encoding." },
      { q: "OOB SQLi con `UTL_HTTP.REQUEST` en Oracle exfiltra datos porque:", o: ["Cifra el resultado", "El server Oracle hace un HTTP GET al servidor del atacante con la data en el subdomain — un request DNS revela la password entera", "Es más rápido"], c: 1, e: "Fix: egress firewall en el DB — bloquear DNS+HTTP salientes desde accounts de app." },
      { q: "En Redis command injection via CRLF, el impact es:", o: ["Menor", "El atacante inyecta `\\r\\nCONFIG SET dir /var/spool/cron\\r\\nCONFIG SET dbfilename root\\r\\nSAVE` → escribe cronjob del root → RCE", "Solo DoS"], c: 1, e: "Fix: usar driver que escapa CRLF o Redis con AUTH obligatorio + rename-command deshabilitado." },
      { q: "Un client-side prototype pollution que llega a XSS usa como gadget:", o: ["Solo AngularJS", "Librerías que hacen `data.template || 'div'` — con `__proto__.template = '<img onerror=...>'` la propiedad undefined hereda", "SQL"], c: 1, e: "PortSwigger academy tiene labs específicos de client + server-side pollution." },
      { q: "En Trusted Types, la razón por la que rompe menos apps de lo esperado es:", o: ["Nadie las usa", "Se pueden migrar gradualmente con `report-only` + policy que sanitiza — código legacy sigue funcionando mientras se migra", "Solo Chrome soporta"], c: 1, e: "Google migró Gmail (millones de LOC) en fases con reports antes del enforce." },
      { q: "Server-side pollution que llega a RCE en Node.js típicamente pasa por:", o: ["Directo shell", "Contamiar `env` de un `child_process.spawn` o `options` de un template render con `Handlebars.compile` con eval — gadget chain", "TLS"], c: 1, e: "Fastify/Express específicos han tenido gadgets documentados; hardening: --disable-proto=throw." },
    ],
  },
  28: {
    i: [
      { q: "¿Qué token mitiga CSRF al validar que la petición proviene de un formulario legítimo?", o: ["Anti-CSRF token sincronizado (synchronizer token)", "Cookie HttpOnly", "JWT de sesión"], c: 0, e: "El synchronizer token es un valor impredecible incluido en el formulario y validado en el servidor por petición." },
      { q: "Un atacante hace que el servidor solicite http://localhost/admin. ¿Qué ataque es?", o: ["CSRF", "XSS reflejado", "SSRF"], c: 2, e: "SSRF abusa de que el servidor realice peticiones a recursos internos elegidos por el atacante." },
      { q: "En una vulnerabilidad de file upload, ¿qué validación es insuficiente por sí sola?", o: ["Verificar el magic number del archivo", "Almacenar fuera del webroot", "Confiar solo en la extensión del nombre de archivo"], c: 2, e: "Validar solo la extensión es trivial de evadir; deben verificarse tipo real, contenido y ubicación." },
      { q: "¿Qué atributo de cookie es la principal defensa moderna contra CSRF?", o: ["SameSite", "Domain", "Secure"], c: 0, e: "SameSite (Lax/Strict) impide o limita el envío de cookies en peticiones cross-site, base del CSRF." },
      { q: "HTTP Request Smuggling CL.TE aprovecha que:", o: ["El TLS falla", "Front-end usa Content-Length y back-end usa Transfer-Encoding: chunked para determinar el fin del request → smuggling de bytes al próximo request", "El servidor está sobrecargado"], c: 1, e: "James Kettle 2019, Black Hat: PayPal, Slack, decenas de $10K-100K bounties." },
      { q: "Web Cache Deception (PayPal 2017) explota que:", o: ["El HTTPS es débil", "Las CDNs cachean por extensión — `victim.com/profile/attacker.css` sirve profile del user pero se cachea como CSS, atacante después lee cache", "El WAF falla"], c: 1, e: "Fix: `Cache-Control: private, no-store` en responses autenticadas + normalizar path antes de cachear." },
      { q: "En SSRF, el DNS rebinding es una técnica TOCTOU porque:", o: ["Cifra la URL", "Entre la validación de hostname (DNS lookup 1) y la conexión HTTP (DNS lookup 2), el atacante devuelve IPs distintas — la segunda es 169.254.169.254", "Bloquea"], c: 1, e: "Fix: resolver DNS una vez y usar la IP resuelta para la conexión; validar la IP tras cada resolución." },
      { q: "Un ImageTragick payload en SVG explota:", o: ["Solo el browser", "Los delegates de ImageMagick que ejecutan shell commands (`https://example.com/x.jpg|touch /tmp/pwn`) — RCE en cualquier app que procese avatars con IM", "TLS"], c: 1, e: "CVE-2016-3714. Fix: policy.xml estricta en IM 7.x o migrar a libvips/Sharp." },
      { q: "En OAuth 2.1, la eliminación de `implicit flow` responde a:", o: ["Compatibilidad", "El access_token en fragment URL filtra vía Referer, extensiones, service workers — inaceptable para clients públicos post-PKCE", "Latencia"], c: 1, e: "PKCE con authorization_code es el reemplazo estándar para SPAs y mobile." },
    ],
    a: [
      { q: "¿Cómo puede un atacante usar SSRF para alcanzar metadata de la nube?", o: ["Subiendo un archivo PHP", "Forzando una petición a 169.254.169.254 para robar credenciales IAM temporales", "Inyectando SQL"], c: 1, e: "El endpoint de metadata expone credenciales temporales; SSRF sin protección IMDSv2 las exfiltra." },
      { q: "¿Por qué un upload de imagen puede derivar en RCE en un servidor PHP mal configurado?", o: ["Un archivo .php.jpg o con polyglot puede ejecutarse si el handler procesa por extensión parcial", "PHP descomprime imágenes automáticamente", "Las imágenes ejecutan binarios"], c: 0, e: "Configuraciones laxas (Apache AddHandler, doble extensión, polyglots) permiten ejecutar el archivo subido." },
      { q: "Una defensa débil contra CSRF es validar el header Referer porque...", o: ["El Referer es inmutable", "Puede estar ausente o ser suprimido, generando bypass o bloqueo de usuarios legítimos", "El Referer siempre está presente"], c: 1, e: "El Referer puede faltar por políticas de privacidad, haciendo la validación poco fiable como única defensa." },
      { q: "¿Qué técnica permite SSRF evadir filtros de IP basados en blacklist?", o: ["Cifrar la URL", "Usar HTTPS", "Usar representaciones alternativas de IP (decimal, octal, IPv6, o redirecciones DNS)"], c: 2, e: "Codificaciones de IP, DNS rebinding y redirecciones evaden listas negras simples de direcciones." },
      { q: "HTTP/2 downgrade smuggling (H2.CL / H2.TE, Kettle 2021) explota que:", o: ["HTTP/2 es inseguro", "El front habla HTTP/2 con el client pero downgrade a HTTP/1.1 al back — la conversión genera CL/TE headers inconsistentes que abren smuggling", "El TLS falla"], c: 1, e: "Fix: HTTP/2 end-to-end sin downgrade, o normalización estricta en el edge." },
      { q: "En cache poisoning con unkeyed input, Param Miner (Burp) automatiza:", o: ["Solo rate-limit tests", "Descubrimiento de parámetros/headers no incluidos en cache key que la app procesa — envía payloads y observa reflejo en response", "SSL testing"], c: 1, e: "Descubrimiento clave para pentests modernos de cache poisoning." },
      { q: "El bypass de allowlist SSRF con `http://foo@evil.com:80@victim.com/` explota:", o: ["Nada", "Discrepancias en parsers URL — algunos toman host=victim.com, otros host=evil.com. Investigación seminal de Orange Tsai", "TLS"], c: 1, e: "Fix: usar biblioteca canónica de parsing + verificar IP tras resolución." },
      { q: "Un polyglot JPEG+PHP con código en EXIF permite RCE porque:", o: ["No permite RCE", "Los magic bytes son JPEG válidos (pasa file-type check), pero cuando el server ejecuta como PHP el interpreter salta al bloque EXIF con `<?php system(...) ?>`", "Cifra"], c: 1, e: "Fix definitivo: reprocess con Sharp/Pillow — output garantizado no polyglot." },
      { q: "En ZIP slip (CVE-2018-8825 et al.), el fix duradero es:", o: ["No usar ZIP", "Validar que cada `entry.path` resuelto (resolvedPath) esté DENTRO del `targetDir` — rechazar entries que escapen con `../`", "Cifrar el ZIP"], c: 1, e: "Bibliotecas viejas de unzip lo permitían silenciosamente. Auditar dependencias." },
    ],
  },
  29: {
    i: [
      { q: "¿Qué describe el reconocimiento pasivo?", o: ["Recolectar información sin interactuar directamente con el objetivo", "Escanear puertos directamente con Nmap", "Explotar una vulnerabilidad"], c: 0, e: "El recon pasivo usa fuentes públicas (OSINT) sin tocar la infraestructura del objetivo, evitando detección." },
      { q: "¿Qué herramienta consulta registros DNS y transferencias de zona?", o: ["dig / dnsrecon", "nikto", "hydra"], c: 0, e: "dig y dnsrecon permiten enumerar registros DNS y probar transferencias de zona (AXFR)." },
      { q: "¿Para qué se usa el dorking de Google en OSINT?", o: ["Para encontrar información expuesta usando operadores avanzados de búsqueda", "Para crackear contraseñas", "Para escanear puertos"], c: 0, e: "Google dorks (site:, filetype:, inurl:) localizan documentos, paneles y datos expuestos indexados." },
      { q: "¿Qué información provee una consulta WHOIS?", o: ["El código fuente del sitio", "Las contraseñas del dominio", "Datos de registro del dominio: registrante, fechas, servidores DNS"], c: 2, e: "WHOIS revela datos administrativos del dominio útiles para mapear infraestructura y contactos." },
    ],
    a: [
      { q: "¿Qué técnica de OSINT permite descubrir subdominios sin tocar el objetivo?", o: ["Ejecutar un escaneo SYN", "Consultar logs de Certificate Transparency (crt.sh)", "Fuerza bruta de login"], c: 1, e: "Los logs de Certificate Transparency exponen subdominios para los que se emitieron certificados TLS." },
      { q: "¿Por qué Shodan es valioso en reconocimiento?", o: ["Genera payloads", "Crackea hashes", "Indexa servicios y dispositivos expuestos en Internet con sus banners y versiones"], c: 2, e: "Shodan rastrea y cataloga servicios expuestos, revelando banners, versiones y posibles vulnerabilidades." },
      { q: "¿Qué riesgo OPSEC introduce el recon activo frente al pasivo?", o: ["El activo genera tráfico hacia el objetivo, detectable por IDS/logs", "El activo es siempre ilegal", "Ninguno, son equivalentes"], c: 0, e: "El recon activo interactúa con el objetivo y deja huellas detectables, a diferencia del puramente pasivo." },
      { q: "En enumeración de empleados para spear phishing, ¿qué fuente combina OSINT y formatos de correo?", o: ["LinkedIn + inferencia del patrón de email corporativo (nombre.apellido@)", "El archivo robots.txt", "Un escaneo de Nmap"], c: 0, e: "Perfiles profesionales más el patrón de email permiten construir listas de objetivos plausibles." },
    ],
  },
  30: {
    i: [
      { q: "¿Qué hace la flag -sS en Nmap?", o: ["Escaneo SYN sigiloso (half-open)", "Detección de versión", "Escaneo UDP"], c: 0, e: "El SYN scan (-sS) no completa el handshake TCP, siendo más rápido y discreto." },
      { q: "¿Qué flag de Nmap intenta detectar la versión de los servicios?", o: ["-O", "-sV", "-Pn"], c: 1, e: "-sV envía sondas para identificar el servicio y su versión a partir de los banners y respuestas." },
      { q: "¿Qué realiza -Pn en Nmap?", o: ["Desactiva el descubrimiento de hosts (asume que están activos)", "Escanea solo el puerto 80", "Activa scripts NSE"], c: 0, e: "-Pn omite el ping de descubrimiento, útil cuando los hosts bloquean ICMP." },
      { q: "¿Qué plantilla de timing es más agresiva y rápida?", o: ["-T5 (insane)", "-T2 (polite)", "-T0 (paranoid)"], c: 0, e: "-T5 es la más agresiva en velocidad, a costa de mayor ruido y posible pérdida de precisión." },
    ],
    a: [
      { q: "¿Qué ventaja ofrece un escaneo UDP (-sU) y por qué es lento?", o: ["Detecta servicios UDP como DNS/SNMP; es lento por la falta de respuesta y el rate limiting ICMP", "Es más rápido que TCP", "No genera tráfico"], c: 0, e: "UDP no confirma estado fácilmente; los puertos cerrados envían ICMP port-unreachable con rate-limit, ralentizando el scan." },
      { q: "¿Qué hace la categoría de scripts NSE 'vuln'?", o: ["Solo hace ping", "Borra logs", "Comprueba vulnerabilidades conocidas en los servicios detectados"], c: 2, e: "Los scripts NSE de categoría vuln prueban CVEs y debilidades específicas contra los servicios identificados." },
      { q: "Para evadir un firewall/IDS, ¿qué técnica de Nmap fragmenta los paquetes?", o: ["-sV", "-A", "-f o --mtu"], c: 2, e: "-f fragmenta los paquetes para dificultar el reensamblado e inspección por algunos IDS/firewalls." },
      { q: "¿Qué hace un idle scan (-sI) y cuál es su ventaja?", o: ["Usa un host zombie para escanear de forma indirecta, ocultando la IP real del atacante", "Acelera el escaneo TCP", "Detecta el sistema operativo"], c: 0, e: "El idle scan abusa de los IP IDs predecibles de un zombie para escanear sin revelar la IP origen." },
    ],
  },
  31: {
    i: [
      { q: "¿Qué herramienta enumera shares y usuarios SMB?", o: ["enum4linux / smbclient", "sqlmap", "john"], c: 0, e: "enum4linux y smbclient permiten listar recursos compartidos, usuarios y políticas vía SMB/NetBIOS." },
      { q: "¿Qué community string por defecto suele permitir lectura en SNMP?", o: ["public", "root", "admin"], c: 0, e: "La community string 'public' (read-only) por defecto suele exponer gran cantidad de información del dispositivo." },
      { q: "¿Qué protocolo y puerto usa LDAP sin cifrar?", o: ["TCP 389", "UDP 53", "TCP 22"], c: 0, e: "LDAP escucha en TCP 389 (sin cifrar); LDAPS usa 636 con TLS." },
      { q: "¿Qué tipo de consulta DNS puede revelar todos los registros de una zona si está mal configurada?", o: ["Consulta A", "Transferencia de zona (AXFR)", "Consulta PTR"], c: 1, e: "Una transferencia de zona AXFR mal restringida vuelca todos los registros del dominio a un atacante." },
    ],
    a: [
      { q: "Vía SNMP con community RW, ¿qué acción avanzada es posible en algunos dispositivos?", o: ["Modificar la configuración o exfiltrar tablas como la de procesos/rutas", "Cifrar el tráfico", "Solo leer el uptime"], c: 0, e: "Con write-access (private) o lectura amplia se puede alterar config o volcar tablas MIB sensibles." },
      { q: "¿Por qué el SMB null session es un hallazgo crítico de enumeración?", o: ["Es solo informativo", "Permite autenticarse sin credenciales y listar usuarios/shares/políticas", "Cifra el canal"], c: 1, e: "Una null session (usuario/clave vacíos) puede revelar usuarios, grupos y políticas sin autenticación válida." },
      { q: "En enumeración LDAP de Active Directory, ¿qué dato sensible se puede extraer con un bind anónimo o de usuario?", o: ["Esquema, usuarios, grupos y atributos como descripciones con secretos", "El firmware del DC", "Las contraseñas en texto plano"], c: 0, e: "El árbol LDAP expone usuarios, grupos y atributos; a veces hay credenciales en campos description." },
      { q: "¿Qué técnica DNS permite descubrir hosts internos cuando AXFR está bloqueado?", o: ["Cambiar el TTL", "Reiniciar el servidor DNS", "Fuerza bruta de subdominios / DNS brute con wordlists"], c: 2, e: "Si la transferencia de zona falla, la fuerza bruta de nombres con diccionarios descubre hosts existentes." },
    ],
  },
  32: {
    i: [
      { q: "¿Qué representa el identificador CVE?", o: ["Un tipo de exploit", "Una puntuación de gravedad", "Un identificador único de una vulnerabilidad pública conocida"], c: 2, e: "CVE (Common Vulnerabilities and Exposures) asigna un ID único a cada vulnerabilidad divulgada." },
      { q: "¿Qué rango de CVSS v3.1 corresponde a severidad crítica?", o: ["9.0 - 10.0", "0.1 - 3.9", "4.0 - 6.9"], c: 0, e: "En CVSS v3.1, 9.0-10.0 es Crítica; 7.0-8.9 Alta; 4.0-6.9 Media; 0.1-3.9 Baja." },
      { q: "¿Qué tipo de scanner verifica vulnerabilidades sin autenticación contra servicios de red?", o: ["Decompilador", "Fuzzer de protocolo", "Scanner no autenticado (unauthenticated/remote)"], c: 2, e: "El scan no autenticado prueba el objetivo como un atacante externo, sin credenciales del sistema." },
      { q: "¿Qué herramienta es un scanner de vulnerabilidades ampliamente usado?", o: ["Wireshark", "Burp Repeater", "Nessus / OpenVAS"], c: 2, e: "Nessus y OpenVAS automatizan la detección de vulnerabilidades conocidas en redes y hosts." },
    ],
    a: [
      { q: "¿Qué métrica del Base Score CVSS refleja si se requiere interacción del usuario?", o: ["Attack Vector (AV)", "User Interaction (UI)", "Scope (S)"], c: 1, e: "User Interaction (UI: None/Required) indica si la explotación necesita acción de un usuario." },
      { q: "¿Qué aporta un escaneo autenticado frente a uno no autenticado?", o: ["Solo escanea puertos", "Menos cobertura", "Detecta parches faltantes y configuraciones internas con mayor precisión y menos falsos positivos"], c: 2, e: "Con credenciales el scanner inspecciona versiones de paquetes y config local, reduciendo falsos positivos." },
      { q: "La métrica Scope (S) en CVSS cambia a 'Changed' cuando...", o: ["El score es mayor a 9", "Se requiere autenticación", "La vulnerabilidad afecta recursos más allá del componente vulnerable"], c: 2, e: "Scope:Changed indica que el impacto trasciende el componente afectado (ej. escape de sandbox/VM)." },
      { q: "¿Por qué priorizar solo por CVSS Base Score puede ser insuficiente?", o: ["Porque el Base Score es siempre incorrecto", "Porque CVSS no aplica a software", "No considera explotabilidad real (EPSS), exposición ni contexto del activo"], c: 2, e: "La priorización efectiva combina CVSS con EPSS, exposición, criticidad del activo y existencia de exploits." },
    ],
  },
  33: {
    i: [
      { q: "¿Qué comando de msfconsole busca módulos por palabra clave?", o: ["search", "exploit", "use"], c: 0, e: "search filtra módulos por nombre, CVE, plataforma o tipo dentro de Metasploit." },
      { q: "¿Qué comando selecciona un módulo para usarlo?", o: ["set", "run", "use"], c: 2, e: "use <ruta_del_modulo> carga el módulo y habilita sus opciones." },
      { q: "¿Qué es un payload de tipo meterpreter?", o: ["Un payload avanzado en memoria con sesión interactiva y muchas capacidades post-explotación", "Un fuzzer", "Un escáner de puertos"], c: 0, e: "Meterpreter es un payload residente en memoria que ofrece migración, captura, pivoting y más." },
      { q: "¿Qué diferencia un payload staged de uno stageless?", o: ["El stageless es más pequeño", "El staged descarga el resto del payload en etapas; el stageless lo incluye todo de una vez", "No hay diferencia"], c: 1, e: "El staged (ej. reverse_tcp con /) envía un stager pequeño que descarga la etapa final; el stageless es autónomo." },
    ],
    a: [
      { q: "¿Qué comando de meterpreter mueve la sesión a otro proceso para evadir detección o ganar estabilidad?", o: ["download", "migrate", "sysinfo"], c: 1, e: "migrate <pid> traslada el payload a otro proceso, útil para persistencia y evasión." },
      { q: "Para pivoting hacia una red interna desde una sesión meterpreter, ¿qué se usa?", o: ["El comando 'route' + módulo socks proxy para enrutar tráfico por la sesión", "Un escaneo SYN local", "Solo cambiar el LHOST"], c: 0, e: "autoroute/route añade rutas a la sesión y un socks_proxy permite que herramientas externas pivoteen." },
      { q: "¿Por qué un payload encoder por sí solo no garantiza evadir AV moderno?", o: ["Los encoders solo ofuscan; los AV con análisis heurístico/comportamiento detectan la ejecución igual", "Los encoders cifran el disco", "Porque ralentizan el exploit"], c: 0, e: "Los encoders evaden firmas estáticas simples, pero no el análisis dinámico/heurístico actual." },
      { q: "¿Qué ventaja de OPSEC ofrece generar el payload con msfvenom de forma stageless y en formato shellcode personalizado?", o: ["Reduce las conexiones de red del stager y permite mayor control/ofuscación previo a la ejecución", "Hace el payload indetectable siempre", "Elimina la necesidad de un handler"], c: 0, e: "Un payload stageless evita el tráfico de staging y permite integrarlo en loaders personalizados." },
    ],
  },
  34: {
    i: [
      { q: "¿Para qué sirve el módulo Proxy de Burp Suite?", o: ["Interceptar y modificar el tráfico HTTP/S entre el navegador y el servidor", "Crackear contraseñas", "Escanear puertos"], c: 0, e: "El Proxy actúa como man-in-the-middle para interceptar, ver y editar peticiones/respuestas." },
      { q: "¿Qué herramienta de Burp reenvía una sola petición permitiendo editarla manualmente?", o: ["Repeater", "Intruder", "Decoder"], c: 0, e: "Repeater permite modificar y reenviar una petición individual de forma iterativa para probar respuestas." },
      { q: "¿Qué herramienta de Burp automatiza ataques con listas de payloads (fuerza bruta/fuzzing)?", o: ["Comparer", "Intruder", "Sequencer"], c: 1, e: "Intruder inserta payloads en posiciones marcadas para fuzzing, fuerza bruta o enumeración." },
      { q: "Para interceptar HTTPS con Burp, ¿qué se debe instalar en el navegador?", o: ["El certificado CA de Burp", "Una VPN", "Un plugin de Java"], c: 0, e: "Instalar el certificado de la CA de Burp evita errores TLS al interceptar tráfico HTTPS." },
    ],
    a: [
      { q: "¿Qué tipo de ataque Intruder usa dos listas de payloads en dos posiciones simultáneas?", o: ["Sniper", "Cluster bomb", "Battering ram"], c: 1, e: "Cluster bomb prueba todas las combinaciones de varias listas en distintas posiciones (ej. user+pass)." },
      { q: "¿Cómo ayuda Burp Sequencer en una evaluación?", o: ["Genera certificados", "Analiza la aleatoriedad/entropía de tokens de sesión para detectar predictibilidad", "Cifra los tokens"], c: 1, e: "Sequencer evalúa la calidad de aleatoriedad de tokens, revelando debilidades de generación de sesión." },
      { q: "Para automatizar un ataque que requiere un token CSRF cambiante por petición, ¿qué función de Burp se usa?", o: ["Decoder", "Comparer", "Macros + extracción de parámetros en grep/recursive grep"], c: 2, e: "Las macros precapturan el token dinámico y lo reinsertan, permitiendo automatizar contra protecciones CSRF." },
      { q: "El modo Battering ram de Intruder se caracteriza por...", o: ["Combinar dos listas", "Usar un único punto de inserción", "Insertar el mismo payload en todas las posiciones a la vez"], c: 2, e: "Battering ram coloca el mismo valor en todas las posiciones marcadas simultáneamente." },
    ],
  },
  35: {
    i: [
      { q: "¿Cómo se buscan binarios con bit SUID en Linux?", o: ["cat /etc/shadow", "find / -perm -4000 -type f 2>/dev/null", "ls -la /etc/passwd"], c: 1, e: "El bit SUID (4000) hace que el binario corra con privilegios del propietario; find lo localiza." },
      { q: "¿Qué recurso documenta cómo abusar de binarios para escalar privilegios?", o: ["GTFOBins", "MITRE ATT&CK", "CVE Details"], c: 0, e: "GTFOBins cataloga binarios Unix y cómo abusarlos (SUID, sudo, capabilities) para escalar o salir de restricciones." },
      { q: "Si un cron job ejecutado por root corre un script editable por tu usuario, ¿qué puedes hacer?", o: ["Inyectar comandos en el script para que se ejecuten como root", "Nada, los cron son seguros", "Solo leer el archivo"], c: 0, e: "Un script de cron con permisos de escritura por un usuario sin privilegios permite ejecutar código como root." },
      { q: "¿Qué comando lista las capabilities de los archivos?", o: ["getcap -r / 2>/dev/null", "chmod +x", "id"], c: 0, e: "getcap enumera capabilities (ej. cap_setuid) que pueden permitir escalada sin SUID completo." },
    ],
    a: [
      { q: "Un binario con cap_setuid+ep permite escalar porque...", o: ["Cifra el sistema", "Solo permite leer archivos", "Otorga capacidad de cambiar el UID a 0 sin ser SUID root"], c: 2, e: "cap_setuid permite al proceso establecer UID 0, equivalente a root para ese binario." },
      { q: "Si sudo -l muestra que puedes ejecutar /usr/bin/vim como root, ¿cómo escalas?", o: ["Desde vim ejecutas :!/bin/sh para obtener una shell root", "No es posible", "Editas /etc/hosts"], c: 0, e: "vim (y otros editores) permiten lanzar shells; si se ejecuta como root vía sudo, la shell hereda root (GTFOBins)." },
      { q: "¿Qué riesgo introduce un PATH escribible o relativo en un script SUID que llama a un comando sin ruta absoluta?", o: ["Ninguno", "Permite hijacking colocando un binario malicioso antes en el PATH", "Solo afecta el rendimiento"], c: 1, e: "Si el script llama 'cat' sin ruta y controlas el PATH, colocas tu propio 'cat' que se ejecuta con privilegios." },
      { q: "¿Por qué LD_PRELOAD puede usarse para escalada con sudo en ciertas configuraciones?", o: ["LD_PRELOAD cifra binarios", "Si env_keep incluye LD_PRELOAD, se carga una librería maliciosa al ejecutar un comando como root", "Solo afecta a 32 bits"], c: 1, e: "Con env_keep+=LD_PRELOAD habilitado, una .so maliciosa precargada ejecuta código como root vía sudo." },
    ],
  },
  36: {
    i: [
      { q: "¿Qué herramienta automatiza la enumeración de escalada en Windows?", o: ["Nmap", "Wireshark", "WinPEAS / PowerUp"], c: 2, e: "WinPEAS y PowerUp enumeran servicios mal configurados, permisos y rutas de escalada en Windows." },
      { q: "¿Qué vulnerabilidad de servicio Windows permite reemplazar el binario que se ejecuta como SYSTEM?", o: ["Unquoted service path o permisos débiles sobre el binario/servicio", "Una cookie sin Secure", "Un puerto cerrado"], c: 0, e: "Rutas de servicio sin comillas o permisos de escritura permiten suplantar el ejecutable que corre como SYSTEM." },
      { q: "¿Qué es un ataque de tipo 'potato' (JuicyPotato/RoguePotato)?", o: ["Un ataque DNS", "Un escaneo de red", "Abusa de privilegios de impersonación de tokens para escalar a SYSTEM"], c: 2, e: "Los exploits potato abusan de SeImpersonatePrivilege para suplantar un token de SYSTEM." },
      { q: "¿Qué comando muestra los privilegios del token actual en Windows?", o: ["ipconfig", "netstat -an", "whoami /priv"], c: 2, e: "whoami /priv lista los privilegios del token, clave para identificar SeImpersonate/SeBackup, etc." },
    ],
    a: [
      { q: "¿Por qué SeImpersonatePrivilege es tan valioso para un atacante?", o: ["Permite suplantar tokens de otros procesos, incluyendo SYSTEM, vía técnicas potato", "Permite cambiar la hora del sistema", "Solo permite leer logs"], c: 0, e: "Con SeImpersonate se puede capturar y suplantar un token de SYSTEM, base de los exploits potato." },
      { q: "¿Qué describe un bypass de UAC mediante secuestro del registro (fodhelper)?", o: ["Cifra el disco", "Abusa de un binario auto-elevado que lee una clave de registro escribible por el usuario", "Desactiva el antivirus"], c: 1, e: "fodhelper se auto-eleva y ejecuta el comando de una clave HKCU manipulable, evadiendo el prompt de UAC." },
      { q: "Para extraer hashes/credenciales en memoria con privilegios de admin, ¿qué herramienta se usa?", o: ["Mimikatz (sekurlsa::logonpasswords)", "Burp Repeater", "sqlmap"], c: 0, e: "Mimikatz vuelca credenciales de LSASS (sekurlsa) para pass-the-hash o movimiento lateral." },
      { q: "¿Por qué un servicio con permiso SERVICE_CHANGE_CONFIG para un usuario es crítico?", o: ["Permite cambiar binPath del servicio para ejecutar un comando como la cuenta del servicio (a menudo SYSTEM)", "No tiene impacto", "Solo permite reiniciar el equipo"], c: 0, e: "Modificar binPath con sc config y reiniciar el servicio ejecuta código arbitrario con la cuenta del servicio." },
    ],
  },
  37: {
    i: [
      { q: "En proxychains, que cadena de proxies fuerza el uso de TODOS los proxies de la lista en orden estricto?", o: ["strict_chain", "random_chain", "dynamic_chain"], c: 0, e: "strict_chain obliga a pasar por todos los proxies en el orden definido; si uno falla, la cadena falla." },
      { q: "Que comando SSH crea un proxy SOCKS dinamico en el puerto local 1080 a traves de un host comprometido?", o: ["ssh -L 1080:localhost:80 user@host", "ssh -D 1080 user@host", "ssh -R 1080:localhost:22 user@host"], c: 1, e: "ssh -D habilita port forwarding dinamico, creando un proxy SOCKS que enruta trafico a traves del host." },
      { q: "Que tecnica permite autenticarse usando el hash NTLM sin conocer la contrasena en texto plano?", o: ["Kerberoasting", "Pass-the-Hash", "DNS tunneling"], c: 1, e: "Pass-the-Hash reutiliza el hash NTLM directamente en el protocolo de autenticacion sin necesitar la contrasena." },
      { q: "Que tipo de port forwarding expone un servicio interno del atacante hacia la red de la victima a traves del host pivote?", o: ["Dynamic forwarding", "Remote forwarding", "Local forwarding"], c: 1, e: "El remote forwarding (ssh -R) reenvia un puerto remoto del host pivote hacia el lado del atacante." },
    ],
    a: [
      { q: "Por que pass-the-hash funciona contra NTLM pero requiere overpass-the-hash o pass-the-ticket para Kerberos?", o: ["NTLM cifra el hash con la clave del DC", "NTLM usa el hash como prueba directa de identidad mientras Kerberos usa tickets firmados", "Kerberos transmite la contrasena en claro"], c: 1, e: "En NTLM el hash ES el secreto del challenge-response; Kerberos emite TGT/TGS, por eso se requiere derivar o robar tickets." },
      { q: "Al hacer pivoting con proxychains sobre un SOCKS, por que fallan los escaneos SYN de nmap y se debe usar -sT?", o: ["nmap deshabilita SOCKS por defecto", "SOCKS no soporta UDP raw", "proxychains intercepta llamadas connect() de TCP pero no paquetes raw del SYN scan"], c: 2, e: "proxychains hookea libc connect(); el SYN scan usa raw sockets que no pasan por esa funcion, por eso se requiere connect scan (-sT)." },
      { q: "Que ventaja ofrece el pivoting con SOCKS sobre el port forwarding estatico por puerto en una intrusion compleja?", o: ["Cifra el trafico extremo a extremo automaticamente", "Evade IDS por completo", "Permite acceso dinamico a cualquier host y puerto de la red interna sin abrir tuneles individuales"], c: 2, e: "Un proxy SOCKS dinamico enruta a cualquier destino sin crear un tunel por cada servicio, ideal para movimiento lateral amplio." },
      { q: "Que mitigacion reduce mas eficazmente el riesgo de pass-the-hash de cuentas privilegiadas en un dominio?", o: ["Deshabilitar SMBv1", "Forzar contrasenas largas", "Credential Guard, tiering administrativo y restriccion de logon interactivo de cuentas privilegiadas"], c: 2, e: "Credential Guard aisla secretos LSA y el tiering impide exponer hashes de admins en hosts de menor confianza." },
    ],
  },
  38: {
    i: [
      { q: "Que principio de influencia se explota cuando un atacante se hace pasar por soporte tecnico de TI?", o: ["Autoridad", "Reciprocidad", "Escasez"], c: 0, e: "El principio de autoridad explota la tendencia a obedecer a figuras percibidas como expertas o con poder." },
      { q: "Que tecnica de ingenieria social consiste en seguir fisicamente a un empleado autorizado para entrar a una zona restringida?", o: ["Tailgating", "Baiting", "Vishing"], c: 0, e: "El tailgating (o piggybacking) aprovecha la cortesia para colarse tras alguien con acceso legitimo." },
      { q: "Que tecnica deja un dispositivo USB infectado en un lugar visible esperando que la victima lo conecte?", o: ["Baiting", "Pretexting", "Quid pro quo"], c: 0, e: "El baiting usa un cebo fisico o digital (USB, descarga) atractivo para que la victima lo active." },
      { q: "Cual es la defensa MAS efectiva contra la ingenieria social a nivel organizacional?", o: ["Antivirus actualizado", "Concienciacion y entrenamiento continuo del personal", "Firewall perimetral"], c: 1, e: "La ingenieria social ataca al humano; la formacion y simulacros son la barrera principal." },
    ],
    a: [
      { q: "Que diferencia el quid pro quo del baiting como vectores de ingenieria social?", o: ["El baiting solo es telefonico", "El quid pro quo ofrece un servicio o beneficio a cambio de informacion o acceso, el baiting usa un cebo pasivo", "Son sinonimos exactos"], c: 1, e: "Quid pro quo intercambia (algo por algo, ej. soporte falso a cambio de credenciales); baiting deja un cebo que la victima toma." },
      { q: "Por que el principio de escasez/urgencia es tan efectivo en ataques sofisticados dirigidos a ejecutivos?", o: ["Mejora la reputacion del atacante", "Reduce el tiempo de pensamiento critico y activa decisiones impulsivas bajo presion", "Cifra la comunicacion"], c: 1, e: "La urgencia limita el analisis racional, induciendo respuestas rapidas antes de verificar la legitimidad." },
      { q: "Que tecnica de OSINT precede tipicamente a un ataque de ingenieria social dirigido de alto nivel?", o: ["Perfilado de empleados via LinkedIn, redes sociales y filtraciones para construir un pretexto creible", "Fuzzing de la aplicacion web", "Port scanning agresivo"], c: 0, e: "El reconocimiento OSINT permite personalizar el pretexto con datos reales que aumentan la credibilidad." },
      { q: "Como mitiga el principio de verificacion fuera de banda (out-of-band) los ataques de suplantacion?", o: ["Confirma la solicitud por un canal independiente y previamente conocido antes de actuar", "Bloquea adjuntos ejecutables", "Cifra el correo entrante"], c: 0, e: "Verificar por un canal distinto y de confianza rompe la cadena de engano de un solo canal comprometido." },
    ],
  },
  39: {
    i: [
      { q: "Que caracteriza al spear phishing frente al phishing masivo?", o: ["Solo usa SMS", "Se envia a millones sin personalizar", "Esta altamente dirigido y personalizado a un individuo u organizacion especifica"], c: 2, e: "El spear phishing personaliza el mensaje con datos del objetivo para maximizar la credibilidad." },
      { q: "Que es un ataque BEC (Business Email Compromise)?", o: ["Cifrado de correos corporativos", "Un backup de Exchange", "Fraude que suplanta a un ejecutivo o proveedor para autorizar transferencias o desviar pagos"], c: 2, e: "BEC suplanta identidades de confianza (CEO, CFO, proveedor) para inducir pagos fraudulentos." },
      { q: "Que es el pretexting en un escenario de phishing?", o: ["Cifrar el payload", "Escanear puertos", "Construir un escenario o historia falsa creible para justificar la solicitud"], c: 2, e: "El pretexting fabrica un contexto verosimil (ej. auditoria, soporte) que da pie a la peticion maliciosa." },
      { q: "Que registro DNS ayuda a detectar correos falsificados verificando que el servidor emisor este autorizado?", o: ["CNAME", "SPF", "MX"], c: 1, e: "SPF lista los servidores autorizados a enviar correo por un dominio, ayudando a detectar spoofing." },
    ],
    a: [
      { q: "Como evade un atacante avanzado los filtros que detectan URLs maliciosas en correos de phishing?", o: ["Usando solo texto plano", "Empleando redireccionadores legitimos, dominios homoglifos, QR codes o entrega del payload tras la entrega (delayed weaponization)", "Aumentando el tamano del adjunto"], c: 1, e: "Tecnicas como homoglifos, abuso de redirectores confiables, QR phishing y weaponization diferida evaden el escaneo en el momento de entrega." },
      { q: "Que rol cumplen DKIM y DMARC junto a SPF para frenar el spoofing de dominio en BEC?", o: ["Solo comprimen los adjuntos", "DKIM firma criptograficamente el mensaje y DMARC define la politica y alinea SPF/DKIM con el dominio From", "Cifran el cuerpo del correo"], c: 1, e: "DKIM aporta integridad/autenticidad por firma; DMARC alinea identificadores y dicta accion (reject/quarantine)." },
      { q: "Por que el lookalike domain (typosquatting) es mas peligroso en BEC que el spoofing directo del dominio?", o: ["Pasa SPF/DKIM/DMARC porque es un dominio real controlado por el atacante, no una falsificacion del legitimo", "Es mas barato", "No requiere correo"], c: 0, e: "Un dominio parecido pero propio del atacante autentica correctamente, evadiendo controles que solo validan el dominio legitimo." },
      { q: "Que tecnica de evasion usa el atacante para que un enlace pase los sandboxes de detonacion del gateway de correo?", o: ["Acortar la URL", "Usar HTTPS", "Cloaking que sirve contenido benigno a IPs de sandboxes/escaneres y el payload solo a la victima real"], c: 2, e: "El cloaking detecta entornos de analisis (user-agent, geo, IP) y entrega contenido inocuo, reservando el ataque para victimas reales." },
    ],
  },
  40: {
    i: [
      { q: "Cual es la primera regla de seguridad al analizar malware?", o: ["Ejecutarlo en el host de produccion", "Trabajar en un entorno aislado (VM/sandbox) sin acceso a la red corporativa", "Desactivar el antivirus en toda la red"], c: 1, e: "El analisis debe hacerse en entornos aislados para evitar infeccion o propagacion accidental." },
      { q: "Que diferencia hay entre analisis estatico y dinamico de malware?", o: ["Son lo mismo", "El estatico examina la muestra sin ejecutarla, el dinamico observa su comportamiento al ejecutarse", "El estatico ejecuta la muestra, el dinamico no"], c: 1, e: "El estatico inspecciona codigo/estructura sin correr; el dinamico analiza el comportamiento en ejecucion." },
      { q: "Que es un hash (MD5/SHA-256) en el contexto de identificacion de malware?", o: ["Una huella unica que identifica la muestra y permite buscarla en bases como VirusTotal", "Un cifrador del archivo", "El nombre del autor"], c: 0, e: "El hash actua como identificador unico de la muestra para correlacion e inteligencia de amenazas." },
      { q: "Que clasificacion describe a un malware que se replica solo a traves de la red sin intervencion del usuario?", o: ["Ransomware", "Gusano (worm)", "Troyano"], c: 1, e: "El gusano se propaga automaticamente por la red explotando vulnerabilidades, sin accion del usuario." },
    ],
    a: [
      { q: "Por que muchas muestras detectan entornos de analisis y cambian su comportamiento?", o: ["Para mejorar el rendimiento", "Para ahorrar CPU", "Anti-analisis/evasion: comprobar artefactos de VM, sandbox y debugger para no revelar su carga maliciosa"], c: 2, e: "El malware avanzado usa anti-VM/anti-sandbox para permanecer inerte en entornos de analisis y solo actuar en victimas reales." },
      { q: "Que ventaja aporta combinar analisis estatico y dinamico en un flujo de triage maduro?", o: ["El estatico revela capacidades e IoCs sin ejecucion y el dinamico confirma comportamiento real, cubriendo evasion de ambos", "Elimina la necesidad de aislamiento", "Reduce el tamano de la muestra"], c: 0, e: "Cada enfoque cubre las limitaciones del otro: estatico ve potencial latente, dinamico observa ejecucion real." },
      { q: "Que es un IoC (Indicador de Compromiso) derivado del analisis de malware?", o: ["El nombre comercial del malware", "Una firma de antivirus generica", "Artefactos observables (hashes, IPs/dominios C2, mutex, claves de registro) usados para deteccion y caza"], c: 2, e: "Los IoCs son atributos concretos extraidos de la muestra que permiten detectar la amenaza en otros sistemas." },
      { q: "Por que el code signing valido no garantiza que un binario sea benigno?", o: ["Los atacantes roban o compran certificados validos para firmar malware y evadir controles de confianza", "Las firmas nunca caducan", "El firmado solo aplica a documentos"], c: 0, e: "Certificados robados o adquiridos fraudulentamente permiten firmar malware que aparenta legitimidad." },
    ],
  },
  41: {
    i: [
      { q: "Que informacion util suele extraer el comando strings de un binario sospechoso?", o: ["El codigo fuente completo", "La clave de cifrado garantizada", "Cadenas legibles como URLs, IPs, rutas, mensajes de error o nombres de funciones"], c: 2, e: "strings revela texto ASCII/Unicode embebido que puede exponer C2, rutas o artefactos del autor." },
      { q: "Que seccion de cabecera PE indica el punto de entrada y la disposicion del ejecutable?", o: ["El bloque de comentarios", "El PE header con AddressOfEntryPoint y la tabla de secciones", "La Import Address Table del PDF"], c: 1, e: "El PE header contiene el entry point, secciones (.text, .data) y tablas de importacion clave para el analisis." },
      { q: "Que herramienta es estandar para desensamblar y analizar estaticamente binarios?", o: ["IDA Pro / Ghidra", "Wireshark", "Nmap"], c: 0, e: "IDA Pro y Ghidra son desensambladores/decompiladores estandar para analisis estatico de binarios." },
      { q: "Que indica una entropia muy alta y pocas strings legibles en un ejecutable?", o: ["Que es un archivo de texto", "Que es codigo fuente sin compilar", "Que probablemente esta empaquetado (packed) o cifrado"], c: 2, e: "Alta entropia y escasez de strings claras sugieren packing/cifrado que oculta el codigo real." },
    ],
    a: [
      { q: "Como ayuda la Import Address Table (IAT) a inferir capacidades de un malware en analisis estatico?", o: ["Lista los autores del binario", "Contiene el trafico de red", "Revela las APIs importadas (ej. WININET, CryptEncrypt, CreateRemoteThread) que sugieren funcionalidad maliciosa"], c: 2, e: "Las funciones importadas insinuan capacidades (red, cifrado, inyeccion) aun antes de ejecutar la muestra." },
      { q: "Cual es el reto principal al analizar estaticamente un binario empaquetado y como se aborda?", o: ["El codigo real esta comprimido/cifrado; se necesita unpacking (manual o dinamico) para revelar el codigo original", "El PE header no existe; se ignora el archivo", "Hay que recompilar el codigo fuente"], c: 0, e: "El packer oculta el codigo; hay que desempaquetar (volcar el codigo desempaquetado en memoria) antes de analizarlo." },
      { q: "Por que el analisis estatico puede fallar ante codigo con auto-modificacion o cifrado de cadenas en runtime?", o: ["Porque el desensamblador es lento", "Porque el PE es invalido", "Porque el codigo/strings reales solo existen tras descifrarse en ejecucion, no en el binario en disco"], c: 2, e: "El string/code obfuscation desencripta en runtime, dejando el binario en disco sin la informacion relevante para el estatico." },
      { q: "Que tecnica permite identificar codigo de bibliotecas conocidas para enfocar el analisis en codigo propio del malware?", o: ["Port mirroring", "File carving", "Firmas FLIRT (IDA) o similares para reconocer funciones de librerias estandar"], c: 2, e: "FLIRT identifica funciones de librerias compiladas, evitando perder tiempo y aislando el codigo del autor." },
    ],
  },
  42: {
    i: [
      { q: "Que herramienta permite monitorear en tiempo real la actividad de procesos, registro y archivos en Windows durante el analisis dinamico?", o: ["Calc", "Procmon (Process Monitor)", "Notepad"], c: 1, e: "Process Monitor de Sysinternals registra eventos de proceso, archivo y registro en tiempo real." },
      { q: "Para que sirve ejecutar malware en una sandbox automatizada como Cuckoo o ANY.RUN?", o: ["Firmar el binario", "Detonar la muestra en un entorno controlado y recopilar comportamiento (red, archivos, procesos) de forma automatica", "Compilar el codigo fuente"], c: 1, e: "Las sandboxes detonan la muestra y generan reportes de comportamiento e IoCs automaticamente." },
      { q: "Que utilidad tiene un debugger como x64dbg en el analisis dinamico?", o: ["Analizar PCAPs", "Controlar la ejecucion paso a paso, poner breakpoints e inspeccionar memoria y registros", "Editar imagenes"], c: 1, e: "El debugger permite ejecucion controlada, breakpoints e inspeccion del estado para entender el comportamiento." },
      { q: "Por que se suele usar una herramienta como FakeNet/INetSim al detonar malware?", o: ["Para compilar el codigo", "Para simular servicios de red e interceptar el trafico C2 sin dar internet real a la muestra", "Para acelerar el disco"], c: 1, e: "INetSim/FakeNet simulan DNS/HTTP/etc. capturando intentos de C2 sin conectar la muestra a internet real." },
    ],
    a: [
      { q: "Que tecnica anti-debugging detecta la presencia de un depurador consultando una bandera del proceso?", o: ["IsDebuggerPresent / chequeo del flag BeingDebugged en el PEB", "Hashing del binario", "Lectura del PCAP"], c: 0, e: "IsDebuggerPresent y la comprobacion directa de BeingDebugged en el PEB son chequeos clasicos anti-debug." },
      { q: "Como ayuda el API hooking (ej. con un monitor de APIs) a revelar comportamiento que el malware intenta ocultar?", o: ["Borra los logs", "Intercepta y registra llamadas a APIs criticas (creacion de procesos, red, cifrado) aunque el malware ofusque cadenas", "Cifra las llamadas"], c: 1, e: "Hookear APIs captura la intencion real en tiempo de llamada, incluso con strings/codigo ofuscado." },
      { q: "Que evasion usa el malware contra sandboxes basada en interaccion humana o tiempo?", o: ["Compresion del binario", "Cambiar la extension", "Esperar movimiento de raton/clics o usar sleeps largos para superar el timeout de la sandbox"], c: 2, e: "Detectar ausencia de interaccion humana o dormir mas que el timeout evita la detonacion en sandboxes." },
      { q: "Por que el analisis dinamico puede no observar todas las rutas de ejecucion del malware?", o: ["El comportamiento puede depender de condiciones (fecha, dominio AD, C2 vivo) no cumplidas en el entorno de analisis", "Las APIs estan cifradas siempre", "El debugger es incompatible"], c: 0, e: "El codigo condicional (triggers de fecha, entorno especifico, C2 activo) deja ramas sin ejecutar durante la detonacion." },
    ],
  },
  43: {
    i: [
      { q: "Que es la cadena de custodia en forense digital?", o: ["El orden de arranque del sistema", "Un tipo de cifrado", "El registro documentado de quien, cuando y como manejo la evidencia para preservar su integridad y admisibilidad"], c: 2, e: "La cadena de custodia documenta el manejo de la evidencia para garantizar su integridad legal." },
      { q: "Segun el orden de volatilidad (RFC 3227), que se debe recolectar PRIMERO?", o: ["Los registros de CPU, cache y la memoria RAM", "Los archivos en disco", "Los backups en cinta"], c: 0, e: "Se recolecta de lo mas volatil a lo menos: registros/cache, RAM, conexiones, antes que disco o backups." },
      { q: "Por que se calcula un hash de la evidencia al adquirirla?", o: ["Para comprimirla", "Para verificar despues que la copia no se ha alterado (integridad)", "Para cifrarla"], c: 1, e: "El hash permite demostrar que la evidencia adquirida permanece identica e intacta." },
      { q: "Que dispositivo se usa para adquirir un disco sin escribir nada en el original?", o: ["Un switch", "Un write blocker (bloqueador de escritura)", "Un router"], c: 1, e: "El write blocker impide cualquier escritura al medio original, preservando la evidencia intacta." },
    ],
    a: [
      { q: "Por que la adquisicion de memoria RAM debe priorizarse antes de apagar el equipo?", o: ["Porque la RAM ocupa poco espacio", "Porque acelera el imaging", "Porque contiene datos volatiles (claves, procesos, conexiones, malware sin archivo) que se pierden al apagar"], c: 2, e: "La RAM guarda artefactos efimeros (claves de cifrado, malware fileless, sockets) irrecuperables tras el apagado." },
      { q: "Que principio establece que el examinador no debe alterar la evidencia original y como se cumple en la practica?", o: ["Defensa en profundidad; con firewalls", "Preservacion de la integridad; trabajando sobre copias verificadas por hash y usando write blockers", "Principio de minimo privilegio; con ACLs"], c: 1, e: "Se preserva el original analizando copias forenses validadas por hash, nunca el medio fuente directamente." },
      { q: "Que riesgo introduce la adquisicion en vivo (live acquisition) de un sistema en ejecucion?", o: ["No genera hashes", "Es imposible tecnicamente", "El propio acto de recoleccion modifica el estado del sistema, dejando una huella que debe documentarse"], c: 2, e: "La adquisicion en vivo altera memoria/estado; el principio de Locard obliga a documentar y minimizar el impacto." },
      { q: "Por que la documentacion rigurosa de la cadena de custodia es critica mas alla de lo tecnico?", o: ["Reduce el tamano del hash", "Mejora el rendimiento del disco", "Sin ella la evidencia puede ser inadmisible en un tribunal por dudas sobre su integridad o manejo"], c: 2, e: "Una cadena de custodia rota o indocumentada compromete la admisibilidad legal de la evidencia." },
    ],
  },
  44: {
    i: [
      { q: "Que es el file carving en analisis forense?", o: ["Particionar el disco", "Recuperar archivos a partir de sus firmas/cabeceras sin depender de la tabla del sistema de ficheros", "Cifrar archivos"], c: 1, e: "El carving reconstruye archivos buscando firmas conocidas, util cuando la metadata del FS esta perdida." },
      { q: "Para que se usa el framework Volatility en forense?", o: ["Para capturar trafico de red", "Para clonar discos", "Para analizar volcados de memoria RAM (procesos, conexiones, inyecciones)"], c: 2, e: "Volatility extrae artefactos de un volcado de memoria: procesos, DLLs, conexiones, codigo inyectado." },
      { q: "Que formato comun se usa para almacenar una imagen forense de disco con metadata y compresion?", o: [".E01 (EnCase Evidence File)", ".docx", ".mp3"], c: 0, e: "El formato E01 almacena la imagen con metadata, compresion y hash de verificacion integrado." },
      { q: "Que comando/utilidad de Linux realiza un volcado bit a bit de un disco?", o: ["ping", "grep", "dd / dcfldd"], c: 2, e: "dd (o dcfldd con hashing) crea una copia bit a bit exacta del medio para analisis forense." },
    ],
    a: [
      { q: "Que ventaja ofrece el analisis de memoria sobre el de disco al investigar malware fileless?", o: ["Es mas barato", "El disco es ilegible", "El malware sin archivo solo vive en RAM, por lo que el disco no contiene su codigo ejecutable"], c: 2, e: "El malware fileless reside unicamente en memoria; solo el volcado de RAM revela su presencia." },
      { q: "Que tecnica de Volatility ayuda a detectar codigo inyectado o procesos ocultos por rootkits?", o: ["strings del disco", "filescan unicamente", "malfind y comparar psscan vs pslist para hallar procesos no enlazados (DKOM)"], c: 2, e: "malfind detecta regiones de memoria sospechosas; comparar psscan/pslist revela procesos ocultos por DKOM." },
      { q: "Por que el slack space y el espacio no asignado son relevantes en file carving avanzado?", o: ["Estan siempre cifrados", "Pueden contener fragmentos de archivos borrados o datos ocultados deliberadamente, recuperables por firma", "Aceleran la copia"], c: 1, e: "El slack y el unallocated guardan restos de datos borrados u ocultos que el carving puede reconstruir." },
      { q: "Que limitacion tiene el carving frente a archivos fragmentados en el medio?", o: ["Solo funciona en SSD", "No reconoce cabeceras", "Asume contiguidad, por lo que archivos fragmentados pueden reconstruirse incompletos o corruptos"], c: 2, e: "El carving por firmas asume datos contiguos; la fragmentacion rompe esa premisa y dana la reconstruccion." },
    ],
  },
  45: {
    i: [
      { q: "Que contiene un archivo PCAP?", o: ["Un volcado de memoria", "El codigo fuente de una app", "Una captura de paquetes de red con su contenido y metadata"], c: 2, e: "Un PCAP almacena paquetes capturados, util para analizar comunicaciones y trafico malicioso." },
      { q: "En que se diferencia NetFlow de una captura PCAP completa?", o: ["NetFlow guarda todo el payload y PCAP solo metadata", "NetFlow registra metadata/estadisticas de flujos (IPs, puertos, bytes) sin el payload completo", "Son identicos"], c: 1, e: "NetFlow resume flujos (quien habla con quien, cuanto) sin el contenido; PCAP guarda paquetes completos." },
      { q: "Para que se usa Zeek (antes Bro) en forense de red?", o: ["Para cifrar trafico", "Para generar logs estructurados de alto nivel (conexiones, DNS, HTTP, SSL) a partir del trafico", "Para clonar discos"], c: 1, e: "Zeek transforma el trafico en logs ricos por protocolo, ideal para deteccion e investigacion." },
      { q: "Que herramienta grafica es estandar para inspeccionar PCAPs paquete a paquete?", o: ["Wireshark", "IDA Pro", "Volatility"], c: 0, e: "Wireshark permite inspeccionar, filtrar y seguir flujos dentro de un PCAP de forma visual." },
    ],
    a: [
      { q: "Como ayuda NetFlow a investigar una intrusion cuando no se dispone de capturas PCAP completas?", o: ["Permite reconstruir patrones de comunicacion, detectar beaconing C2 y exfiltracion por volumen/temporalidad de flujos", "Descifra TLS", "Recupera el payload cifrado"], c: 0, e: "Aunque carece de payload, los metadatos de flujo revelan beaconing, picos de exfiltracion y mapas de comunicacion." },
      { q: "Que tecnica permite detectar beaconing C2 en logs de Zeek aun con trafico cifrado (TLS)?", o: ["Leer el cuerpo HTTP", "Analizar regularidad temporal (intervalos), JA3/JA3S fingerprints y metadatos de certificado", "Descifrar el TLS con la clave del atacante"], c: 1, e: "El beaconing se delata por periodicidad y fingerprints TLS (JA3) sin necesidad de descifrar el contenido." },
      { q: "Por que el analisis de DNS en logs de red es valioso para caza de amenazas?", o: ["El DNS nunca se cifra", "Acelera la red", "Revela tunneling, dominios DGA, y resoluciones a C2 que delatan actividad maliciosa"], c: 2, e: "El trafico DNS expone tunneling, dominios algoritmicos (DGA) y consultas a infraestructura maliciosa." },
      { q: "Que reto plantea el cifrado TLS generalizado para el forense de red y como se aborda?", o: ["Solo se puede usar Wireshark", "Limita la visibilidad del payload; se recurre a metadata, JA3, SNI, NetFlow y inspeccion en endpoints", "Hace imposible cualquier analisis"], c: 1, e: "Con payload cifrado, el analista se apoya en metadatos (SNI, JA3, flujos) y telemetria de endpoint." },
    ],
  },
  46: {
    i: [
      { q: "Que funcion principal cumple un SIEM?", o: ["Centralizar, normalizar y correlacionar logs de multiples fuentes para detectar incidentes", "Hacer backups", "Cifrar discos"], c: 0, e: "El SIEM agrega y correlaciona eventos de distintas fuentes para generar alertas de seguridad." },
      { q: "Que es una regla de correlacion en un SIEM?", o: ["Una politica de backup", "Una logica que relaciona varios eventos para identificar un patron sospechoso (ej. fuerza bruta seguida de login exitoso)", "Un certificado TLS"], c: 1, e: "La correlacion une eventos individuales en un patron con significado de seguridad." },
      { q: "Que lenguaje de busqueda se usa en Splunk?", o: ["Python obligatorio", "SPL (Search Processing Language)", "SQL puro"], c: 1, e: "Splunk usa SPL para buscar, filtrar y transformar datos indexados." },
      { q: "Que componente del stack ELK se encarga de almacenar e indexar los logs?", o: ["Kibana", "Logstash", "Elasticsearch"], c: 2, e: "Elasticsearch indexa y almacena; Logstash ingiere/transforma y Kibana visualiza." },
    ],
    a: [
      { q: "Por que la normalizacion de logs es critica para la correlacion efectiva en un SIEM?", o: ["Reduce el costo de licencia", "Cifra los logs", "Mapea campos heterogeneos a un esquema comun para que reglas crucen eventos de fuentes distintas"], c: 2, e: "Sin un esquema comun (ej. usuario, IP, accion), las reglas no pueden correlacionar entre fuentes dispares." },
      { q: "Que diferencia un use case de deteccion bien disenado de una alerta ruidosa con muchos falsos positivos?", o: ["El uso de mas CPU", "El color del dashboard", "Contexto, umbrales afinados, listas de exclusion y mapeo a TTPs (ej. MITRE ATT&CK) para alta fidelidad"], c: 2, e: "Un use case maduro incorpora contexto, tuning y mapeo a ATT&CK para reducir falsos positivos." },
      { q: "Por que el log enrichment (enriquecimiento) mejora la deteccion en un SIEM?", o: ["Comprime los datos", "Anade contexto (geo, threat intel, identidad, asset criticidad) que permite priorizar y correlacionar mejor", "Borra logs antiguos"], c: 1, e: "El enriquecimiento aporta inteligencia y contexto que afinan la deteccion y la priorizacion." },
      { q: "Que limitacion tiene un SIEM ante ataques que no generan logs en las fuentes monitoreadas?", o: ["Ninguna, ve todo", "Detecta por intuicion", "Solo detecta lo que se ingiere; gaps de logging (ej. comandos sin auditoria) crean puntos ciegos"], c: 2, e: "El SIEM solo ve lo que recibe; fuentes sin logging adecuado generan blind spots explotables." },
    ],
  },
  47: {
    i: [
      { q: "Cuales son las fases del ciclo de respuesta a incidentes segun NIST (SP 800-61)?", o: ["Escaneo, explotacion, reporte", "Preparacion; Deteccion y Analisis; Contencion, Erradicacion y Recuperacion; Actividad Post-Incidente", "Backup, restore, reboot"], c: 1, e: "NIST define 4 fases: Preparacion, Deteccion/Analisis, Contencion/Erradicacion/Recuperacion y Post-Incidente." },
      { q: "Que objetivo tiene la fase de contencion?", o: ["Limitar el alcance y evitar que el incidente se propague mientras se planifica la erradicacion", "Documentar lecciones aprendidas", "Eliminar el malware del disco"], c: 0, e: "La contencion frena la propagacion y el dano mientras se prepara la erradicacion." },
      { q: "Que se hace en la fase post-incidente (lessons learned)?", o: ["Apagar el SIEM", "Reinstalar todo sin documentar", "Analizar la respuesta para mejorar procesos, detecciones y preparacion futura"], c: 2, e: "La fase post-incidente extrae lecciones para fortalecer la postura y la respuesta futura." },
      { q: "Por que se prioriza preservar evidencia durante la respuesta a incidentes?", o: ["Para liberar espacio", "Para acelerar la recuperacion", "Para permitir analisis forense, atribucion y posibles acciones legales"], c: 2, e: "Preservar evidencia habilita el forense, la atribucion y eventuales procesos legales." },
    ],
    a: [
      { q: "Que tension clave debe equilibrar el equipo entre contencion rapida y preservacion de evidencia?", o: ["Ninguna, siempre se apaga", "Aislar/apagar puede destruir artefactos volatiles necesarios para el forense; hay que capturar memoria antes", "Costo vs velocidad de CPU"], c: 1, e: "Apagar contiene pero borra RAM/estado; se debe adquirir memoria antes de acciones destructivas." },
      { q: "Por que la erradicacion incompleta es uno de los mayores riesgos en IR?", o: ["Consume disco", "Genera demasiados logs", "Si quedan mecanismos de persistencia o backdoors, el atacante reingresa y reinicia el incidente"], c: 2, e: "Persistencias o backdoors no eliminados permiten al atacante volver, reabriendo el incidente." },
      { q: "Que rol cumple la fase de preparacion frente a la efectividad de las demas fases del ciclo?", o: ["Define playbooks, herramientas, accesos y capacidad de logging que determinan la velocidad y calidad de toda la respuesta", "Solo aplica tras el incidente", "Es opcional"], c: 0, e: "Una buena preparacion (playbooks, telemetria, roles) condiciona el exito de deteccion, contencion y recuperacion." },
      { q: "Por que la contencion debe coordinarse para no alertar prematuramente a un atacante avanzado (APT)?", o: ["Porque el atacante no lo notara nunca", "Para ahorrar energia", "Una contencion visible puede provocar que el atacante destruya evidencia, acelere objetivos o cambie de TTPs"], c: 2, e: "Si el APT detecta la respuesta puede borrar rastros, acelerar exfiltracion o migrar a nueva infraestructura." },
    ],
  },
  48: {
    i: [
      { q: "En que se basa el threat hunting proactivo?", o: ["Formular hipotesis sobre actividad maliciosa y buscarla activamente aunque no haya alertas", "Ejecutar antivirus diario", "Esperar alertas del SIEM"], c: 0, e: "El hunting parte de hipotesis y busca amenazas que evadieron las detecciones automaticas." },
      { q: "Que diferencia un IoC de un IoA?", o: ["Son lo mismo", "El IoC describe artefactos ya observados (hash, IP); el IoA describe comportamiento/intencion del ataque", "El IoA es solo un hash"], c: 1, e: "IoC son evidencias de un compromiso ya ocurrido; IoA describen tacticas/comportamiento en curso." },
      { q: "Que representa la Pyramid of Pain de David Bianco?", o: ["El grado de dificultad que causa al atacante cuando le negamos distintos tipos de indicadores", "Niveles de cifrado", "Fases del backup"], c: 0, e: "La piramide ordena indicadores por el dolor que infligen al adversario al ser bloqueados." },
      { q: "Que indicador esta en la cima de la Pyramid of Pain (mas doloroso de cambiar para el atacante)?", o: ["TTPs (Tacticas, Tecnicas y Procedimientos)", "Direccion IP", "Hash de archivo"], c: 0, e: "Los TTPs son lo mas costoso de cambiar para el atacante; bloquearlos causa el mayor dolor." },
    ],
    a: [
      { q: "Por que centrar la deteccion en TTPs es mas resiliente que basarse en hashes o IPs?", o: ["Los hashes son largos", "Hashes/IPs cambian trivialmente; los TTPs reflejan el comportamiento nuclear del adversario, costoso de alterar", "Las IPs nunca cambian"], c: 1, e: "Bloquear comportamiento (TTPs) obliga al atacante a rediseñar su metodo, no solo rotar indicadores triviales." },
      { q: "Como guia el modelo MITRE ATT&CK la formulacion de hipotesis en threat hunting?", o: ["Ofrece un catalogo estructurado de tacticas y tecnicas para hipotetizar y mapear cobertura de deteccion", "Cifra los logs de caza", "Genera firmas automaticamente"], c: 0, e: "ATT&CK aporta un marco de TTPs que orienta hipotesis y revela gaps de visibilidad/deteccion." },
      { q: "Que caracteriza una hipotesis de hunting bien formulada frente a una busqueda exploratoria sin foco?", o: ["Es mas larga", "No requiere datos", "Es especifica, basada en TTPs/threat intel del entorno y comprobable con los datos disponibles"], c: 2, e: "Una buena hipotesis es concreta, fundamentada en inteligencia y verificable con la telemetria existente." },
      { q: "Por que el threat hunting alimenta la mejora continua de las detecciones automatizadas?", o: ["Aumenta el almacenamiento", "Los hallazgos del hunting se convierten en nuevas reglas/analiticas, reduciendo la dependencia de caza manual", "Reemplaza al SIEM por completo"], c: 1, e: "Lo descubierto cazando se operacionaliza en detecciones, elevando la deteccion automatica futura." },
    ],
  },
  49: {
    i: [
      { q: "Que principio de IAM en AWS recomienda otorgar solo los permisos estrictamente necesarios?", o: ["Principio de minimo privilegio", "Acceso total por defecto", "Compartir la root account"], c: 0, e: "El minimo privilegio limita los permisos a lo imprescindible, reduciendo la superficie de ataque." },
      { q: "Cual es una misconfiguracion clasica y peligrosa de un bucket S3?", o: ["Exponerlo con acceso publico de lectura/escritura sin necesidad", "Tener versioning activado", "Usar cifrado en reposo"], c: 0, e: "Buckets S3 publicos por error son causa frecuente de filtraciones masivas de datos." },
      { q: "Que servicio de AWS detecta actividad maliciosa y comportamiento anomalo analizando logs como CloudTrail y VPC Flow Logs?", o: ["Lambda", "GuardDuty", "S3"], c: 1, e: "GuardDuty es el servicio de deteccion de amenazas gestionado de AWS basado en analisis de logs." },
      { q: "Por que se desaconseja usar la cuenta root de AWS para operaciones diarias?", o: ["Es mas lenta", "No soporta MFA", "Tiene acceso total e irrestricto; su compromiso es catastrofico, se debe proteger con MFA y no usar a diario"], c: 2, e: "La root tiene control absoluto; se asegura con MFA y se reserva solo para tareas que la exigen." },
    ],
    a: [
      { q: "Que riesgo introduce un rol IAM con una politica de confianza (trust policy) demasiado permisiva?", o: ["Reduce el cifrado", "Mayor latencia", "Permite que principales no deseados asuman el rol (confused deputy / escalada de privilegios cross-account)"], c: 2, e: "Una trust policy laxa habilita que entidades externas asuman el rol, abriendo escalada o acceso cross-account." },
      { q: "Por que las claves de acceso de larga duracion son un antipatron frente a roles y credenciales temporales (STS)?", o: ["Son mas caras", "No rotan, suelen filtrarse en codigo/repos y conceden acceso persistente; STS emite credenciales efimeras", "STS no funciona en EC2"], c: 1, e: "Las claves estaticas se filtran y persisten; STS/roles dan credenciales temporales y auto-rotadas." },
      { q: "Como puede un atacante escalar privilegios abusando de permisos IAM aparentemente inofensivos como iam:PassRole?", o: ["No es posible escalar con IAM", "Combinando PassRole con la creacion de recursos (ej. Lambda/EC2) que asumen un rol mas privilegiado", "Solo leyendo buckets"], c: 1, e: "iam:PassRole mas permisos de crear computo permite ejecutar codigo con un rol de mayor privilegio." },
      { q: "Por que CloudTrail es fundamental aunque GuardDuty ya detecte amenazas?", o: ["CloudTrail provee el registro completo de llamadas API para forense, investigacion y reconstruir la actividad del atacante", "GuardDuty no existe", "CloudTrail cifra S3"], c: 0, e: "CloudTrail es el log de auditoria de la API, base para forense y para que GuardDuty y los analistas investiguen." },
    ],
  },
  50: {
    i: [
      { q: "Que es Microsoft Entra ID (antes Azure AD)?", o: ["El servicio de identidad y gestion de accesos en la nube de Microsoft", "Un servicio de almacenamiento de blobs", "Una base de datos SQL"], c: 0, e: "Entra ID es el IdP cloud de Microsoft para autenticacion y autorizacion de identidades." },
      { q: "Que ventaja de seguridad ofrecen las managed identities en Azure?", o: ["Aumentan el ancho de banda", "Cifran el disco local", "Eliminan credenciales embebidas: Azure gestiona y rota la identidad de un recurso automaticamente"], c: 2, e: "Las managed identities evitan secretos en codigo; Azure administra y rota las credenciales del recurso." },
      { q: "Que mecanismo recomienda Azure para limitar el acceso administrativo solo cuando se necesita y por tiempo limitado?", o: ["Compartir la cuenta global admin", "Asignacion permanente de roles", "PIM (Privileged Identity Management) con activacion just-in-time"], c: 2, e: "PIM concede roles privilegiados just-in-time y por tiempo acotado, reduciendo exposicion." },
      { q: "Que concepto de GCP agrupa permisos y se asigna a un principal sobre un recurso?", o: ["Rol IAM (predefinido, basico o personalizado)", "Bucket", "VPC"], c: 0, e: "En GCP IAM, un rol es un conjunto de permisos que se vincula a un principal sobre un recurso." },
    ],
    a: [
      { q: "Por que el consentimiento abusivo de aplicaciones OAuth (illicit consent grant) es una amenaza grave en Entra ID?", o: ["Consume cuota de red", "Una app maliciosa con consentimiento obtiene acceso persistente a datos sin necesitar la contrasena ni romper MFA", "Solo afecta a discos locales"], c: 1, e: "El consentimiento concede tokens persistentes que evaden MFA y password, dando acceso continuo a recursos." },
      { q: "Que riesgo introduce una jerarquia de IAM en GCP con bindings amplios a nivel de organizacion o carpeta?", o: ["Los permisos se heredan hacia abajo, concediendo acceso excesivo a todos los proyectos descendientes", "Mayor costo de red", "Desactiva el cifrado"], c: 0, e: "La herencia de IAM en GCP propaga permisos a recursos hijos; bindings altos sobre-otorgan acceso." },
      { q: "Como puede abusarse de una managed identity comprometida en una VM de Azure para moverse lateralmente?", o: ["No es posible", "Solicitando tokens al endpoint de metadata (IMDS) y usandolos para acceder a recursos segun los permisos de la identidad", "Reiniciando la VM"], c: 1, e: "Desde la VM se piden tokens al IMDS de la managed identity y se usan para acceder segun sus roles asignados." },
      { q: "Por que los conditional access policies son centrales en la estrategia Zero Trust de Entra ID?", o: ["Solo aplican a on-premise", "Evaluan senales (usuario, dispositivo, riesgo, ubicacion) para conceder/denegar o exigir MFA por contexto", "Aceleran el login"], c: 1, e: "El conditional access aplica decisiones basadas en contexto y riesgo, pilar del modelo Zero Trust." },
      { q: "En un workload identity pool de GCP, olvidar la attribute_condition permite que:", o: ["El pool sea mas rapido", "Cualquier repo de GitHub Actions del mundo con OIDC pueda impersonar la SA", "El JWT sea mas corto"], c: 1, e: "Incidentes publicos 2023: attribute.repository debe filtrar al repo especifico, sino es acceso mundial." },
      { q: "Un tenant de Azure AD B2C se separa del Entra corporativo porque:", o: ["Es opcional y no aporta nada", "GDPR obliga a separar identidades de clientes de empleados, y B2C escala a millones con custom policies", "Es mas barato en el mismo tenant"], c: 1, e: "Mezclar CIAM con IAM corporativo termina en tenants cruzados y compliance issues." },
      { q: "En Entra, la revocacion efectiva de un illicit consent grant requiere:", o: ["Solo cambiar contrasena", "Borrar el oauth2PermissionGrant + revocar refresh tokens + auditar app registrations", "Reinstalar Windows"], c: 1, e: "Los refresh tokens sobreviven al cambio de password; hay que revocarlos explicitamente." },
      { q: "VPC Service Controls debe pilotarse en modo dry-run porque:", o: ["Es un requisito legal", "Bloquea tambien accesos legitimos mal configurados; los logs de dry-run permiten mapear excepciones antes de enforce", "Reduce la performance"], c: 1, e: "Un enforce prematuro puede romper produccion. Log-only primero, tuning, luego enforce." },
      { q: "En AKS, el Azure AD Workload Identity reemplaza a Pod Identity porque:", o: ["Es mas lento", "Pod Identity (MSI-based) fue deprecado en 2023; el nuevo modelo usa OIDC federation por pod, alineado con estandares cross-cloud", "No usa RBAC"], c: 1, e: "El nuevo modelo es OIDC + federated credentials, portable entre AKS y otros clusters." },
    ],
  },
  51: {
    i: [
      { q: "En Docker, que flag concede al contenedor casi todas las capabilities del kernel y desactiva las protecciones de seccomp/AppArmor?", o: ["--security-opt=no-new-privileges", "--cap-add=NET_ADMIN", "--privileged"], c: 2, e: "--privileged otorga acceso amplio al host (todas las capabilities, /dev, sin seccomp), siendo un vector clasico de escape." },
      { q: "Que componente del kernel Linux aisla la vista de procesos, red y montajes de un contenedor?", o: ["cgroups", "namespaces", "capabilities"], c: 1, e: "Los namespaces (pid, net, mnt, uts, ipc, user) proporcionan el aislamiento; cgroups limitan recursos." },
      { q: "Para que sirve seccomp en un contenedor?", o: ["Filtrar las syscalls que el proceso puede invocar", "Limitar el uso de CPU y memoria", "Cifrar el filesystem del contenedor"], c: 0, e: "seccomp (secure computing) restringe el conjunto de syscalls permitidas, reduciendo la superficie de ataque del kernel." },
      { q: "En Kubernetes RBAC, que objeto vincula un Role a un usuario o ServiceAccount dentro de un namespace?", o: ["RoleBinding", "ClusterRole", "NetworkPolicy"], c: 0, e: "Un RoleBinding asocia un Role (permisos) con un sujeto en el ambito de un namespace." },
      { q: "En EKS con IRSA, la anotacion 'eks.amazonaws.com/role-arn' en un ServiceAccount:", o: ["Es decorativa", "Habilita que los pods usando ese SA reciban un JWT proyectado y hagan AssumeRoleWithWebIdentity", "Crea el rol IAM automaticamente"], c: 1, e: "El rol IAM debe existir aparte con trust policy hacia el OIDC issuer del cluster." },
      { q: "Un admission webhook con failurePolicy: Fail bloquea el cluster si:", o: ["Se apaga la RAM", "El webhook cae o no responde a tiempo — usar Ignore para politicas no criticas", "El API server tiene lag"], c: 1, e: "Failure mode debe elegirse segun criticidad: seguridad = Fail, best-effort = Ignore." },
      { q: "Falco monitorea a nivel de:", o: ["Solo logs de aplicacion", "Syscalls del kernel via eBPF o kernel module — detecta comportamiento runtime anomalo", "Solo trafico HTTP"], c: 1, e: "Runtime detection: shell en pod, escritura a /etc/, exec de nc/nmap, cryptominers, etc." },
      { q: "cosign verify con --certificate-identity-regexp permite:", o: ["Firmar mas rapido", "Verificar que la firma provino de un CI en un repo/workflow especifico via keyless OIDC", "Descifrar imagenes"], c: 1, e: "Sigstore emite cert corto con identidad OIDC del CI; el regex la matchea contra la esperada." },
      { q: "Vault CSI Provider difiere de un K8s Secret regular porque:", o: ["Es identico", "El secret se monta desde Vault en runtime al pod y no toca etcd", "Solo funciona en AKS"], c: 1, e: "Reduce la exposicion vs ESO (que si sincroniza a etcd con TTL/rotation)." },
    ],
    a: [
      { q: "Por que montar el Docker socket (/var/run/docker.sock) dentro de un contenedor es equivalente a root en el host?", o: ["Permite crear un contenedor nuevo privilegiado que monte el rootfs del host", "Solo expone metricas de cgroups", "Permite leer logs del daemon unicamente"], c: 0, e: "Quien controla el socket controla el daemon: puede lanzar un contenedor --privileged con / del host montado y obtener RCE como root." },
      { q: "La tecnica de escape via release_agent de cgroups v1 explota que condicion?", o: ["Una race condition en el namespace de red", "Un contenedor con CAP_SYS_ADMIN puede montar un cgroup y definir un release_agent ejecutado por el kernel en el host", "Un fallo de integer overflow en runc"], c: 1, e: "Con CAP_SYS_ADMIN se monta un cgroup, se escribe notify_on_release y release_agent; al vaciarse el cgroup el kernel ejecuta el binario en el contexto del host." },
      { q: "CVE-2019-5736 (runc) logra escape sobrescribiendo que recurso?", o: ["La tabla de syscalls del kernel", "El archivo /etc/passwd del host", "El binario /proc/self/exe de runc mientras se reutiliza el fd"], c: 2, e: "Se sobrescribe el binario runc del host via /proc/self/exe abierto durante docker exec, logrando ejecucion como root en el host." },
      { q: "Que mitigacion impide que un proceso dentro del contenedor gane privilegios via binarios setuid?", o: ["--read-only", "--memory-swap=-1", "--security-opt=no-new-privileges"], c: 2, e: "no_new_privs (PR_SET_NO_NEW_PRIVS) impide que execve otorgue privilegios adicionales, neutralizando setuid/setcap." },
      { q: "Un trust policy IRSA que confia en el issuer OIDC pero no filtra el 'sub' del ServiceAccount permite:", o: ["Reduce el ruido", "Que cualquier SA del cluster asuma el rol (impersonation cluster-wide)", "Mejor performance"], c: 1, e: "Debe filtrar exactamente 'system:serviceaccount:namespace:sa-name' o cualquier SA lo asume." },
      { q: "Un admission webhook que no valida el UPDATE (solo CREATE) puede ser bypasseado con:", o: ["Un GET simple", "Crear un pod inocuo y luego editarlo (kubectl edit) para agregar hostPath/privileged", "Reiniciando kubelet"], c: 1, e: "Los webhooks deben cubrir todas las operaciones relevantes (CREATE + UPDATE, a veces DELETE)." },
      { q: "Falco en eBPF vs kernel module tiene la ventaja de:", o: ["Ser mas rapido en todos los casos", "No requerir compilar contra el kernel del host (portabilidad, seguridad)", "Ser mas ruidoso"], c: 1, e: "eBPF elimina la dependencia de builder de kernel modules; recomendado en clusters heterogeneos." },
      { q: "Una attestation SLSA L3 de una imagen contenedora firmada con cosign incluye:", o: ["Solo el hash", "Provenance verificable: commit, workflow, builder aislado y timestamp inmutable en Rekor", "La contrasena del developer"], c: 1, e: "cosign download attestation muestra la cadena completa reproducible por cualquier verificador." },
      { q: "External Secrets Operator falla al reconciliar si:", o: ["El cluster no tiene GPU", "El SA del ESO no tiene RBAC sobre el backend (Vault/SM/KV) o el cluster perdio conectividad", "El namespace es 'default'"], c: 1, e: "El controller depende de Workload Identity o creds del backend; sin RBAC, sync se detiene y el K8s Secret queda stale." },
    ],
  },
  52: {
    i: [
      { q: "Cual es la diferencia clave entre SAST y DAST?", o: ["SAST analiza codigo fuente estatico; DAST prueba la aplicacion en ejecucion", "SAST corre en produccion; DAST en desarrollo", "SAST es para web; DAST para binarios"], c: 0, e: "SAST inspecciona el codigo sin ejecutarlo; DAST envia inputs a la app corriendo (caja negra)." },
      { q: "Que es un SBOM en el contexto de supply chain?", o: ["Un inventario formal de todos los componentes y dependencias de un software", "Un escaner de puertos", "Un script de build automatizado"], c: 0, e: "El Software Bill of Materials lista librerias, versiones y licencias, clave para detectar dependencias vulnerables." },
      { q: "Cual es la mejor practica para manejar secrets en un pipeline CI/CD?", o: ["Usar un gestor de secrets/vault e inyectarlos como variables en tiempo de ejecucion", "Hardcodearlos en el repositorio cifrados con base64", "Guardarlos en comentarios del Dockerfile"], c: 0, e: "Los secrets deben vivir en un vault (Hashicorp Vault, AWS Secrets Manager) e inyectarse efimeramente, nunca en el repo." },
      { q: "Que tipo de ataque mitiga la firma de artefactos con Sigstore/cosign?", o: ["SQL injection", "Manipulacion de imagenes/artefactos en la cadena de suministro", "Denial of service"], c: 1, e: "Firmar y verificar artefactos garantiza integridad y procedencia, evitando que un atacante inserte builds maliciosos." },
      { q: "En OIDC federation GitHub → AWS, el claim 'sub' debe filtrarse porque:", o: ["Es opcional", "Contiene 'repo:org/repo:ref:refs/heads/main' y filtrar previene que otros repos/ramas asuman el rol", "Es un ID numerico"], c: 1, e: "Sin condition sobre sub, cualquier repo con OIDC de GitHub puede impersonar. Comodines abiertos = catastrofe." },
      { q: "SCIM propaga la desactivacion de un usuario a los SaaS integrados en:", o: ["Anos", "Minutos, via el DELETE /Users/{id} (soft-delete estandarizado)", "Nunca automatico"], c: 1, e: "Cierra el gap del deprovisioning: sin SCIM, las cuentas huerfanas viven semanas en los SaaS." },
      { q: "SLSA L2 requiere sobre L1 principalmente:", o: ["Reproducibilidad bit-a-bit", "Build service hosted (no local dev machine) con provenance firmada", "Two-party review"], c: 1, e: "L2 introduce provenance firmada por un builder hosted; L3 agrega aislamiento del workflow." },
      { q: "El fix canonico contra dependency confusion en npm es:", o: ["No usar npm", "Namespaces reservados (@empresa/*) + '@empresa:registry=...' explicito en .npmrc + registry unico (proxy) para el resto", "MFA en el CI"], c: 1, e: "Namespace claims + resolucion determinista por scope + proxy privado. Trusted Publishers en npm publico refuerza." },
      { q: "En GitHub Actions, 'pull_request' vs 'pull_request_target' se distinguen porque:", o: ["Son sinonimos", "pull_request corre codigo del fork sin secrets; pull_request_target corre codigo del base branch con secrets (creado para labels/CLA legitimos)", "Ninguno accede a secrets"], c: 1, e: "El bug: checkout del head del PR en pull_request_target ejecuta codigo del fork CON secrets → RCE trivial." },
    ],
    a: [
      { q: "El ataque SolarWinds (SUNBURST) comprometio principalmente que etapa del SDLC?", o: ["El sistema de build/compilacion donde se inyecto codigo malicioso antes de firmar", "El servidor de produccion del cliente final", "Las credenciales de los administradores via phishing"], c: 0, e: "Se troyanizo el proceso de build, de modo que el binario malicioso fue firmado legitimamente y distribuido por update oficial." },
      { q: "Que problema de seguridad introduce la 'dependency confusion'?", o: ["Dos versiones del mismo paquete generan un hash colision", "El lockfile se corrompe al hacer merge", "Un paquete interno con el mismo nombre publicado en un repo publico con version mayor es resuelto en su lugar"], c: 2, e: "Si el resolver prioriza la version mas alta del registro publico, un atacante publica un paquete homonimo y consigue ejecucion." },
      { q: "SLSA (Supply-chain Levels for Software Artifacts) en sus niveles altos exige principalmente?", o: ["Solo escaneo SAST del codigo", "Builds hermeticos, reproducibles y con procedencia (provenance) verificable y no falsificable", "Cifrado del repositorio en reposo"], c: 1, e: "Los niveles superiores de SLSA requieren builds aislados, provenance firmada por la plataforma y resistencia a manipulacion." },
      { q: "Por que un pipeline que ejecuta 'pull_request_target' en GitHub Actions es peligroso?", o: ["Desactiva el cache de dependencias", "Solo funciona en repos privados", "Corre con el token y secrets del repo base sobre codigo no confiable del fork"], c: 2, e: "pull_request_target da acceso a secrets/GITHUB_TOKEN con permisos de escritura, y si checkoutea el codigo del PR del fork permite exfiltracion/RCE." },
      { q: "Pinnar acciones de GitHub por SHA en lugar de tag/branch mitiga:", o: ["Latencia de CI", "Que un mantenedor comprometido re-tagee 'v3' hacia un commit malicioso (usos por tag caen; usos por SHA no)", "Costos de storage"], c: 1, e: "Tj-Actions/changed-files 2025 mostro el vector: SHA-pinning + Dependabot para bumps controlados." },
      { q: "Verificar SLSA provenance de un artefacto npm implica:", o: ["Descargar mas rapido", "Comprobar que builder, source repo y workflow declarados coinciden con la politica interna, no solo que exista provenance", "Deshabilitar el lockfile"], c: 1, e: "Provenance L3 sin verificacion es inutil: el consumidor debe validar builder identity + repository + workflow_ref esperados." },
      { q: "Una senal temprana de dependency confusion en un log de CI es:", o: ["Build time normal", "Instalacion de un package con version salto (99.x) publicada en el registry publico el mismo dia y ausente del proxy corp", "Uso de yarn en vez de npm"], c: 1, e: "El atacante publica version alta para ganar la resolucion; el proxy corp legitimo no la tiene." },
      { q: "El attribute_condition en un workload_identity_provider de GCP debe incluir tipicamente:", o: ["Solo el issuer", "attribute.repository == 'org/repo' AND attribute.ref == 'refs/heads/main' (o environment)", "Solo el issuer y aud"], c: 1, e: "Sin filtro repo+ref, cualquier repo GitHub del mundo con OIDC puede impersonar la SA vinculada." },
      { q: "actionlint detecta patrones inseguros como:", o: ["Solo errores YAML", "pull_request_target con checkout del head del PR, uso de expresiones \\$\\{\\{ github.event.issue.title \\}\\} en run: (script injection), permissions demasiado amplios", "Nombres de branches"], c: 1, e: "Es el linter canonico para GitHub Actions; combinado con Trail of Bits' Semgrep rules cubre el catalogo completo." },
    ],
  },
  53: {
    i: [
      { q: "En seguridad IoT, cual es a menudo el primer paso para analizar un dispositivo embebido?", o: ["Extraer y analizar el firmware (binwalk, dumps de flash)", "Decompilar la app de iOS", "Aplicar fuzzing al servidor cloud"], c: 0, e: "Extraer el firmware permite hallar credenciales hardcodeadas, claves y binarios vulnerables." },
      { q: "Que riesgo comun afecta a dispositivos BLE (Bluetooth Low Energy)?", o: ["Falta de cifrado o pairing 'Just Works' que permite MITM/sniffing", "Sobrecalentamiento del chip", "Consumo excesivo de bateria"], c: 0, e: "Muchos dispositivos usan Just Works sin autenticacion, permitiendo interceptacion y suplantacion." },
      { q: "OWASP MASVS es un estandar para que?", o: ["Requisitos de seguridad de aplicaciones moviles", "Auditoria de redes WiFi", "Hardening de servidores Linux"], c: 0, e: "El Mobile Application Security Verification Standard define controles de seguridad para apps Android/iOS." },
      { q: "En Android, donde NO deben almacenarse datos sensibles?", o: ["En el Keystore del sistema", "En SharedPreferences en texto plano", "En el Android Keystore con claves hardware-backed"], c: 1, e: "SharedPreferences en claro es accesible en dispositivos rooteados; los secretos van al Keystore." },
    ],
    a: [
      { q: "Que tecnica permite saltarse SSL pinning en una app movil durante un pentest dinamico?", o: ["Cambiar el DNS del router", "Hooking con Frida/Objection para interceptar la verificacion del certificado", "Recompilar el kernel"], c: 1, e: "Frida/Objection inyectan codigo que neutraliza la logica de pinning, permitiendo MITM del trafico TLS." },
      { q: "En iOS, que mecanismo dificulta el analisis estatico de un binario descargado del App Store?", o: ["La ofuscacion de nombres de variables", "El uso obligatorio de Swift", "El cifrado FairPlay del segmento __TEXT que se descifra en memoria al ejecutar"], c: 2, e: "Las apps de la Store estan cifradas con FairPlay; hay que dumpear el binario desencriptado desde memoria (frida-ios-dump)." },
      { q: "Un ataque de 'fault injection' (glitching) sobre un microcontrolador busca tipicamente?", o: ["Cifrar el bootloader", "Inducir un fallo (voltaje/clock) para saltar verificaciones como el secure boot o lecturas protegidas", "Saturar la memoria flash"], c: 1, e: "El glitching provoca un comportamiento erroneo en un instante preciso para bypassear chequeos de autenticacion o leer memoria bloqueada." },
      { q: "En BLE, el ataque KNOB (Key Negotiation of Bluetooth) explota que debilidad?", o: ["Reutilizacion del IV en GCM", "Un overflow en el stack del controlador", "Negociacion de la entropia de la clave de cifrado, forzandola a 1 byte"], c: 2, e: "KNOB fuerza la negociacion de entropia de la clave de sesion a un minimo (incluso 1 byte), haciendola trivial de bruteforcear." },
    ],
  },
  54: {
    i: [
      { q: "Que caracteriza al examen de la certificacion OSCP?", o: ["Es un examen practico de 24h donde debes comprometer maquinas reales y entregar un reporte", "Es un test de opcion multiple de 4 horas", "Es una entrevista oral"], c: 0, e: "OSCP es hands-on: 24h de hacking en un lab + reporte profesional, con filosofia 'Try Harder'." },
      { q: "Que enfoque tiene la certificacion CISSP frente a OSCP?", o: ["Tecnica ofensiva pura", "Solo forense digital", "Gestion y gobernanza de seguridad (amplitud gerencial, 8 dominios)"], c: 2, e: "CISSP cubre management, riesgo, gobernanza y arquitectura; es de gestion, no de explotacion hands-on." },
      { q: "En un reporte de pentest, donde se resume el riesgo en lenguaje no tecnico para directivos?", o: ["En la seccion de comandos ejecutados", "En los anexos tecnicos", "En el executive summary"], c: 2, e: "El executive summary traduce el impacto de negocio para audiencia ejecutiva, sin jerga tecnica." },
      { q: "Que metodologia ofrece una guia estructurada para test de aplicaciones web?", o: ["ITIL", "ISO 9001", "OWASP Testing Guide / WSTG"], c: 2, e: "La OWASP Web Security Testing Guide estandariza las pruebas de seguridad web por categorias." },
    ],
    a: [
      { q: "Al puntuar una vulnerabilidad con CVSS, que grupo de metricas refleja factores que cambian con el tiempo (exploit disponible, parche)?", o: ["Environmental", "Base", "Temporal"], c: 2, e: "Las metricas Temporales ajustan el score segun madurez del exploit, remediacion y confianza del reporte." },
      { q: "En un engagement, cual es la diferencia entre un Red Team y un pentest tradicional?", o: ["No hay diferencia", "El pentest siempre dura mas que el Red Team", "El Red Team simula un adversario real con objetivos especificos y sigilo, evaluando deteccion/respuesta (Blue Team)"], c: 2, e: "El Red Team mide la capacidad de deteccion y respuesta emulando TTPs reales y manteniendo OPSEC; el pentest busca amplitud de hallazgos." },
      { q: "Que documento legal debe firmarse SIEMPRE antes de iniciar un pentest autorizado?", o: ["Una Rules of Engagement / autorizacion escrita (scope, ventanas, contactos)", "Un NDA solamente", "El reporte final"], c: 0, e: "El ROE/autorizacion define alcance, limites legales y autoriza explicitamente la actividad, protegiendo a ambas partes." },
      { q: "Que framework cataloga las tacticas y tecnicas de adversarios para mapear deteccion y reporting?", o: ["PCI-DSS", "NIST 800-53", "MITRE ATT&CK"], c: 2, e: "MITRE ATT&CK es la matriz de tacticas/tecnicas usada para mapear comportamientos de atacantes y coberturas defensivas." },
    ],
  },
  55: {
    i: [
      { q: "En Python, que palabra clave define una funcion asincrona usada con asyncio?", o: ["async def", "lambda", "yield"], c: 0, e: "async def declara una corrutina; await suspende su ejecucion hasta que el awaitable termine." },
      { q: "Para que sirve el modulo ctypes en un script de seguridad?", o: ["Para llamar funciones de librerias compartidas C (DLL/.so) directamente desde Python", "Para crear hilos", "Para parsear JSON"], c: 0, e: "ctypes permite invocar APIs nativas (ej. kernel32, libc) y manipular estructuras C desde Python." },
      { q: "Que es Frida en el contexto de instrumentacion dinamica?", o: ["Un fuzzer de red", "Un desensamblador estatico", "Un toolkit de inyeccion que hookea funciones en procesos en ejecucion via JavaScript"], c: 2, e: "Frida inyecta un agente JS para hookear, interceptar y modificar funciones de un proceso vivo en runtime." },
      { q: "Por que asyncio es ventajoso para un escaner de red con miles de conexiones?", o: ["Permite I/O concurrente no bloqueante en un solo hilo (event loop)", "Usa un thread por conexion", "Compila el codigo a C"], c: 0, e: "El event loop maneja miles de sockets concurrentes sin el overhead de hilos/procesos, ideal para I/O-bound." },
    ],
    a: [
      { q: "En Frida, que API se usa para interceptar la entrada y salida de una funcion nativa?", o: ["Process.enumerateModules", "Memory.scan", "Interceptor.attach con onEnter/onLeave"], c: 2, e: "Interceptor.attach instala callbacks onEnter (args) y onLeave (retval) sobre la direccion de la funcion." },
      { q: "Al usar ctypes para llamar una funcion C que recibe un buffer, que debes configurar para evitar truncamiento/crashes?", o: ["Compilar con -O2", "Los atributos argtypes y restype para definir tipos correctos del prototipo", "Nada, ctypes lo infiere"], c: 1, e: "Definir argtypes/restype asegura el marshalling correcto de punteros y enteros, evitando corrupcion de stack o resultados erroneos." },
      { q: "Cual es un riesgo de seguridad clasico al deserializar datos con pickle en Python?", o: ["Solo consume mucha memoria", "Permite ejecucion de codigo arbitrario via __reduce__ en datos no confiables", "Pierde precision en floats"], c: 1, e: "pickle.loads sobre datos controlados por el atacante ejecuta codigo arbitrario mediante el metodo __reduce__." },
      { q: "Por que un escaner async-heavy puede agotar file descriptors y como se mitiga?", o: ["Por usar muchos sockets simultaneos; se limita con un asyncio.Semaphore", "Por el GIL; se usa multiprocessing", "Por usar listas en vez de tuplas"], c: 0, e: "Sin limitar la concurrencia se abren mas FDs que el ulimit; un Semaphore acota el numero de tareas/sockets en vuelo." },
    ],
  },
  56: {
    i: [
      { q: "En Go, que primitiva ligera permite ejecutar funciones de forma concurrente?", o: ["fork", "goroutine", "thread"], c: 1, e: "Una goroutine es un hilo ligero gestionado por el runtime de Go, barato de crear (miles a la vez)." },
      { q: "Que mecanismo idiomatico usa Go para comunicar goroutines de forma segura?", o: ["channels", "mutexes obligatorios", "Variables globales"], c: 0, e: "Los channels permiten pasar datos entre goroutines siguiendo 'no compartas memoria, comunica'." },
      { q: "Por que Go es popular para tooling ofensivo multiplataforma?", o: ["Por su tipado dinamico", "Por su cross-compilation a binarios estaticos sin dependencias", "Porque se interpreta en runtime"], c: 1, e: "GOOS/GOARCH permiten compilar binarios estaticos autocontenidos para Windows/Linux/macOS desde una sola maquina." },
      { q: "Que variables de entorno controlan el target de cross-compile en Go?", o: ["CC y CFLAGS", "PATH y HOME", "GOOS y GOARCH"], c: 2, e: "GOOS define el SO destino y GOARCH la arquitectura (ej. GOOS=windows GOARCH=amd64)." },
    ],
    a: [
      { q: "Cual es un problema de seguridad/concurrencia que el race detector de Go ayuda a encontrar?", o: ["Accesos concurrentes no sincronizados a la misma variable (data races)", "Errores de tipado", "Memory leaks por GC"], c: 0, e: "go run -race instrumenta el binario para detectar lecturas/escrituras concurrentes sin sincronizacion." },
      { q: "Por que los binarios Go suelen ser detectados por AV pese a compilar estaticos?", o: ["Porque usan reflexion", "Por firmas conocidas del runtime/strings del compilador y patrones de la stdlib", "Porque siempre incluyen un debugger"], c: 1, e: "El runtime, simbolos y strings caracteristicos de Go generan firmas; por eso se usan strip, ofuscadores (garble) y packers." },
      { q: "Que patron permite cancelar de forma propagada un arbol de goroutines (ej. timeouts en un scanner)?", o: ["panic/recover", "runtime.GC()", "context.Context con cancel"], c: 2, e: "context propaga cancelacion y deadlines; al cancelar el parent, las goroutines hijas reciben la senal via ctx.Done()." },
      { q: "En tooling ofensivo con CGo, que efecto tiene habilitar CGO_ENABLED=1?", o: ["Acelera el GC", "Genera binarios mas pequenos", "Introduce dependencia del libc dinamico, rompiendo la portabilidad estatica"], c: 2, e: "CGo enlaza contra libc del sistema, perdiendo el binario estatico; se suele dejar CGO_ENABLED=0 para portabilidad." },
    ],
  },
  57: {
    i: [
      { q: "En Metasploit, que clase base hereda tipicamente un modulo exploit en Ruby?", o: ["Msf::Auxiliary", "Msf::Exploit::Remote", "Msf::Post"], c: 1, e: "Los exploits remotos heredan de Msf::Exploit::Remote e incluyen mixins segun el protocolo." },
      { q: "Que es un mixin en el desarrollo de modulos Metasploit?", o: ["Un modulo Ruby que aporta funcionalidad reutilizable (ej. Tcp, HttpClient) via include", "Un encoder", "Un payload cifrado"], c: 0, e: "Los mixins (modulos Ruby con include) anaden metodos comunes como conexion TCP o cliente HTTP al modulo." },
      { q: "Donde se definen las opciones configurables (RHOSTS, RPORT) de un modulo Metasploit?", o: ["En el archivo de payload", "En el metodo exploit", "En register_options dentro de initialize"], c: 2, e: "register_options en initialize declara los OptString/OptPort que el usuario configura con set." },
      { q: "Que tipo de modulo Metasploit se usa para escaneo o fuzzing sin necesariamente lograr una shell?", o: ["payload", "exploit", "auxiliary"], c: 2, e: "Los modulos auxiliary realizan scanning, fuzzing, DoS o brute-force sin entregar un payload de ejecucion." },
    ],
    a: [
      { q: "En Ruby, que permite el 'monkey patching' relevante para Metasploit?", o: ["Forzar tipado estatico", "Reabrir clases existentes para modificar/anadir metodos en runtime", "Compilar a bytecode nativo"], c: 1, e: "Ruby permite reabrir cualquier clase y redefinir metodos en tiempo de ejecucion, util para extender la framework." },
      { q: "Al escribir un exploit con ROP en Metasploit, donde se suelen almacenar offsets/gadgets por version del target?", o: ["En la variable global $stdout", "En el datastore RHOSTS", "En el bloque 'Targets' del modulo con ret addresses por version"], c: 2, e: "El array Targets define entradas por version/SO con sus offsets, badchars y direcciones, seleccionables por el usuario." },
      { q: "Que metodo de un mixin se usa para detectar si un objetivo es vulnerable antes de explotarlo?", o: ["run", "check", "cleanup"], c: 1, e: "El metodo check devuelve un CheckCode (Vulnerable, Safe, Detected) sin lanzar el exploit completo." },
      { q: "Por que el diseno de mixins en Ruby (modulos con metodos de instancia) facilita la composicion en Metasploit frente a herencia simple?", o: ["Permite incorporar multiples comportamientos (HTTP, TCP, Brute) sin herencia multiple de clases", "Porque elimina el GIL", "Porque Ruby no soporta clases"], c: 0, e: "Ruby no tiene herencia multiple de clases, pero los mixins (include de modulos) permiten componer varias capacidades en un solo modulo." },
    ],
  },
  58: {
    i: [
      { q: "Que tecnica de ataque enmascara una pagina legitima dentro de un iframe transparente para enganar clics?", o: ["CSRF", "XSS reflejado", "Clickjacking"], c: 2, e: "El clickjacking superpone un iframe invisible para que la victima haga clic en acciones que no ve." },
      { q: "Que header HTTP mitiga el clickjacking impidiendo el embebido en iframes?", o: ["Content-Security-Policy con frame-ancestors", "Cache-Control", "X-Powered-By"], c: 0, e: "CSP frame-ancestors (y el legacy X-Frame-Options) controlan que origenes pueden embeber la pagina." },
      { q: "Para insertar contenido HTML de usuario de forma segura en el DOM, que API se prefiere?", o: ["element.textContent", "element.innerHTML", "document.write"], c: 0, e: "textContent escapa el contenido y no interpreta HTML, evitando inyeccion; innerHTML es peligroso con datos no confiables." },
      { q: "Que libreria es estandar para sanitizar HTML del lado cliente y prevenir XSS?", o: ["DOMPurify", "Axios", "jQuery"], c: 0, e: "DOMPurify limpia HTML/SVG/MathML eliminando vectores XSS antes de insertarlo en el DOM." },
    ],
    a: [
      { q: "Que caracteriza al DOM-based XSS frente al reflejado/almacenado?", o: ["Solo afecta a APIs REST", "El payload nunca llega al servidor; se ejecuta por manipulacion del DOM en el cliente (ej. location.hash a innerHTML)", "Requiere siempre cookies de sesion"], c: 1, e: "En DOM XSS el sink peligroso (innerHTML, eval) procesa una source del cliente (location, document.referrer) sin pasar por el servidor." },
      { q: "Por que una CSP con 'unsafe-inline' o nonces mal gestionados puede ser bypasseada?", o: ["Porque CSP solo aplica a imagenes", "Porque CSP desactiva CORS", "unsafe-inline anula la proteccion contra scripts inline; nonces reusados/predecibles permiten inyeccion"], c: 2, e: "unsafe-inline permite cualquier script inline, y un nonce predecible o reutilizado deja inyectar un <script> valido para la politica." },
      { q: "Que es una 'mutation XSS' (mXSS)?", o: ["Un XSS que muta el codigo fuente del servidor", "Un XSS via cookies", "Markup aparentemente seguro que el parser del navegador re-serializa transformandolo en HTML ejecutable"], c: 2, e: "El sanitizado se evalua antes de que el navegador normalice/mute el DOM, produciendo HTML peligroso tras la reparsing." },
      { q: "Como puede el atributo sandbox de un iframe contribuir a un escape si esta mal configurado?", o: ["sandbox cifra el contenido del iframe", "sandbox siempre bloquea todo JS", "sandbox='allow-scripts allow-same-origin' juntos anulan el aislamiento permitiendo modificar el parent"], c: 2, e: "Combinar allow-scripts y allow-same-origin permite al iframe acceder a su mismo origen y remover el propio sandbox, rompiendo el aislamiento." },
    ],
  },
  59: {
    i: [
      { q: "En glibc malloc, que cache por-thread sirve chunks pequenos rapidamente sin bloqueo?", o: ["fastbin", "tcache", "unsorted bin"], c: 1, e: "El tcache (thread-local cache, glibc >=2.26) almacena chunks recientes por tamano para reuso rapido sin locking." },
      { q: "Que es un use-after-free?", o: ["Escribir mas alla del buffer", "Usar un puntero a memoria ya liberada (dangling pointer)", "Liberar dos veces el mismo chunk"], c: 1, e: "Un UAF accede a memoria ya free; si el atacante la realoja con datos controlados, puede secuestrar el flujo." },
      { q: "Que metadato de un chunk de glibc indica si el chunk previo esta en uso?", o: ["El campo fd", "El bit PREV_INUSE en el campo size", "El campo bk"], c: 1, e: "El bit menos significativo de size (PREV_INUSE) marca si el chunk anterior esta asignado, base de la consolidacion." },
      { q: "Que protege el chequeo 'double free' de fastbins en glibc?", o: ["Que no haya integer overflow", "Que el chunk en el tope de la fastbin no se libere dos veces consecutivas", "Que el heap no crezca"], c: 1, e: "glibc verifica que el chunk liberado no sea ya la cabeza de la fastbin correspondiente, mitigando double-free triviales." },
    ],
    a: [
      { q: "En que consiste el ataque 'tcache poisoning'?", o: ["Forzar el uso de mmap", "Sobrescribir el puntero fd de un chunk en tcache para que malloc devuelva una direccion arbitraria", "Llenar todas las fastbins"], c: 1, e: "Corrompiendo el fd de un chunk libre en tcache, el siguiente malloc del mismo tamano retorna un puntero controlado (write-what-where)." },
      { q: "Que introdujo glibc 2.32+ para mitigar tcache/fastbin poisoning?", o: ["Safe-linking: XOR del puntero fd con (direccion >> 12)", "ASLR de 64 bits", "Stack canaries"], c: 0, e: "Safe-linking ofusca los punteros fd de las freelists usando un valor derivado de la posicion, dificultando overwrites predecibles." },
      { q: "El 'House of Force' explota que primitiva clasica del heap?", o: ["Liberar el top chunk", "Sobrescribir el size del top chunk (wilderness) con un valor enorme para que malsize cubra direcciones arbitrarias", "Corromper el tcache count"], c: 1, e: "Al falsear el tamano del top chunk a -1, un malloc gigante mueve el top a una direccion elegida, dando write primitive (mitigado en glibc moderno)." },
      { q: "En un ataque 'unsorted bin', escribir en main_arena via un chunk liberado permite tipicamente?", o: ["Deshabilitar ASLR del kernel", "Filtrar una direccion de libc (leak) porque fd/bk apuntan a main_arena", "Ejecutar shellcode en el stack"], c: 1, e: "Un chunk en el unsorted bin tiene fd/bk apuntando a main_arena (dentro de libc); leer ese puntero filtra la base de libc." },
    ],
  },
  60: {
    i: [
      { q: "Que mitigacion del kernel Linux impide que la CPU ejecute codigo en paginas de userland desde modo supervisor?", o: ["SMAP", "SMEP", "KASLR"], c: 1, e: "SMEP (Supervisor Mode Execution Prevention) bloquea la ejecucion de paginas de usuario mientras el CPU esta en ring 0." },
      { q: "Para que sirve SMAP en el kernel?", o: ["Cifrar la memoria del kernel", "Aleatorizar la pila del kernel", "Impedir que el kernel acceda (lea/escriba) datos de userland inadvertidamente"], c: 2, e: "SMAP (Supervisor Mode Access Prevention) bloquea accesos a memoria de usuario desde el kernel salvo uso explicito de stac/clac." },
      { q: "Que es una syscall desde la perspectiva de un exploit de kernel?", o: ["Un registro de la CPU", "Una funcion de libc en userland", "La interfaz controlada para pasar de userland a kernelland"], c: 2, e: "Las syscalls son el punto de entrada user->kernel; muchos bugs de kernel se alcanzan a traves de ellas (ioctl, etc.)." },
      { q: "Que tecnica busca el atacante al lograr ejecucion en kernel para escalar privilegios en Linux?", o: ["Borrar /etc/shadow", "Modificar el struct cred del proceso (uid=0) o llamar commit_creds(prepare_kernel_cred(0))", "Reiniciar el sistema"], c: 1, e: "El objetivo clasico es elevar el proceso a root manipulando sus credenciales en el kernel." },
    ],
    a: [
      { q: "Como se suele bypassear SMEP en un exploit de kernel moderno?", o: ["Con ROP en el kernel para limpiar el bit de SMEP en CR4 o ejecutar gadgets en texto del kernel", "Desactivando ASLR", "Inyectando shellcode en el stack de usuario"], c: 0, e: "Sin poder ejecutar userland, se usa ROP/ret2dir sobre codigo del kernel o se sobrescribe CR4 para apagar SMEP." },
      { q: "Que es KPTI (Kernel Page-Table Isolation) y que vulnerabilidad mitiga principalmente?", o: ["Evitar double-free en slab", "Cifrar syscalls", "Aislar las tablas de paginas de kernel/usuario, mitigando Meltdown"], c: 2, e: "KPTI separa los page tables de kernel y usuario para que la microarquitectura no filtre memoria de kernel (Meltdown)." },
      { q: "En Windows, que tecnica de exploit de kernel abusa de tokens para SYSTEM?", o: ["Modificar el bootloader", "Deshabilitar PatchGuard via API", "Token stealing: copiar el token del proceso System (PID 4) al proceso del atacante"], c: 2, e: "Se localiza el EPROCESS de System y se copia su Token al EPROCESS del proceso controlado, heredando privilegios SYSTEM." },
      { q: "Que es un ataque de tipo 'use-after-free en el slab/SLUB allocator' del kernel y por que cross-cache?", o: ["Reasignar el objeto liberado con uno controlado del mismo cache (o cruzando caches) para corromper estructuras", "Un overflow del stack guard del kernel", "Una fuga del PRNG del kernel"], c: 0, e: "Tras un UAF se reocupa el slot con un objeto controlable (heap spray); cross-cache reutiliza paginas entre kmem_caches para reclamar objetos de distinto tipo." },
    ],
  },
  61: {
    i: [
      { q: "En exploits de navegador, que componente JIT compila JavaScript caliente a codigo nativo?", o: ["El parser HTML", "El motor JIT (ej. TurboFan en V8)", "El garbage collector"], c: 1, e: "Los motores JIT (TurboFan/V8, JIT de JSC/SpiderMonkey) compilan funciones hot a maquina, superficie clave de bugs." },
      { q: "Que es una 'type confusion' en un motor JS?", o: ["El motor trata un objeto como un tipo distinto del real, permitiendo accesos invalidos", "Un error de sintaxis", "Confundir dos cadenas de texto"], c: 0, e: "Cuando el motor asume un tipo incorrecto para un objeto, se pueden leer/escribir campos fuera de su layout real." },
      { q: "Que es el 'sandbox' del renderer en un navegador?", o: ["Un cache de imagenes", "Un firewall de red", "Un proceso aislado con privilegios minimos donde corre el contenido web no confiable"], c: 2, e: "El renderer corre en un proceso sandboxeado; un atacante necesita un segundo bug para escapar al proceso broker." },
      { q: "Por que los exploits de browser modernos suelen encadenar dos vulnerabilidades?", o: ["Una para RCE en el renderer y otra para escapar del sandbox", "Para evadir el antivirus dos veces", "Porque JS no permite una sola"], c: 0, e: "Tipicamente se requiere RCE en el renderer + un sandbox escape (bug del kernel/broker) para comprometer el host." },
    ],
    a: [
      { q: "Que primitiva se construye tipicamente al explotar un OOB en un ArrayBuffer/TypedArray para lograr RCE?", o: ["Un timer de alta resolucion", "addrof + fakeobj que dan read/write arbitrario en el espacio del motor", "Un canario de pila"], c: 1, e: "addrof (leak de direccion de un objeto) y fakeobj (forjar un objeto en una direccion) construyen lectura/escritura arbitraria." },
      { q: "Como abusa un atacante de las 'JIT optimization assumptions' (ej. CheckBounds eliminado)?", o: ["Recompila el navegador", "Hace que el optimizador asuma un invariante que luego se viola, eliminando un bounds check y produciendo OOB", "Desactiva el GC"], c: 1, e: "Si el JIT elimina un chequeo basado en una suposicion (tipo/longitud) que el atacante luego invalida, queda un acceso fuera de limites." },
      { q: "Que es 'JIT spraying' y que mitigacion lo contrarresta?", o: ["Inyectar HTML; mitigado por CSP", "Llenar el heap; mitigado por ASLR", "Forzar al JIT a emitir constantes controladas como gadgets ejecutables; mitigado por constant blinding"], c: 2, e: "JIT spraying embebe valores que decodifican a instrucciones utiles; constant blinding ofusca las constantes inmediatas emitidas." },
      { q: "En V8, que mitigacion aisla los punteros del heap del motor para dificultar la corrupcion de memoria?", o: ["Pointer compression con sandbox (V8 Sandbox/heap cage)", "Fortify source", "Stack canaries"], c: 0, e: "El V8 Sandbox (heap cage) confina los objetos a una region y usa offsets, de modo que una corrupcion no produzca punteros nativos arbitrarios." },
    ],
  },
  62: {
    i: [
      { q: "Que mitigacion marca la pila/heap como no ejecutables para impedir shellcode directo?", o: ["Stack canary", "ASLR", "DEP/NX"], c: 2, e: "DEP (NX) marca regiones de datos como no ejecutables, forzando tecnicas como ROP en lugar de inyectar shellcode." },
      { q: "Que es un 'gadget' en ROP?", o: ["Un registro de la CPU", "Una corta secuencia de instrucciones que termina en ret, encadenable", "Una funcion completa del binario"], c: 1, e: "Los gadgets son secuencias (ej. pop rdi; ret) que, encadenadas via la pila, realizan computacion arbitraria." },
      { q: "Como ayuda ASLR a la defensa?", o: ["Bloquea syscalls", "Cifra el codigo", "Aleatoriza las direcciones base de modulos/stack/heap dificultando hardcodear gadgets"], c: 2, e: "ASLR aleatoriza el layout de memoria; sin un leak, el atacante no conoce las direcciones de sus gadgets." },
      { q: "En que se diferencia JOP de ROP?", o: ["JOP no usa la pila nunca para nada", "JOP solo funciona en x86 de 16 bits", "JOP usa secuencias que terminan en jmp/call (dispatcher gadget) en vez de ret"], c: 2, e: "Jump-Oriented Programming encadena gadgets via saltos indirectos y un dispatcher, evadiendo defensas centradas en ret." },
    ],
    a: [
      { q: "Que tecnica permite construir una cadena ROP sin conocer direcciones absolutas cuando hay ASLR pero se controla un leak de libc?", o: ["ret2libc/ret2plt calculando gadgets como offsets respecto a la base filtrada de libc", "Brute force de canarios", "Desactivar NX con mprotect a ciegas"], c: 0, e: "Con la base de libc filtrada, todos los gadgets y funciones (system, mprotect) se calculan como base+offset, derrotando ASLR." },
      { q: "Que protege CFI (Control-Flow Integrity) y como lo bypassean los atacantes?", o: ["Aleatoriza syscalls; se bypassea con sleep", "Cifra la pila; se bypassea con XOR", "Restringe destinos de saltos/llamadas indirectas; se bypassea con gadgets de destino valido (COOP) o data-only attacks"], c: 2, e: "CFI valida que los control transfers indirectos vayan a destinos legitimos; los ataques usan call sites validos (Counterfeit OOP) o corrupcion de datos sin desviar el flujo." },
      { q: "Que es Intel CET y como neutraliza ROP clasico?", o: ["Una shadow stack que valida las direcciones de retorno + IBT para llamadas indirectas", "Un ASLR de 128 bits", "Un cifrado de gadgets"], c: 0, e: "Control-flow Enforcement Technology mantiene una shadow stack protegida; un ret cuya direccion no coincide aborta, rompiendo cadenas ROP." },
      { q: "Que es un ataque 'data-only' (ej. Data-Oriented Programming) y por que evade CFI?", o: ["Corrompe variables/estructuras de datos para alterar la logica sin desviar el control-flow legitimo", "Reescribe la GOT con ret gadgets", "Inyecta shellcode en el stack"], c: 0, e: "DOP manipula datos (flags, punteros de datos) para lograr computacion maliciosa siguiendo flujos de control validos, invisibles para CFI." },
    ],
  },
  63: {
    i: [
      { q: "Que vulnerabilidad explota un 'padding oracle attack' en CBC?", o: ["Un IV reutilizado", "Una clave debil", "Que el sistema revela si el padding descifrado es valido o no"], c: 2, e: "Si el servidor distingue padding valido/invalido, el atacante descifra el texto byte a byte sin conocer la clave." },
      { q: "Que tecnica clasica de criptoanalisis cuenta frecuencias de letras para romper cifrados de sustitucion?", o: ["Ataque de fuerza bruta del IV", "Analisis de frecuencias", "Ataque de cumpleanos"], c: 1, e: "El analisis de frecuencias compara la distribucion del cifrado con la del idioma para deducir la sustitucion." },
      { q: "Por que reutilizar un keystream en un cifrado de flujo (o nonce en CTR/GCM) es catastrofico?", o: ["Permite XOR de dos ciphertexts cancelando el keystream y filtrando los plaintexts", "Hace el cifrado mas lento", "Aumenta el tamano del ciphertext"], c: 0, e: "C1 XOR C2 = P1 XOR P2; con keystream reutilizado se recuperan los plaintexts y, en GCM, se compromete la autenticacion." },
      { q: "Que es un ataque de texto plano conocido (known-plaintext)?", o: ["El atacante conoce pares de plaintext/ciphertext para deducir la clave o estructura", "El atacante elige la clave", "El atacante solo ve ciphertext"], c: 0, e: "Disponer de pares conocidos facilita recuperar la clave o caracteristicas internas del cifrado." },
    ],
    a: [
      { q: "El criptoanalisis diferencial estudia que propiedad de un cifrado de bloque?", o: ["El tiempo de ejecucion de cada ronda", "La propagacion de diferencias de entrada hacia diferencias de salida con cierta probabilidad", "El consumo electrico del chip"], c: 1, e: "Analiza como diferencias controladas en plaintexts producen diferencias predecibles tras las rondas (caracteristicas diferenciales) para recuperar claves." },
      { q: "En que se basa el criptoanalisis lineal?", o: ["En aproximaciones lineales (XOR de bits de plaintext/ciphertext/clave) con sesgo respecto a 1/2", "En colisiones de hash", "En la factorizacion de n"], c: 0, e: "Construye aproximaciones lineales con probabilidad distinta de 1/2 (Piling-up lemma) para recuperar bits de clave con suficientes pares." },
      { q: "Por que el cifrado AES en modo CBC sin autenticacion es vulnerable a bit-flipping?", o: ["Porque AES es lineal", "Modificar un byte del ciphertext IV/bloque previo altera de forma controlada un byte del plaintext del bloque siguiente", "Porque el IV siempre es cero"], c: 1, e: "En CBC el plaintext = D(C_i) XOR C_{i-1}; alterar C_{i-1} provoca un XOR controlado en P_i, requiriendo MAC (encrypt-then-MAC) para integridad." },
      { q: "Que ataque combina padding oracle con manipulacion en CBC para falsificar/descifrar mensajes y motivo POODLE/Lucky13?", o: ["Birthday attack sobre SHA-256", "Padding oracle sobre SSLv3/TLS-CBC explotando el manejo o el timing del padding", "Side-channel de cache sobre RSA"], c: 1, e: "POODLE explota el padding no determinista de SSLv3-CBC y Lucky13 el timing del chequeo de padding/MAC, ambos derivados del padding oracle." },
    ],
  },
  64: {
    i: [
      { q: "Que algoritmo cuantico rompe RSA y ECC al factorizar/resolver logaritmos discretos en tiempo polinomico?", o: ["Algoritmo de Deutsch", "Algoritmo de Shor", "Algoritmo de Grover"], c: 1, e: "Shor factoriza enteros y resuelve el log discreto en tiempo polinomico, quebrando RSA, DH y ECC." },
      { q: "Que efecto tiene el algoritmo de Grover sobre la criptografia simetrica?", o: ["No la afecta en absoluto", "Reduce la seguridad efectiva a la mitad (busqueda en sqrt(N)), mitigable duplicando el tamano de clave", "La rompe totalmente"], c: 1, e: "Grover da un speedup cuadratico en busqueda; AES-128 baja a ~64 bits efectivos, por eso se recomienda AES-256." },
      { q: "Sobre que problema matematico se basan Kyber y Dilithium?", o: ["Logaritmo discreto eliptico", "Factorizacion de enteros", "Problemas sobre retículos (lattices), como Module-LWE"], c: 2, e: "Kyber (KEM) y Dilithium (firmas) se basan en la dureza de problemas de lattices (LWE/Module-LWE), resistentes a Shor." },
      { q: "Que estandarizo el NIST como esquema principal de encapsulado de claves post-cuantico?", o: ["ML-KEM (Kyber)", "RSA-4096", "SHA-3"], c: 0, e: "ML-KEM (FIPS 203), basado en Kyber, es el KEM estandarizado por NIST para intercambio de claves post-cuantico." },
    ],
    a: [
      { q: "En el problema LWE (Learning With Errors), que aporta la seguridad?", o: ["La dificultad de resolver sistemas lineales perturbados con un pequeno error/ruido", "La colision en funciones hash", "La factorizacion de semiprimos grandes"], c: 0, e: "Recuperar el secreto de muestras (A, A*s + e) con ruido e es dificil; reducir a problemas de lattice (SVP/GapSVP) sustenta la seguridad." },
      { q: "Por que se promueve la criptografia 'harvest now, decrypt later' como amenaza presente?", o: ["Porque TLS 1.3 es inseguro", "Porque ya existen computadores cuanticos comerciales que rompen AES", "Porque un adversario almacena trafico cifrado hoy para descifrarlo cuando exista un CRQC"], c: 2, e: "Datos con larga vida util capturados hoy podrian descifrarse en el futuro con un Cryptographically Relevant Quantum Computer; de ahi la migracion temprana a PQC." },
      { q: "Que reto practico introduce Dilithium/Kyber frente a ECC en despliegues TLS?", o: ["Tamanos de clave/firma y de ciphertext mucho mayores, impactando ancho de banda y handshake", "Requieren hardware cuantico", "No tienen implementaciones"], c: 0, e: "Las claves, firmas y encapsulados de lattices son notablemente mas grandes que ECC, afectando MTU, certificados y rendimiento." },
      { q: "Que enfoque mitiga el riesgo de que un esquema PQC tenga un fallo no descubierto durante la transicion?", o: ["Usar solo el esquema PQC mas nuevo", "Volver a RSA-2048", "Esquemas hibridos que combinan un KEM clasico (ECDH) con uno PQC (Kyber)"], c: 2, e: "El hibrido deriva la clave de ambos; la sesion permanece segura mientras al menos uno de los dos resista el criptoanalisis." },
    ],
  },
  65: {
    i: [
      { q: "Que propiedad define a una prueba de conocimiento cero (zero-knowledge)?", o: ["Demuestra la veracidad de una afirmacion sin revelar informacion adicional mas alla de su validez", "Comparte la clave privada con el verificador", "Cifra el mensaje con la clave del verificador"], c: 0, e: "El verificador queda convencido de que la afirmacion es cierta sin aprender nada del testigo (witness)." },
      { q: "Cuales son las tres propiedades fundamentales de un sistema ZKP?", o: ["Velocidad, tamano y costo", "Hashing, firma y cifrado", "Completitud, solidez (soundness) y zero-knowledge"], c: 2, e: "Completeness (lo verdadero se prueba), soundness (lo falso no) y zero-knowledge (no revela el secreto)." },
      { q: "Que es el secret sharing de Shamir?", o: ["Dividir un secreto en n partes donde k de ellas lo reconstruyen (umbral k-de-n)", "Firmar con multiples claves", "Cifrar un secreto con AES"], c: 0, e: "Usa interpolacion polinomica: el secreto es el termino independiente; k puntos reconstruyen el polinomio de grado k-1." },
      { q: "Que diferencia notable hay entre zk-SNARKs y zk-STARKs respecto al setup?", o: ["Ninguno requiere setup", "Los SNARKs suelen requerir un trusted setup; los STARKs no (transparentes)", "Los STARKs requieren trusted setup y los SNARKs no"], c: 1, e: "Muchos SNARKs necesitan una ceremonia de trusted setup; los STARKs son transparentes y ademas post-cuanticos (hash-based)." },
    ],
    a: [
      { q: "En MPC (computacion multipartita segura), que garantiza un protocolo seguro frente a un adversario semihonesto?", o: ["Se requiere una autoridad central de confianza", "Las partes computan una funcion conjunta sin revelar sus entradas privadas, solo el resultado", "Una de las partes ve todas las entradas"], c: 1, e: "MPC permite calcular f(x1,..,xn) revelando solo la salida; en modelo semihonesto las partes siguen el protocolo pero intentan inferir de los mensajes." },
      { q: "Que tecnica fundamenta el protocolo de Yao para MPC de dos partes?", o: ["RSA con padding OAEP", "Diffie-Hellman sobre curvas", "Garbled circuits (circuitos cifrados) combinados con oblivious transfer"], c: 2, e: "Yao cifra un circuito booleano (garbled) y la otra parte obtiene sus etiquetas de entrada via oblivious transfer para evaluarlo sin aprender intermedios." },
      { q: "Por que los STARKs se consideran post-cuanticos y los SNARKs basados en pairings no?", o: ["STARKs se apoyan solo en hashes resistentes a cuantica; los pairings dependen del log discreto que Shor rompe", "Ambos son igualmente vulnerables", "STARKs usan RSA grande"], c: 0, e: "La seguridad de los STARKs deriva de funciones hash colision-resistentes; los SNARKs con pairings se basan en suposiciones de grupos rompibles por Shor." },
      { q: "Que rol cumple el protocolo Fiat-Shamir en los ZKP no interactivos?", o: ["Genera la clave privada del prover", "Cifra la salida del circuito", "Convierte una prueba interactiva en no interactiva reemplazando los retos del verificador por un hash"], c: 2, e: "El heuristico Fiat-Shamir deriva los desafios aplicando un hash a la transcripcion, eliminando la interaccion (en el modelo del oraculo aleatorio)." },
    ],
  },
  66: {
    i: [
      { q: "Que permite el cifrado totalmente homomorfico (FHE)?", o: ["Computar operaciones arbitrarias sobre datos cifrados sin descifrarlos", "Comprimir datos cifrados", "Firmar digitalmente sin clave"], c: 0, e: "FHE permite evaluar funciones (sumas y multiplicaciones arbitrarias) sobre ciphertexts, obteniendo el cifrado del resultado." },
      { q: "Que distingue al esquema CKKS de BFV/BGV?", o: ["CKKS opera sobre numeros reales/complejos aproximados; BFV/BGV sobre enteros exactos", "CKKS no usa lattices", "CKKS solo soporta sumas"], c: 0, e: "CKKS realiza aritmetica aproximada sobre reales (ideal para ML/estadistica); BFV/BGV son exactos sobre enteros modulares." },
      { q: "Que problema introduce el ruido en los esquemas FHE basados en lattices?", o: ["Crece con cada operacion y, si excede un umbral, impide descifrar correctamente", "Mejora la seguridad indefinidamente", "Hace los ciphertexts mas pequenos"], c: 0, e: "Cada operacion (sobre todo multiplicaciones) incrementa el ruido; superado el limite, el descifrado falla." },
      { q: "Que es 'leveled' FHE?", o: ["FHE que soporta un numero predeterminado de niveles de operaciones sin bootstrapping", "FHE sin ruido", "FHE que solo cifra una vez"], c: 0, e: "Leveled FHE evalua circuitos de profundidad acotada conocida de antemano, evitando el costoso bootstrapping." },
    ],
    a: [
      { q: "Que logra la operacion de bootstrapping en FHE?", o: ["Reducir el ruido de un ciphertext evaluando homomorficamente el propio circuito de descifrado", "Cambiar la clave publica", "Comprimir el ciphertext a la mitad"], c: 0, e: "Bootstrapping 're-cifra' homomorficamente descifrando bajo cifrado, reseteando el ruido y permitiendo computacion ilimitada (idea de Gentry)." },
      { q: "Por que la seguridad de BFV/CKKS se basa en RLWE en lugar de LWE plano?", o: ["RLWE es mas inseguro pero mas rapido", "RLWE (Ring-LWE) usa polinomios en anillos para mayor eficiencia y tamanos de clave menores manteniendo seguridad", "RLWE elimina el ruido por completo"], c: 1, e: "Ring-LWE trabaja sobre anillos de polinomios, permitiendo packing (SIMD batching) y operaciones eficientes con seguridad comparable." },
      { q: "Que es el 'batching/packing' en CKKS/BFV y que ventaja aporta?", o: ["Dividir un ciphertext en lotes para la red", "Reducir el numero de claves", "Cifrar muchos valores en un solo ciphertext y operar en paralelo estilo SIMD"], c: 2, e: "Usando el teorema chino del resto sobre el anillo, se empaquetan multiples slots por ciphertext y una sola operacion los procesa todos." },
      { q: "Por que CKKS requiere gestionar una escala (scaling factor) y reescalado tras multiplicaciones?", o: ["Porque cambia la clave en cada paso", "Porque codifica reales como enteros escalados y el producto duplica la escala, requiriendo rescale para no desbordar", "Porque el ruido desaparece"], c: 1, e: "CKKS cuantiza reales multiplicando por una escala; cada multiplicacion eleva la escala y consume ruido, por lo que se reescala (rescale) para mantener precision y modulo." },
    ],
  },
  67: {
    i: [
      { q: "En un ataque de evasion adversarial sobre un clasificador de imagenes, el objetivo del atacante es:", o: ["Robar el dataset de entrenamiento completo", "Perturbar minimamente la entrada en inferencia para forzar una clasificacion incorrecta", "Modificar los pesos del modelo durante el entrenamiento"], c: 1, e: "La evasion opera en tiempo de inferencia: se anade una perturbacion pequena (idealmente imperceptible) a la entrada para inducir un error." },
      { q: "FGSM (Fast Gradient Sign Method) genera la perturbacion adversarial usando:", o: ["El gradiente respecto a los pesos del modelo", "Mutacion aleatoria de pixeles por fuerza bruta", "El signo del gradiente de la perdida respecto a la entrada"], c: 2, e: "FGSM calcula epsilon * sign(grad_x J(theta,x,y)): un solo paso en la direccion del signo del gradiente respecto a la entrada." },
      { q: "Un ataque de poisoning se diferencia de uno de evasion en que:", o: ["Contamina los datos de entrenamiento para degradar o sesgar el modelo", "Requiere acceso fisico al servidor de inferencia", "Solo funciona contra redes convolucionales"], c: 0, e: "El poisoning ataca la fase de entrenamiento inyectando muestras maliciosas; la evasion ataca la inferencia." },
      { q: "Que tecnica de defensa entrena el modelo incluyendo ejemplos adversariales en el dataset?", o: ["Adversarial training", "Dropout", "Batch normalization"], c: 0, e: "El adversarial training genera ejemplos adversariales durante el entrenamiento y los incorpora para aumentar la robustez." },
    ],
    a: [
      { q: "PGD (Projected Gradient Descent) se considera un ataque mas fuerte que FGSM porque:", o: ["Usa menos memoria de GPU", "No requiere acceso a los gradientes", "Aplica multiples pasos iterativos con proyeccion a la bola de norma permitida"], c: 2, e: "PGD itera FGSM con pasos pequenos y proyecta cada iteracion de vuelta a la bola epsilon (L-inf normalmente), explorando mejor el espacio de perturbacion." },
      { q: "La defensa por gradient masking (ofuscacion de gradientes) es problematica porque:", o: ["Aumenta exponencialmente el coste de entrenamiento", "Da una falsa sensacion de robustez y se rompe con ataques de aproximacion como BPDA", "Solo funciona en modelos lineales"], c: 1, e: "El gradient masking no elimina los ejemplos adversariales reales; ataques como BPDA (Backward Pass Differentiable Approximation) estiman gradientes y la rompen." },
      { q: "El certified robustness mediante randomized smoothing ofrece:", o: ["Aceleracion de la inferencia sin coste de precision", "Una garantia probabilistica de que no existen perturbaciones adversariales dentro de un radio L2 dado", "Robustez total contra cualquier norma de perturbacion"], c: 1, e: "Randomized smoothing convierte un clasificador en uno suavizado con un certificado de robustez en radio L2 derivado de la distribucion gaussiana del ruido." },
      { q: "En el modelo de amenaza de Carlini-Wagner (C&W), la formulacion de la perturbacion:", o: ["Se basa unicamente en perturbaciones de norma L0 enteras", "Resuelve una optimizacion que minimiza la norma de la perturbacion sujeta a misclasificacion via una funcion objetivo diferenciable", "Maximiza la entropia de salida sin restriccion de norma"], c: 1, e: "C&W reformula el problema como una optimizacion (con la funcion f y un cambio de variable tanh) que minimiza la distancia mientras fuerza la misclasificacion, siendo muy efectivo." },
    ],
  },
  68: {
    i: [
      { q: "Un ataque de membership inference busca determinar:", o: ["El learning rate usado en el entrenamiento", "La arquitectura interna del modelo", "Si un registro especifico fue parte del dataset de entrenamiento del modelo"], c: 2, e: "Membership inference infiere si una muestra dada pertenecia al conjunto de entrenamiento, explotando diferencias de confianza entre miembros y no-miembros." },
      { q: "El model inversion attack tiene como objetivo:", o: ["Reconstruir caracteristicas o entradas representativas de las clases de entrenamiento", "Reducir el tamano del modelo", "Invertir el orden de las capas de la red"], c: 0, e: "El model inversion reconstruye datos representativos (p.ej. rostros) explotando la salida del modelo y conocimiento auxiliar." },
      { q: "La privacidad diferencial (differential privacy) garantiza que:", o: ["La presencia o ausencia de un solo individuo no cambia significativamente la salida del mecanismo", "El modelo nunca cometera errores de clasificacion", "Los datos quedan cifrados con AES en reposo"], c: 0, e: "DP acota cuanto puede cambiar la distribucion de salida al anadir o quitar un registro, mediante el parametro epsilon (presupuesto de privacidad)." },
      { q: "DP-SGD logra privacidad diferencial en entrenamiento mediante:", o: ["Eliminacion de outliers del dataset", "Cifrado homomorfico de los pesos", "Recorte de gradientes por muestra y adicion de ruido gaussiano"], c: 2, e: "DP-SGD acota la sensibilidad recortando la norma del gradiente por ejemplo y luego anade ruido gaussiano calibrado." },
    ],
    a: [
      { q: "En membership inference, los shadow models de Shokri et al. se usan para:", o: ["Entrenar un clasificador de ataque imitando el comportamiento del modelo objetivo con datos etiquetados como miembro/no-miembro", "Cifrar las predicciones del modelo objetivo", "Acelerar la inferencia del modelo objetivo"], c: 0, e: "Los shadow models replican el comportamiento del objetivo y generan datos de entrenamiento (vectores de confianza etiquetados) para el clasificador de ataque." },
      { q: "El parametro delta en la definicion (epsilon, delta)-DP representa:", o: ["La varianza del ruido laplaciano", "El numero de consultas permitidas al modelo", "La probabilidad de que la garantia de epsilon falle"], c: 2, e: "En (epsilon, delta)-DP, delta acota la probabilidad de que la garantia pura de epsilon se viole; idealmente delta es menor que 1/N." },
      { q: "El Renyi Differential Privacy (RDP) es util para el moments accountant porque:", o: ["Solo aplica a mecanismos laplacianos", "Permite una composicion mas ajustada del presupuesto de privacidad a traves de multiples pasos de SGD", "Elimina la necesidad de anadir ruido"], c: 1, e: "RDP/moments accountant rastrea los momentos de la perdida de privacidad, dando cotas de composicion mucho mas ajustadas que la composicion estandar para el ruido gaussiano repetido." },
      { q: "Los attribute inference attacks se distinguen de membership inference en que:", o: ["Requieren acceso a los pesos en texto claro", "Infieren valores de atributos sensibles ocultos de un registro a partir de atributos conocidos y la salida del modelo", "Solo funcionan sobre modelos de regresion lineal"], c: 1, e: "Attribute inference deduce el valor de una caracteristica sensible (no la membresia) combinando atributos conocidos con las correlaciones que el modelo aprendio." },
    ],
  },
  69: {
    i: [
      { q: "La prompt injection directa consiste en:", o: ["Saturar la API con peticiones", "Modificar los pesos del LLM", "Inyectar instrucciones en la entrada del usuario para sobrescribir las instrucciones del sistema"], c: 2, e: "En la inyeccion directa el atacante introduce instrucciones en su propio prompt que el modelo confunde con el system prompt legitimo." },
      { q: "Que caracteriza a una prompt injection INDIRECTA?", o: ["El payload malicioso esta embebido en datos externos que el LLM consume (web, documentos, RAG)", "Requiere acceso fisico al data center", "Solo afecta a modelos open-source"], c: 0, e: "La injection indirecta esconde instrucciones en contenido externo (paginas, correos, documentos) que el LLM procesa, sin que el usuario las escriba." },
      { q: "El RAG poisoning ataca:", o: ["La base de conocimiento/vector store del que el LLM recupera contexto", "El tokenizador del modelo", "El balanceador de carga"], c: 0, e: "El RAG poisoning inyecta documentos maliciosos en el corpus recuperable para que el LLM los use como contexto y produzca salidas controladas por el atacante." },
      { q: "Segun el OWASP Top 10 para LLM, LLM01 corresponde a:", o: ["Model Denial of Service", "Insecure Output Handling", "Prompt Injection"], c: 2, e: "Prompt Injection es la categoria LLM01, la primera y de mayor prominencia en el OWASP Top 10 para aplicaciones LLM." },
    ],
    a: [
      { q: "Por que las defensas basadas solo en filtrado de prompts son insuficientes contra jailbreaks?", o: ["Porque los LLM no procesan texto", "Porque el espacio de paraphrasing, encoding y role-play es practicamente infinito y los filtros estaticos son evadibles", "Porque los filtros aumentan la latencia a niveles inaceptables"], c: 1, e: "Los jailbreaks se reformulan infinitamente (Base64, leetspeak, DAN, payload splitting, low-resource languages), de modo que un blocklist estatico siempre es evadible." },
      { q: "La tecnica de jailbreak conocida como many-shot jailbreaking explota:", o: ["La temperatura del muestreo fijada en cero", "Un overflow en el buffer del tokenizador", "La ventana de contexto larga llenandola con muchos ejemplos de dialogos donde el asistente cumple peticiones daninas"], c: 2, e: "Many-shot jailbreaking (Anthropic) aprovecha ventanas de contexto grandes inyectando docenas/cientos de ejemplos falsos de comportamiento no alineado para sesgar la respuesta." },
      { q: "Un patron robusto de mitigacion para prompt injection en sistemas con herramientas es:", o: ["Aplicar principio de minimo privilegio en las herramientas, sandboxing de salidas y human-in-the-loop para acciones sensibles", "Aumentar el tamano del system prompt indefinidamente", "Confiar en que el modelo distinga datos de instrucciones por si solo"], c: 0, e: "Como el modelo no separa de forma fiable datos de instrucciones, la defensa real es de arquitectura: privilegios minimos, validacion de outputs y aprobacion humana para acciones de alto riesgo." },
      { q: "El ataque de adversarial suffix (Zou et al., GCG) genera jailbreaks mediante:", o: ["Ingenieria social al operador humano", "Optimizacion basada en gradientes sobre tokens para hallar un sufijo que maximiza la probabilidad de una respuesta afirmativa danina", "Fuerza bruta sobre la API key"], c: 1, e: "Greedy Coordinate Gradient (GCG) optimiza un sufijo de tokens usando gradientes para inducir una respuesta afirmativa, y esos sufijos suelen transferir entre modelos." },
    ],
  },
  70: {
    i: [
      { q: "Por que deserializar un modelo en formato pickle de fuente no confiable es peligroso?", o: ["Pickle requiere privilegios de root para cargarse", "Pickle corrompe siempre los pesos del modelo", "Pickle puede ejecutar codigo arbitrario via __reduce__ durante la deserializacion"], c: 2, e: "El protocolo pickle invoca __reduce__/__setstate__, permitiendo ejecucion de codigo arbitrario al hacer load() de un objeto malicioso." },
      { q: "El model provenance se refiere a:", o: ["La velocidad de inferencia del modelo", "El registro verificable del origen, datos, autoria y transformaciones de un modelo", "El formato de serializacion usado"], c: 1, e: "Provenance documenta la cadena de custodia del modelo: dataset, codigo, autor, hashes y firmas, para auditar su integridad." },
      { q: "Una mitigacion al riesgo de pickle en distribucion de modelos es:", o: ["Usar formatos seguros como safetensors que solo contienen tensores sin codigo ejecutable", "Renombrar la extension del archivo", "Comprimir el archivo con gzip"], c: 0, e: "safetensors almacena solo datos de tensores (sin codigo), eliminando la superficie de ejecucion arbitraria del pickle." },
      { q: "Un model registry comprometido permite a un atacante:", o: ["Acelerar el entrenamiento distribuido", "Distribuir modelos troyanizados a multiples consumidores aguas abajo", "Reducir la latencia de la red"], c: 1, e: "Si el registry no verifica firmas/integridad, un modelo backdoored se propaga a todos los pipelines que lo consumen (ataque de supply chain)." },
    ],
    a: [
      { q: "Que mecanismo permite verificar integridad y autoria de artefactos ML de forma criptografica en el pipeline?", o: ["Checksums MD5 publicados en el README", "Ofuscacion del nombre del modelo", "Firmas con Sigstore/cosign y attestations SLSA sobre los artefactos del modelo"], c: 2, e: "Sigstore/cosign firman artefactos y, junto a attestations SLSA y procedencia in-toto, dan integridad y trazabilidad verificable de la supply chain." },
      { q: "Un backdoor (trojan) en un modelo se caracteriza por:", o: ["Comportamiento normal salvo cuando la entrada contiene un trigger especifico, que activa la salida controlada", "Aumentar el tamano del archivo del modelo notablemente", "Degradar todas las predicciones por igual"], c: 0, e: "Un model backdoor mantiene alta exactitud en datos limpios pero produce una salida elegida cuando aparece el trigger (patron) del atacante." },
      { q: "Herramientas como fickling o picklescan ayudan a:", o: ["Reentrenar modelos automaticamente", "Comprimir tensores sin perdida", "Analizar estaticamente bytecode pickle para detectar opcodes/imports peligrosos antes de cargar"], c: 2, e: "fickling/picklescan desensamblan el pickle e identifican opcodes como REDUCE/GLOBAL y modulos sospechosos (os, subprocess) antes de la deserializacion." },
      { q: "El marco SLSA aplicado a ML mitiga ataques de supply chain principalmente al:", o: ["Cifrar los pesos en reposo", "Garantizar build provenance verificable, builds hermeticos y no falsificables del artefacto", "Acelerar la convergencia del entrenamiento"], c: 1, e: "SLSA define niveles de garantia sobre la integridad del proceso de build (procedencia firmada, builds hermeticos), dificultando la inyeccion de artefactos manipulados." },
    ],
  },
  71: {
    i: [
      { q: "Meltdown explota fundamentalmente:", o: ["Una colision de hash en TLB", "Un desbordamiento de pila clasico", "La ejecucion fuera de orden que accede a memoria de kernel antes de que se aplique la verificacion de permisos"], c: 2, e: "Meltdown aprovecha que la ejecucion fuera de orden lee memoria privilegiada y deja rastro en cache antes de que la excepcion de permisos se materialice." },
      { q: "Un ataque de cache timing tipo Flush+Reload mide:", o: ["La temperatura del nucleo", "El tiempo de acceso a una linea de cache para inferir si la victima la accedio", "La frecuencia del reloj de la CPU"], c: 1, e: "Flush+Reload purga una linea compartida, deja que la victima ejecute y luego mide el tiempo de recarga: rapido = la victima la cacheo." },
      { q: "Spectre se diferencia de Meltdown en que:", o: ["Spectre requiere acceso fisico", "Spectre solo afecta a CPUs AMD", "Spectre explota la prediccion/ejecucion especulativa de saltos engatusando a la victima a especular instrucciones"], c: 2, e: "Spectre induce a la CPU a especular ramas (branch prediction) ejecutando codigo que filtra datos via canales laterales, sin necesitar el fallo de permisos de Meltdown." },
      { q: "Rowhammer es un ataque que:", o: ["Provoca bit flips en celdas DRAM adyacentes mediante accesos repetidos a filas vecinas", "Sobrescribe el microcodigo de la CPU", "Explota el predictor de ramas"], c: 0, e: "Rowhammer martillea filas de DRAM repetidamente induciendo fugas de carga que voltean bits en filas adyacentes (defecto fisico de DRAM densa)." },
    ],
    a: [
      { q: "La mitigacion KPTI/KAISER contra Meltdown funciona mediante:", o: ["Deshabilitar la ejecucion especulativa por completo", "Separar las tablas de paginas de usuario y kernel para que la memoria de kernel no este mapeada en espacio de usuario", "Cifrar la cache L1"], c: 1, e: "KPTI desmapea la mayoria de la memoria de kernel del espacio de direcciones de usuario, eliminando el objetivo especulativo de Meltdown (a costa de overhead en cambios de contexto)." },
      { q: "El ataque Prime+Probe se prefiere sobre Flush+Reload cuando:", o: ["La victima usa SMT desactivado", "Se dispone de acceso a clflush y paginas compartidas", "No hay memoria compartida entre atacante y victima, operando a nivel de conjuntos (sets) de cache"], c: 2, e: "Prime+Probe no requiere memoria compartida: el atacante llena un cache set y mide evicciones, util en escenarios cross-VM sin deduplicacion de memoria." },
      { q: "La variante Spectre-BTB (Branch Target Injection, variante 2) se mitiga con:", o: ["Retpolines y/o IBRS/eIBRS que aislan el branch target buffer", "Aumentar el tamano de la cache L3", "KPTI exclusivamente"], c: 0, e: "Spectre v2 envenena el BTB; las retpolines (trampoline de retorno) y las barreras de hardware IBRS/STIBP/eIBRS impiden la inyeccion de targets especulativos." },
      { q: "El TRR (Target Row Refresh) como defensa contra Rowhammer fue derrotado por:", o: ["Ataques many-sided como TRRespass que martillean multiples filas agresoras para saturar el contador de TRR", "Reducir la frecuencia de la DRAM", "Simplemente desactivar ECC"], c: 0, e: "TRRespass demostro que TRR rastrea un numero limitado de filas agresoras; martillear muchas (many-sided) evade el refresco dirigido y vuelve a inducir bit flips." },
    ],
  },
  72: {
    i: [
      { q: "El voltage glitching como tecnica de fault injection busca:", o: ["Introducir una caida de tension momentanea para provocar un fallo de computo (p.ej. saltar una comprobacion)", "Sobrecalentar el chip hasta destruirlo", "Medir el consumo de potencia"], c: 0, e: "El voltage/power glitching aplica una perturbacion breve de tension para corromper una instruccion, tipicamente saltarse una verificacion de seguridad o un branch." },
      { q: "El Differential Power Analysis (DPA) extrae claves criptograficas mediante:", o: ["Inyeccion de fallos en el reloj", "Lectura directa del bus JTAG", "Analisis estadistico del consumo de potencia correlacionado con datos intermedios hipotetizados"], c: 2, e: "DPA correlaciona muchas trazas de consumo con un modelo de potencia de valores intermedios dependientes de la clave, distinguiendo la subclave correcta estadisticamente." },
      { q: "JTAG es relevante en hardware hacking porque:", o: ["Es un protocolo de cifrado de disco", "Es una interfaz de depuracion/boundary scan que puede dar acceso a registros, memoria y control del CPU si esta habilitada", "Es un formato de firmware"], c: 1, e: "JTAG (IEEE 1149.1) permite depuracion, boundary scan, leer/escribir memoria y a veces halt/control del nucleo; si no esta fusible-bloqueada, es una puerta de entrada." },
      { q: "Una contramedida comun contra fault injection a nivel de software es:", o: ["Redundancia: ejecutar comprobaciones criticas dos veces y comparar resultados", "Usar variables globales", "Aumentar la frecuencia del reloj"], c: 0, e: "La redundancia temporal/dual-check detecta fallos transitorios: si dos ejecuciones de la comprobacion difieren, se aborta de forma segura." },
    ],
    a: [
      { q: "El clock glitching induce fallos al:", o: ["Cifrar el reloj con un PLL", "Aumentar el voltaje de nucleo de forma sostenida", "Insertar un pulso de reloj demasiado corto que viola los tiempos de setup/hold, corrompiendo el registro destino"], c: 2, e: "Un glitch de reloj acorta un ciclo por debajo del setup time, de modo que el flip-flop captura un valor inestable/incorrecto, alterando la instruccion o el dato." },
      { q: "El Correlation Power Analysis (CPA) mejora sobre DPA clasico porque:", o: ["Usa el coeficiente de correlacion de Pearson con un modelo de potencia (p.ej. peso de Hamming) para una hipotesis de clave mas robusta", "Solo funciona con AES-256", "No necesita trazas de potencia"], c: 0, e: "CPA correlaciona las trazas con un modelo de leakage (Hamming weight/distance); el pico de Pearson revela la subclave correcta con menos trazas y mas robustez que DPA de diferencia de medias." },
      { q: "El masking como contramedida contra SCA funciona al:", o: ["Apagar el chip durante el computo", "Dividir cada valor intermedio sensible en shares aleatorios de modo que el consumo no correlacione con el secreto", "Cifrar las trazas de potencia"], c: 1, e: "El masking (boolean/aritmetico) randomiza los valores intermedios en shares; un atacante de primer orden no ve correlacion, requiriendo analisis de orden superior mucho mas costoso." },
      { q: "El ataque EMFI (Electromagnetic Fault Injection) tiene ventaja sobre el voltage glitching porque:", o: ["Funciona sin acceso fisico al dispositivo", "Es no invasivo respecto a la alimentacion y permite localizacion espacial precisa del fallo con una sonda EM", "No requiere sincronizacion temporal"], c: 1, e: "EMFI usa una bobina/sonda para inducir corrientes localizadas, logrando precision espacial (atacar una region del die) sin modificar la linea de alimentacion." },
    ],
  },
  73: {
    i: [
      { q: "Un bootkit se diferencia de un rootkit tradicional en que:", o: ["Solo infecta aplicaciones de usuario", "Compromete el proceso de arranque (firmware/bootloader) para persistir antes del sistema operativo", "Requiere conexion a internet permanente"], c: 1, e: "El bootkit infecta etapas tempranas del arranque (UEFI/bootloader), ejecutandose antes del SO y sobreviviendo a reinstalaciones del sistema." },
      { q: "Secure Boot tiene como objetivo:", o: ["Cifrar el disco completo", "Acelerar el tiempo de arranque", "Verificar criptograficamente la firma de cada componente del arranque antes de ejecutarlo"], c: 2, e: "Secure Boot valida firmas (db/dbx, KEK, PK) de bootloaders y drivers para impedir la ejecucion de codigo de arranque no autorizado." },
      { q: "La fase DXE en UEFI corresponde a:", o: ["El cargador del kernel de Linux", "La particion EFI del disco", "Driver Execution Environment, donde se cargan drivers y se inicializa la mayoria del hardware"], c: 2, e: "DXE (Driver Execution Environment) es la fase donde se despachan los drivers UEFI e inicializa el hardware tras PEI, una superficie clave de ataque de firmware." },
      { q: "El SPI flash en una placa base almacena tipicamente:", o: ["El sistema operativo completo", "El firmware UEFI/BIOS", "Las claves SSH del usuario"], c: 1, e: "La memoria SPI flash contiene el firmware UEFI/BIOS; reflashearla (in-situ o con clip) permite implantes persistentes a nivel firmware." },
    ],
    a: [
      { q: "El measured boot se diferencia de Secure Boot en que:", o: ["Bloquea el arranque si una firma falla", "Solo aplica a sistemas ARM", "Extiende hashes de cada componente a PCRs del TPM para attestation posterior, sin necesariamente detener el arranque"], c: 2, e: "Measured boot registra (mide) los componentes en PCRs del TPM permitiendo remote attestation; no impone politica de bloqueo como Secure Boot, sino evidencia verificable." },
      { q: "La vulnerabilidad BootHole (CVE-2020-10713) en GRUB2 permitia:", o: ["Desactivar el TPM via software", "Robar la clave de BitLocker por DMA", "Bypass de Secure Boot via un buffer overflow al parsear grub.cfg, ejecutando codigo arbitrario en el arranque"], c: 2, e: "BootHole explotaba un overflow en el parser de grub.cfg de GRUB2 (firmado), permitiendo ejecutar codigo no confiable manteniendo la cadena de Secure Boot." },
      { q: "Un implante en la region ME/firmware persiste mejor que en el SO porque:", o: ["El antivirus del SO no tiene visibilidad ni control sobre el codigo del firmware que se ejecuta antes y por debajo de el", "El firmware se reescribe en cada arranque", "El SO cifra el firmware automaticamente"], c: 0, e: "El firmware se ejecuta antes y con mas privilegio que el SO; las herramientas de seguridad del SO carecen de visibilidad, por lo que un implante de firmware es muy sigiloso y persistente." },
      { q: "La base de datos dbx en Secure Boot sirve para:", o: ["Almacenar la clave de plataforma (PK)", "Cifrar la particion EFI", "Mantener una lista de revocacion (hashes/firmas prohibidos) para invalidar binarios comprometidos como GRUB vulnerable"], c: 2, e: "dbx es la forbidden signatures database: contiene hashes/certificados revocados (p.ej. binarios afectados por BootHole) que Secure Boot rechazara ejecutar." },
    ],
  },
  74: {
    i: [
      { q: "Un TPM (Trusted Platform Module) proporciona principalmente:", o: ["Un coprocesador seguro para generacion/almacenamiento de claves, PCRs y operaciones criptograficas", "Aceleracion grafica", "Memoria RAM adicional"], c: 0, e: "El TPM es un modulo seguro que gestiona claves selladas, PCRs para measured boot, RNG y atestacion, con resistencia a manipulacion." },
      { q: "Intel SGX crea enclaves que:", o: ["Aceleran el cifrado de disco", "Aislan codigo y datos en una region de memoria cifrada protegida incluso del SO y hipervisor", "Reemplazan al TPM"], c: 1, e: "SGX ejecuta codigo en enclaves cuya memoria (EPC) esta cifrada y protegida del SO/hipervisor, ofreciendo confidencialidad e integridad del computo." },
      { q: "ARM TrustZone separa el sistema en:", o: ["Modo usuario y modo kernel", "Cores big y cores LITTLE", "Un Secure World y un Normal World con aislamiento a nivel de hardware"], c: 2, e: "TrustZone particiona el SoC en Secure World (TEE) y Normal World (REE), controlando el acceso a recursos via el bit NS y el Secure Monitor." },
      { q: "La remote attestation permite:", o: ["Cifrar el trafico de red", "Reiniciar el dispositivo a distancia", "Comprobar remotamente que una plataforma ejecuta software/medidas integras y confiables"], c: 2, e: "La attestation produce una evidencia firmada (quote) sobre el estado medido de la plataforma/enclave para que un verificador remoto confie en ella." },
    ],
    a: [
      { q: "El sealing de datos en un TPM ata el secreto a:", o: ["Un estado especifico de PCRs, de modo que solo se desellan si las medidas de arranque coinciden", "La direccion MAC de la tarjeta de red", "La hora del reloj del sistema"], c: 0, e: "TPM sealing cifra datos vinculandolos a valores de PCR; el unseal solo procede si el estado medido del arranque coincide, detectando manipulacion." },
      { q: "El ataque Foreshadow (L1TF) contra SGX comprometio enclaves al:", o: ["Extraer la clave por DPA", "Forzar bit flips con Rowhammer en el EPC", "Filtrar datos del enclave via la cache L1 mediante ejecucion especulativa"], c: 2, e: "Foreshadow (L1 Terminal Fault) usaba ejecucion especulativa para leer datos del enclave residentes en L1, rompiendo la confidencialidad y hasta la clave de attestation." },
      { q: "En SGX, la EPID (Enhanced Privacy ID) se usa para:", o: ["Cifrar el disco del enclave", "Attestation que prueba autenticidad del enclave preservando anonimato (firma de grupo) hacia el verificador", "Gestionar la memoria del enclave"], c: 1, e: "EPID es un esquema de firma de grupo que permite la remote attestation de SGX demostrando que es un enclave legitimo sin revelar la identidad unica de la plataforma." },
      { q: "Una limitacion fundamental de un root of trust basado solo en software es que:", o: ["Es mas lento que uno de hardware", "Consume mas energia", "Carece de un anclaje inmutable resistente a manipulacion, por lo que un atacante con suficiente privilegio puede subvertir la cadena entera"], c: 2, e: "Sin un anclaje de hardware inmutable (RTM/RTS/RTR), la cadena de confianza puede ser falsificada por codigo malicioso con privilegio; el hardware aporta la raiz no modificable." },
    ],
  },
  75: {
    i: [
      { q: "En reverse engineering, una tecnica anti-debugging comun en Windows es:", o: ["Cifrar el disco duro", "Llamar a IsDebuggerPresent o comprobar el flag BeingDebugged del PEB", "Deshabilitar la tarjeta de red"], c: 1, e: "IsDebuggerPresent (o leer directamente PEB->BeingDebugged) es una comprobacion clasica de presencia de depurador en procesos Windows." },
      { q: "El control flow flattening como tecnica de ofuscacion:", o: ["Elimina todas las funciones del binario", "Reemplaza el flujo de control estructurado por un dispatcher con un switch sobre una variable de estado", "Cifra las cadenas del programa"], c: 1, e: "El flattening convierte if/while en un bucle dispatcher gobernado por una variable de estado, dificultando reconstruir el grafo de control original." },
      { q: "En Ghidra/IDA, la vista de decompilacion sirve para:", o: ["Depurar en kernel-mode", "Reconstruir una aproximacion en pseudo-C del codigo a partir del ensamblador", "Ensamblar codigo a binario"], c: 1, e: "El decompilador produce pseudo-C a partir del desensamblado, acelerando el analisis estatico frente a leer solo ASM." },
      { q: "Una tecnica para evadir analisis dinamico (anti-VM) es:", o: ["Usar mas hilos de CPU", "Detectar artefactos de virtualizacion como drivers, MAC OUI o instrucciones de timing anomalas", "Comprimir el binario"], c: 1, e: "El malware comprueba artefactos de sandbox/VM (claves de registro de VMware, MAC, CPUID, timing de RDTSC) para alterar su comportamiento si se siente observado." },
    ],
    a: [
      { q: "La tecnica anti-debug basada en INT 2D / INT 3 explota que:", o: ["Cifra la seccion .text del binario", "Borra el EntryPoint", "El comportamiento de la excepcion difiere segun haya o no un depurador adjunto, alterando el flujo de ejecucion"], c: 2, e: "INT 2D y excepciones de breakpoint cambian de comportamiento bajo un depurador (que consume/altera la excepcion), permitiendo bifurcar el flujo para detectarlo." },
      { q: "El packing con descifrado por capas (multi-layer) dificulta el unpacking estatico porque:", o: ["Cifra solo los recursos graficos", "El codigo real solo existe en memoria tras descifrar varias etapas en runtime, ocultando el OEP", "Aumenta el tamano del PE header"], c: 1, e: "Los packers descifran etapas sucesivas en tiempo de ejecucion; el codigo original (OEP) solo aparece tras desempaquetar todas las capas, frustrando el analisis estatico." },
      { q: "Para deofuscar control flow flattening de forma automatizada se suele:", o: ["Recompilar con -O2", "Usar ejecucion simbolica/optimizacion para recuperar las transiciones de estado y reconstruir el CFG original", "Renombrar funciones manualmente"], c: 1, e: "Herramientas que aplican ejecucion simbolica o pasos de SSA/optimizacion resuelven la variable de estado del dispatcher y reconstruyen el grafo de control original." },
      { q: "El uso de TLS callbacks como tecnica anti-debug consiste en:", o: ["Cifrar el trafico TLS de red del binario", "Ejecutar codigo (comprobaciones anti-debug) antes del EntryPoint principal, donde muchos depuradores ponen el primer breakpoint", "Deshabilitar el certificado del proceso"], c: 1, e: "Los TLS callbacks se ejecutan antes del EntryPoint; el malware coloca comprobaciones anti-debug alli porque muchos analistas/depuradores rompen recien en el OEP." },
    ],
  },
  76: {
    i: [
      { q: "La ejecucion simbolica representa las entradas del programa como:", o: ["Valores concretos aleatorios", "Constantes fijas a cero", "Variables simbolicas y construye formulas (path constraints) sobre los caminos posibles"], c: 2, e: "La ejecucion simbolica trata las entradas como simbolos, acumulando restricciones de camino que un SMT solver resuelve para hallar entradas que alcanzan cada rama." },
      { q: "El problema de path explosion en ejecucion simbolica se refiere a:", o: ["El consumo de ancho de banda de red", "La perdida de precision de punto flotante", "El crecimiento exponencial del numero de caminos a explorar con cada bifurcacion"], c: 2, e: "Cada branch duplica potencialmente los caminos; bucles y llamadas anidadas hacen crecer el espacio de estados exponencialmente, el reto central de la tecnica." },
      { q: "angr es principalmente:", o: ["Un compilador de C", "Un fuzzer de protocolos de red", "Un framework de analisis binario con ejecucion simbolica en Python"], c: 2, e: "angr es una plataforma de analisis binario que combina ejecucion simbolica, analisis estatico y emulacion (VEX/claripy) en Python." },
      { q: "Un SMT solver (como Z3) se usa en ejecucion simbolica para:", o: ["Compilar el binario objetivo", "Medir cobertura de codigo en runtime", "Determinar si un conjunto de restricciones de camino es satisfacible y generar un modelo de entrada"], c: 2, e: "El SMT solver decide la satisfacibilidad de las path constraints y, si lo son, produce valores concretos de entrada que ejecutan ese camino." },
    ],
    a: [
      { q: "La ejecucion concolica (concrete + symbolic) mitiga path explosion al:", o: ["Limitar el binario a una sola funcion", "Ejecutar concretamente para guiar la exploracion y solo mantener simbolicas las entradas relevantes, negando restricciones para descubrir nuevos caminos", "Eliminar el SMT solver por completo"], c: 1, e: "DART/SAGE alternan ejecucion concreta y simbolica: corren con entradas reales recogiendo constraints y luego niegan ramas para dirigir la generacion de nuevas entradas, acotando la explosion." },
      { q: "Una limitacion clasica de la ejecucion simbolica son las llamadas a entornos (system calls / librerias externas) porque:", o: ["El motor no puede modelar simbolicamente su efecto sin modelos/summaries, llevando a perdida de precision o caminos no resolubles", "Siempre causan segfault", "No tienen direccion de memoria"], c: 0, e: "Las syscalls y funciones de libreria sin codigo analizable requieren modelos manuales (function summaries); sin ellos el motor pierde precision o se atasca." },
      { q: "KLEE opera sobre LLVM bitcode lo que le permite:", o: ["Analizar cualquier binario sin codigo fuente", "Ejecucion simbolica a nivel IR con informacion de tipos y memoria, generando test cases de alta cobertura", "Ejecutar exclusivamente en GPU"], c: 1, e: "KLEE interpreta simbolicamente LLVM IR (requiere compilar el fuente a bitcode), aprovechando la representacion estructurada para generar test cases que maximizan cobertura." },
      { q: "El state merging en ejecucion simbolica reduce la explosion de caminos pero su contrapartida es:", o: ["Pierde toda capacidad de detectar bugs", "Genera formulas mas complejas (disyunciones/ITE) que pueden ralentizar al SMT solver", "Requiere reescribir el binario"], c: 1, e: "Fusionar estados en un solo nodo evita ramas redundantes pero introduce expresiones if-then-else/disyuntivas que aumentan la carga del solver, un trade-off clasico." },
    ],
  },
  77: {
    i: [
      { q: "Un kernel rootkit se distingue de uno de usuario en que:", o: ["Opera en espacio de kernel con maximo privilegio, pudiendo subvertir las estructuras y APIs del SO", "Requiere reinicio para activarse siempre", "Solo modifica archivos de configuracion"], c: 0, e: "El rootkit de kernel se ejecuta en ring 0, manipulando estructuras del SO y syscalls, lo que lo hace mucho mas potente y dificil de detectar que uno de userland." },
      { q: "DKOM (Direct Kernel Object Manipulation) se usa tipicamente para:", o: ["Ocultar procesos desenlazandolos de la lista de procesos activos del kernel", "Acelerar el scheduler", "Cifrar el disco"], c: 0, e: "DKOM modifica directamente objetos del kernel (p.ej. desenlaza un EPROCESS de la lista doblemente enlazada) para esconder procesos de las herramientas que recorren esa lista." },
      { q: "La SSDT (System Service Descriptor Table) en Windows es objetivo de rootkits porque:", o: ["Contiene punteros a los manejadores de syscalls que pueden ser hookeados para interceptar/falsear resultados", "Almacena las contrasenas del usuario", "Es la tabla de particiones del disco"], c: 0, e: "Hookear la SSDT permite redirigir syscalls (p.ej. enumeracion de archivos/procesos) para ocultar la presencia del rootkit, aunque PatchGuard lo dificulta en x64." },
      { q: "Una tecnica para detectar rootkits que ocultan procesos es:", o: ["Aumentar la prioridad del antivirus", "Cross-view detection: comparar enumeraciones de alto y bajo nivel buscando discrepancias", "Reiniciar en modo seguro siempre"], c: 1, e: "La deteccion cross-view compara la vista de la API (manipulada) con una enumeracion de bajo nivel/estructuras crudas; las discrepancias revelan objetos ocultos." },
    ],
    a: [
      { q: "PatchGuard (Kernel Patch Protection) en Windows x64 obliga a los rootkits modernos a:", o: ["Recurrir a tecnicas que no parcheen estructuras protegidas, como DKOM puntual, drivers firmados maliciosos o BYOVD", "Usar exclusivamente hooks de SSDT", "Operar solo en modo usuario"], c: 0, e: "PatchGuard detecta modificaciones de estructuras criticas (SSDT, IDT, etc.); por ello los rootkits x64 usan DKOM, drivers firmados o BYOVD (Bring Your Own Vulnerable Driver) para cargar codigo de kernel." },
      { q: "El IRP hooking en un driver malicioso permite:", o: ["Cifrar la memoria del kernel", "Interceptar y modificar los I/O Request Packets de un dispositivo (p.ej. el sistema de archivos) para filtrar resultados", "Desactivar el TPM"], c: 1, e: "Hookear las funciones de despacho de IRPs de un driver (filtrando lecturas de directorio/registro) deja ocultar archivos/claves a nivel de la pila de I/O." },
      { q: "Un bootkit UEFI persiste mejor que un rootkit de kernel porque:", o: ["Se ejecuta antes del SO y de las soluciones de seguridad, sobreviviendo a reinstalaciones del SO y formateos de disco", "No necesita ejecutar codigo", "Consume menos CPU"], c: 0, e: "Al residir en firmware/etapas de arranque, el bootkit se carga antes que el SO y su seguridad, persistiendo a traves de reinstalaciones y formateos del disco." },
      { q: "La tecnica BYOVD (Bring Your Own Vulnerable Driver) consiste en:", o: ["Compilar el rootkit con un compilador personalizado", "Deshabilitar Secure Boot por software", "Cargar un driver legitimamente firmado pero vulnerable y explotarlo para obtener ejecucion arbitraria en kernel"], c: 2, e: "BYOVD aprovecha un driver firmado (confiable para el SO) con una vulnerabilidad para ejecutar codigo en ring 0 sin necesidad de firmar el propio rootkit, evadiendo DSE." },
    ],
  },
  78: {
    i: [
      { q: "Un C2 beacon tipicamente:", o: ["Mantiene una conexion TCP permanente y ruidosa", "Hace check-in periodico al servidor C2 para recibir tareas, a menudo con jitter para evadir deteccion", "Cifra el disco de la victima"], c: 1, e: "Un beacon hace polling intermitente (con sleep + jitter) al C2 para recoger comandos, minimizando trafico continuo que delatara la comunicacion." },
      { q: "AMSI (Antimalware Scan Interface) en Windows permite que:", o: ["El antivirus inspeccione contenido (p.ej. scripts de PowerShell) en el momento de su evaluacion, incluso si esta ofuscado/en memoria", "El sistema cifre la memoria del proceso", "Se deshabilite el firewall"], c: 0, e: "AMSI da a las soluciones AV un punto de inspeccion del contenido tal como se ejecuta (PowerShell, VBA, .NET), permitiendo detectar payloads ofuscados en memoria." },
      { q: "Un AMSI bypass comun a nivel de proceso busca:", o: ["Parchear amsi.dll (p.ej. AmsiScanBuffer) en memoria para que siempre devuelva 'limpio'", "Reinstalar Windows", "Cambiar la contrasena de administrador"], c: 0, e: "Una tecnica habitual parchea en memoria AmsiScanBuffer/AmsiScanString o corrompe el contexto para que AMSI no escanee o devuelva AMSI_RESULT_CLEAN." },
      { q: "Los syscalls directos se usan en implants para:", o: ["Acelerar el cifrado", "Evadir hooks en userland (ntdll) que ponen los EDR, invocando la syscall directamente sin pasar por la API hookeada", "Reducir el tamano del binario"], c: 1, e: "Los EDR suelen hookear funciones de ntdll en userland; emitir el syscall directamente (con el SSN correcto) evita esos hooks de espacio de usuario." },
    ],
    a: [
      { q: "La tecnica de sleep obfuscation (p.ej. Ekko/Foliage) busca:", o: ["Cifrar la memoria del beacon mientras duerme y descifrarla solo al ejecutar, evadiendo escaneos de memoria del EDR", "Aumentar el jitter a cero", "Reducir el tiempo de sleep del beacon"], c: 0, e: "Sleep obfuscation cifra el region de memoria del implant durante el sleep (usando timers/ROP) para que los escaneos en reposo no encuentren firmas, restaurandola al despertar." },
      { q: "El indirect syscall mejora sobre el direct syscall clasico porque:", o: ["Cifra el stack", "Ejecuta la instruccion syscall desde dentro de ntdll (direccion legitima), evadiendo deteccion de syscalls originados fuera de ntdll", "No necesita el numero de syscall"], c: 1, e: "El direct syscall ejecuta la instruccion desde el codigo del implant (anomalo); el indirect syscall salta a una instruccion syscall ubicada en ntdll, pareciendo legitimo en el call stack." },
      { q: "El module stomping (module overloading) como tecnica de evasion consiste en:", o: ["Cifrar el PEB", "Cargar un DLL legitimo y sobrescribir su seccion de codigo con el payload para que la memoria aparezca respaldada por una imagen en disco", "Eliminar todos los modulos del proceso"], c: 1, e: "Module stomping mapea un DLL legitimo (memoria image-backed, no privada+RX) y sobrescribe su .text con el shellcode, evadiendo heuristicas que marcan memoria privada ejecutable." },
      { q: "El hardware breakpoint hooking via el debug register (Dr0-Dr7) sirve a un implant para:", o: ["Desactivar el scheduler", "Cifrar el trafico C2", "Interceptar llamadas (p.ej. a AmsiScanBuffer) sin parchear bytes en memoria, evitando deteccion de modificaciones de codigo"], c: 2, e: "Usando registros de depuracion hardware se coloca un breakpoint que dispara un handler de excepcion para alterar el flujo (p.ej. AMSI) sin modificar bytes, evadiendo deteccion de patching." },
    ],
  },
  79: {
    i: [
      { q: "El coverage-guided fuzzing (AFL, libFuzzer) prioriza inputs que:", o: ["Provienen siempre de la red", "Descubren nuevos caminos/cobertura de codigo, conservandolos en el corpus para mutarlos", "Son los mas grandes en tamano"], c: 1, e: "El fuzzing guiado por cobertura instrumenta el binario y retiene como semillas los inputs que exploran nuevas aristas del CFG, dirigiendo la mutacion." },
      { q: "AddressSanitizer (ASan) ayuda en fuzzing porque:", o: ["Cifra el binario", "Detecta corrupciones de memoria (heap/stack overflow, use-after-free) convirtiendo bugs silenciosos en crashes visibles", "Acelera la ejecucion del target"], c: 1, e: "ASan instrumenta accesos a memoria con redzones/shadow memory para que los errores latentes se manifiesten como aborts detectables por el fuzzer." },
      { q: "Una harness (fuzz target) en libFuzzer es:", o: ["Un parser de logs", "Un servidor C2", "Una funcion LLVMFuzzerTestOneInput que recibe datos arbitrarios y ejercita la API objetivo"], c: 2, e: "La harness define como se entregan los bytes mutados a la API bajo prueba (LLVMFuzzerTestOneInput), siendo clave para una buena cobertura." },
      { q: "El triage de crashes consiste en:", o: ["Compilar el target con optimizaciones", "Generar mas inputs aleatorios", "Agrupar, deduplicar y analizar los crashes para determinar explotabilidad y causa raiz"], c: 2, e: "El triage deduplica crashes (p.ej. por stack hash), evalua severidad/explotabilidad y localiza la causa raiz para priorizar la correccion." },
    ],
    a: [
      { q: "El uso de un dictionary (tokens) en fuzzing de formatos estructurados ayuda a:", o: ["Superar barreras de comparaciones magicas/keywords que la mutacion ciega rara vez acierta", "Deshabilitar la instrumentacion", "Reducir el tamano del corpus"], c: 0, e: "Los diccionarios aportan tokens (magic bytes, palabras clave) que la mutacion byte a byte casi nunca generaria, permitiendo penetrar parsers con comprobaciones de cabecera." },
      { q: "El problema de los magic-value/checksum comparisons en fuzzing se mitiga con:", o: ["Desactivar ASan", "Instrumentacion de comparaciones (cmplog/laf-intel) que descompone comparaciones para guiar la mutacion hacia el valor objetivo", "Aumentar el numero de hilos"], c: 1, e: "Tecnicas como laf-intel/cmplog dividen comparaciones multibyte en sub-comparaciones, dando feedback de progreso para que el fuzzer converja al valor magico." },
      { q: "El structure-aware fuzzing (p.ej. con protobuf-mutator) es ventajoso cuando:", o: ["Solo se busca medir rendimiento", "La entrada tiene una gramatica/estructura compleja y las mutaciones deben respetar invariantes para llegar a logica profunda", "El target acepta cualquier byte aleatorio"], c: 1, e: "Para entradas muy estructuradas, mutar respetando la gramatica (libprotobuf-mutator, grammars) evita rechazos tempranos del parser y alcanza la logica interna." },
      { q: "Persistent mode en AFL++ mejora el throughput al:", o: ["Reejecutar el harness en un bucle dentro del mismo proceso evitando el coste de fork/exec por iteracion", "Cifrar los inputs", "Ejecutar el target en una VM aislada"], c: 0, e: "Persistent mode (__AFL_LOOP) procesa muchos inputs en el mismo proceso, eliminando el fork+exec por iteracion y multiplicando las ejecuciones por segundo." },
    ],
  },
  80: {
    i: [
      { q: "En el Diamond Model de analisis de intrusiones, los cuatro vertices son:", o: ["Adversario, capacidad, infraestructura y victima", "Tactica, tecnica, procedimiento e indicador", "Red, host, usuario y archivo"], c: 0, e: "El Diamond Model relaciona Adversario, Capacidad (malware/exploit), Infraestructura (C2/dominios) y Victima como vertices conectados por meta-features." },
      { q: "Las TTPs (Tacticas, Tecnicas y Procedimientos) son valiosas para la atribucion porque:", o: ["Son indicadores de bajo nivel que cambian a diario", "Solo aplican a malware bancario", "Reflejan el comportamiento del adversario, mas dificil de cambiar que IPs o hashes"], c: 2, e: "Segun la piramide del dolor, las TTPs estan en la cuspide: cambiarlas cuesta mucho al atacante, por eso son mas robustas para clustering y atribucion que IOCs efimeros." },
      { q: "Un IOC (Indicator of Compromise) tipico es:", o: ["Un hash de archivo, un dominio C2 o una IP maliciosa", "El presupuesto del SOC", "El nombre legal del atacante"], c: 0, e: "Los IOCs son artefactos observables de un compromiso (hashes, dominios, IPs, mutex), faciles de cambiar y por ello de menor durabilidad analitica." },
      { q: "MITRE ATT&CK se usa principalmente para:", o: ["Cifrar comunicaciones C2", "Catalogar tacticas y tecnicas adversariales observadas en el mundo real para mapear y comparar comportamientos", "Gestionar parches de software"], c: 1, e: "ATT&CK es una base de conocimiento de TTPs adversariales que permite mapear actividad, evaluar cobertura defensiva y clusterizar campanas." },
    ],
    a: [
      { q: "Un riesgo del attribution analysis es el de false flag, que ocurre cuando:", o: ["El malware no esta firmado", "Un actor incorpora deliberadamente artefactos/TTPs de otro grupo para enganar a los analistas", "El SIEM no tiene suficientes logs"], c: 1, e: "Las false flags plantan deliberadamente indicadores (lenguaje, herramientas, infraestructura) de otro actor para desviar la atribucion, exigiendo cautela analitica." },
      { q: "El TTP clustering para vincular campanas a un mismo actor se apoya en:", o: ["Correlacionar patrones de comportamiento persistentes (cadenas de tecnicas, codigo compartido, infraestructura) en lugar de IOCs aislados", "El tamano del archivo de malware", "Unicamente el hash del binario"], c: 0, e: "El clustering robusto cruza comportamientos durables (reutilizacion de codigo, kill chains, patrones de infra) que un actor cambia con dificultad, no solo indicadores volatiles." },
      { q: "El concepto de pivoting en infraestructura durante threat intel consiste en:", o: ["Partir de un IOC conocido (dominio/IP/cert) y descubrir infraestructura relacionada via datos pasivos como passive DNS, WHOIS o certificados TLS", "Reiniciar el servidor C2", "Mover lateralmente dentro de la red victima"], c: 0, e: "El pivoting expande el conocimiento de la infraestructura del adversario relacionando artefactos (passive DNS, registros WHOIS, SSL/JARM) a partir de un indicador semilla." },
      { q: "Los niveles de confianza (analytic confidence) en informes de TI son importantes porque:", o: ["Sustituyen la necesidad de evidencia", "Determinan el precio del producto", "Comunican la incertidumbre de las conclusiones (atribucion, intencion) evitando sobreinterpretacion por parte de los consumidores"], c: 2, e: "Expresar confianza (alta/media/baja) y los supuestos subyacentes permite a los decisores ponderar el riesgo de actuar sobre una atribucion potencialmente erronea." },
    ],
  },
  81: {
    i: [
      { q: "La divulgacion responsable (responsible/coordinated disclosure) implica:", o: ["Publicar el exploit inmediatamente sin avisar al vendor", "Vender la vulnerabilidad al mejor postor", "Notificar al proveedor de forma privada y darle un plazo razonable para corregir antes de la publicacion"], c: 2, e: "La divulgacion coordinada reporta el fallo en privado al vendor con un plazo (p.ej. 90 dias) para parchear antes de hacerlo publico, equilibrando seguridad y transparencia." },
      { q: "Un CVE es:", o: ["Un identificador unico y estandarizado para una vulnerabilidad publicamente conocida", "Un tipo de exploit de kernel", "Una metrica de severidad de 0 a 10"], c: 0, e: "CVE (Common Vulnerabilities and Exposures) asigna un ID unico a cada vulnerabilidad divulgada, facilitando su referencia inequivoca entre herramientas y reportes." },
      { q: "CVSS se utiliza para:", o: ["Asignar el identificador unico de la vulnerabilidad", "Puntuar la severidad de una vulnerabilidad segun metricas de impacto y explotabilidad", "Cifrar el reporte de la vulnerabilidad"], c: 1, e: "CVSS (Common Vulnerability Scoring System) produce una puntuacion 0-10 basada en vectores como AV, AC, impacto en C/I/A, distinta del identificador CVE." },
      { q: "Una buena Prueba de Concepto (PoC) para un reporte debe:", o: ["Demostrar de forma minima y reproducible la vulnerabilidad sin causar dano innecesario", "Ser un malware listo para weaponizar contra terceros", "Omitir los pasos de reproduccion"], c: 0, e: "Una PoC etica es minima, reproducible y demuestra el problema con el menor impacto posible, evitando armar un exploit destructivo para uso ofensivo." },
    ],
    a: [
      { q: "El debate entre full disclosure y coordinated disclosure gira en torno a:", o: ["El idioma del aviso", "El equilibrio entre presionar al vendor para que parchee rapido (full) y minimizar la ventana de exposicion a atacantes (coordinated)", "El formato del reporte"], c: 1, e: "Full disclosure publica todo de inmediato (presiona al vendor pero arma a atacantes); coordinated da tiempo de parche reduciendo el riesgo, un trade-off etico clasico." },
      { q: "Un CNA (CVE Numbering Authority) es:", o: ["Una metrica de explotabilidad", "Una organizacion autorizada a asignar identificadores CVE dentro de su alcance", "Un escaner de vulnerabilidades automatizado"], c: 1, e: "Los CNAs (vendors, proyectos, coordinadores como CERT/CC) estan autorizados por el programa CVE para reservar y asignar IDs dentro de su scope." },
      { q: "Por que CVSS base score no debe usarse aisladamente para priorizar remediacion?", o: ["Porque solo aplica a software libre", "Porque siempre subestima la severidad", "Porque no considera contexto de explotacion en el mundo real ni el entorno; metricas como EPSS o KEV complementan la priorizacion"], c: 2, e: "El base score no refleja si la vuln se explota activamente; EPSS (probabilidad de explotacion) y el catalogo KEV de CISA aportan contexto real para priorizar mejor." },
      { q: "Al escribir un PoC para un bug de corrupcion de memoria, una practica de research responsable es:", o: ["Distribuirlo en foros antes de avisar al vendor", "Limitar el PoC a probar el control de flujo (p.ej. crash o ret control) sin codigo danino, y coordinar con el vendor", "Incluir una payload de ransomware como demostracion"], c: 1, e: "Un PoC etico demuestra la primitiva (crash, control de EIP/RIP) sin weaponizar con payloads daninas, y se comparte de forma coordinada con el afectado." },
    ],
  },
  82: {
    i: [
      { q: "Los metodos formales en seguridad buscan:", o: ["Acelerar la compilacion del codigo", "Cifrar el codigo fuente", "Probar matematicamente propiedades de un sistema en lugar de solo testearlo"], c: 2, e: "Los metodos formales usan logica y matematicas para verificar (o refutar) propiedades de correccion/seguridad de forma exhaustiva, complementando al testing empirico." },
      { q: "El model checking funciona al:", o: ["Explorar exhaustivamente el espacio de estados de un modelo para verificar si cumple una especificacion (p.ej. en logica temporal)", "Compilar a codigo maquina optimizado", "Ejecutar el programa con entradas aleatorias"], c: 0, e: "El model checking recorre sistematicamente los estados alcanzables del modelo comprobando propiedades (LTL/CTL) y produce un contraejemplo si fallan." },
      { q: "TLA+ es:", o: ["Un fuzzer de protocolos", "Un compilador de C verificado", "Un lenguaje de especificacion formal para modelar y verificar sistemas concurrentes y distribuidos"], c: 2, e: "TLA+ (de Leslie Lamport) especifica sistemas mediante logica temporal de acciones; su model checker TLC verifica invariantes y propiedades de liveness." },
      { q: "seL4 es notable porque:", o: ["Es el primer microkernel de proposito general con prueba formal de correccion funcional respecto a su especificacion", "Es un fuzzer de kernels", "Es un nuevo algoritmo de cifrado"], c: 0, e: "seL4 logro una verificacion formal de correccion funcional (y propiedades de seguridad como integridad/confidencialidad), demostrando que su implementacion cumple su especificacion." },
    ],
    a: [
      { q: "El state space explosion en model checking se mitiga con tecnicas como:", o: ["Symbolic model checking con BDDs, abstraccion y partial order reduction", "Eliminar las propiedades a verificar", "Aumentar la RAM exclusivamente"], c: 0, e: "BDDs (representacion simbolica), abstraccion (CEGAR), partial order reduction y bounded model checking reducen el numero de estados a explorar explicitamente." },
      { q: "El theorem proving interactivo (p.ej. Coq, Isabelle/HOL) se diferencia del model checking en que:", o: ["Construye pruebas (a menudo con guia humana) sobre sistemas posiblemente infinitos, no limitado a estados finitos enumerables", "Solo verifica programas de menos de 100 lineas", "Es totalmente automatico y no requiere guia humana"], c: 0, e: "Los theorem provers permiten razonar sobre dominios infinitos mediante pruebas asistidas/interactivas, a diferencia del model checking que explora un espacio de estados (idealmente finito)." },
      { q: "CEGAR (Counterexample-Guided Abstraction Refinement) opera al:", o: ["Ejecutar el programa sin instrumentar", "Verificar una abstraccion y, si el contraejemplo es espurio, refinar la abstraccion iterativamente para descartarlo", "Generar tests aleatorios guiados por cobertura"], c: 1, e: "CEGAR comienza con una abstraccion gruesa; si halla un contraejemplo que resulta espurio en el sistema concreto, refina la abstraccion y reitera hasta probar o refutar." },
      { q: "La correctness proof de seL4 asume un modelo de hardware, lo que implica que:", o: ["La prueba es invalida", "La prueba cubre fallos de hardware como Rowhammer y side-channels automaticamente", "Las garantias dependen de que el hardware se comporte segun el modelo asumido; ataques fisicos/microarquitectonicos quedan fuera del alcance de la prueba"], c: 2, e: "La verificacion es relativa a sus supuestos (modelo de maquina, compilador/cadena de confianza); amenazas como side-channels o glitching de hardware no estan dentro del enunciado formal probado." },
    ],
  },
  83: {
    i: [
      { q: "RBAC vs ABAC: la diferencia clave es que ABAC decide por:", o: ["Rol asignado", "Atributos y contexto (usuario, recurso, entorno)", "Dirección IP únicamente"], c: 1, e: "ABAC es más granular y dinámico que el rol fijo de RBAC." },
      { q: "SAML y OIDC se usan típicamente para:", o: ["Cifrado de disco", "SSO/federación de identidad", "Escaneo de puertos"], c: 1, e: "SAML (XML) y OIDC (sobre OAuth2) habilitan SSO entre IdP y aplicaciones." },
      { q: "La 'recertificación de accesos' consiste en:", o: ["Renovar el certificado TLS", "Revisar periódicamente que cada usuario siga necesitando sus permisos", "Reinstalar el IdP"], c: 1, e: "Control de gobierno que detecta acumulación de privilegios (privilege creep)." },
      { q: "Un MFA resistente a phishing se basa en:", o: ["OTP por SMS", "FIDO2/passkeys ligadas al dominio", "Preguntas de seguridad"], c: 1, e: "FIDO2 vincula la credencial al origen, frustrando el reenvío de la víctima." },
      { q: "¿Qué factor de autenticación cubre la biometría (huella, cara)?", o: ["Conocimiento", "Posesión", "Inherencia"], c: 2, e: "Inherencia = algo que sos. Cuidado: no es revocable si se filtra." },
      { q: "En una passkey, ¿qué se guarda en el servidor?", o: ["La contraseña cifrada", "La clave pública del par asimétrico", "El challenge del último login"], c: 1, e: "La privada nunca sale del dispositivo; el servidor solo verifica firmas con la pública." },
      { q: "'Number matching' en push MFA mitiga principalmente:", o: ["El SIM swap", "El MFA fatigue / prompt bombing", "El SQL injection"], c: 1, e: "Obliga al usuario a tipear un número visible, así no puede aceptar sin ver el contexto." },
      { q: "Un magic link como único método de login es débil porque:", o: ["Es lento", "Depende del canal email; si la cuenta email cae, cae todo", "Consume mucha batería"], c: 1, e: "El email es un secreto reusable en manos del proveedor y del atacante que lo comprometa." },
      { q: "En autenticación adaptativa, 'step-up' significa:", o: ["Escalar privilegios de admin", "Pedir un factor adicional cuando el riesgo del contexto sube", "Subir la versión del cliente"], c: 1, e: "Ej: login normal desde red confiable, pero al acceder a la consola de admin exigir passkey." },
    ],
    a: [
      { q: "En Zero Trust, la decisión de acceso se evalúa:", o: ["Una vez al iniciar sesión", "De forma continua según identidad, dispositivo y contexto", "Solo por ubicación de red"], c: 1, e: "'Never trust, always verify': evaluación dinámica por petición." },
      { q: "El acceso 'just-in-time' (JIT) en PAM busca:", o: ["Conceder privilegios solo durante una ventana acotada", "Acelerar el login", "Eliminar el MFA"], c: 0, e: "Reduce el tiempo de exposición de credenciales privilegiadas." },
      { q: "IGA (Identity Governance & Administration) aporta principalmente:", o: ["Aceleración de red", "Flujos de solicitud/aprobación, recertificación y auditoría de identidades", "Cifrado homomórfico"], c: 1, e: "Gobierna el QUIÉN-tiene-QUÉ y por qué, con trazabilidad." },
      { q: "El riesgo central de las cuentas de servicio mal gestionadas es:", o: ["Consumen mucha RAM", "Credenciales estáticas con altos privilegios y sin rotación", "No pueden usar MFA nunca"], c: 1, e: "Son objetivo de movimiento lateral; conviene bóveda, rotación y mínimo privilegio." },
      { q: "En AiTM proxy phishing (evilginx/Modlishka), ¿qué roba realmente el atacante?", o: ["La contraseña únicamente", "La contraseña, el OTP y el token de sesión post-MFA", "Solo el certificado TLS"], c: 1, e: "El proxy replica el flujo completo. Solo FIDO2 con origin binding lo detiene." },
      { q: "En una 'sync passkey' (iCloud/Google), la ventaja frente a device-bound es:", o: ["Es más resistente al phishing", "Sobrevive a la pérdida del dispositivo (backup en la nube)", "Elimina la necesidad de un servidor"], c: 1, e: "Trade-off: recuperación fácil vs. atar la credencial al hardware; enterprise suele preferir device-bound." },
      { q: "En consent phishing (illicit OAuth grant), ¿qué obtiene el atacante que salta la MFA?", o: ["El hash de la contraseña", "Tokens OAuth persistentes con los permisos que el usuario concedió", "El TGT de Kerberos"], c: 1, e: "La víctima 'consiente' voluntariamente; los tokens tienen su propia caducidad y evaden reautenticación." },
      { q: "Un 'downgrade path' débil en auth passwordless significa:", o: ["Que la contraseña se olvida sola", "Que la recuperación cae a un método más débil (SMS, pregunta) y baja la fortaleza real del sistema", "Que el servidor se rinde ante múltiples intentos"], c: 1, e: "El sistema es tan fuerte como su método de recuperación más débil. Diseñar bootstrap y recovery con el mismo nivel de assurance." },
      { q: "En Entra Conditional Access, un PDP (Policy Decision Point) decide basado en:", o: ["Solo la IP del cliente", "Múltiples señales: usuario, dispositivo, ubicación, riesgo, recurso", "El uptime del servidor"], c: 1, e: "El PDP evalúa contexto completo y devuelve allow/step-up/block; el PEP aplica esa decisión." },
    ],
  },
  84: {
    i: [
      { q: "Aplicar STRIDE durante el diseño es un ejemplo de:", o: ["Pentesting", "Threat modeling temprano", "Análisis forense"], c: 1, e: "Modelar amenazas en diseño es más barato que parchear en producción." },
      { q: "El patrón 'single point of entry' busca:", o: ["Un único punto controlado para validar accesos", "Un solo servidor físico", "Una sola contraseña global"], c: 0, e: "Centraliza el control en lugar de múltiples puertas sin vigilancia." },
      { q: "La gestión de secretos recomienda:", o: ["Hardcodear claves en el repo", "Usar una bóveda (Vault/KMS) y rotación", "Enviar claves por email"], c: 1, e: "Evita la fuga de credenciales en código y facilita rotación." },
      { q: "La microsegmentación se diferencia de la VLAN tradicional en que:", o: ["Usa cables más rápidos", "Aísla a nivel de carga de trabajo con políticas finas", "No requiere políticas"], c: 1, e: "Granularidad por workload, alineada con Zero Trust." },
    ],
    a: [
      { q: "En NIST SP 800-207, el PEP (Policy Enforcement Point):", o: ["Decide la política", "Aplica/ejecuta la decisión de acceso", "Almacena logs únicamente"], c: 1, e: "El PDP decide y el PEP hace cumplir la decisión en el punto de acceso." },
      { q: "El supuesto que rompe Zero Trust es:", o: ["Que la red interna es confiable", "Que existe el cifrado", "Que hay usuarios"], c: 0, e: "ZTA elimina la confianza implícita por ubicación de red." },
      { q: "SABSA es principalmente:", o: ["Un escáner de vulnerabilidades", "Un marco de arquitectura de seguridad alineado al negocio/riesgo", "Un lenguaje de programación"], c: 1, e: "Deriva la arquitectura de los objetivos y riesgos del negocio." },
      { q: "El 'blast radius' en arquitectura mide:", o: ["La latencia de red", "El alcance del daño si un componente se compromete", "El consumo eléctrico"], c: 1, e: "La segmentación y el menor privilegio lo reducen." },
    ],
  },
  85: {
    i: [
      { q: "MAGERIT es:", o: ["Un antivirus", "Una metodología de análisis de riesgos (España)", "Un estándar de cifrado"], c: 1, e: "Metodología pública del Gobierno de España, alineada con ISO 27005." },
      { q: "En análisis cuantitativo, ALE significa:", o: ["Annualized Loss Expectancy (pérdida anual esperada)", "Acceso Lógico Externo", "Auditoría de Logs Empresarial"], c: 0, e: "ALE = SLE × ARO; permite comparar riesgo en términos monetarios." },
      { q: "Un mapa de calor de riesgos sirve para:", o: ["Cifrar datos", "Priorizar riesgos por probabilidad e impacto", "Monitorear la CPU"], c: 1, e: "Visualiza qué riesgos atender primero." },
      { q: "ISO 27005 se enfoca en:", o: ["Gestión de riesgos de seguridad de la información", "Calidad de software", "Continuidad de negocio únicamente"], c: 0, e: "Acompaña a ISO 27001 con el proceso de gestión de riesgos." },
    ],
    a: [
      { q: "El modelo FAIR aporta principalmente:", o: ["Cuantificación financiera del riesgo cibernético", "Un escáner de red", "Reglas de firewall"], c: 0, e: "Factor Analysis of Information Risk descompone frecuencia y magnitud de pérdida." },
      { q: "Un KRI (Key Risk Indicator) es:", o: ["Un control de acceso", "Una métrica que anticipa aumentos de exposición al riesgo", "Un tipo de cifrado"], c: 1, e: "Alerta temprana para la gobernanza (p.ej. % de sistemas sin parchear)." },
      { q: "El riesgo de terceros (supply chain) se gestiona con:", o: ["Ignorarlo si el proveedor es grande", "Due diligence, cláusulas contractuales y evaluación continua", "Solo un firewall"], c: 1, e: "El proveedor amplía tu superficie de ataque (ej. SolarWinds)." },
      { q: "Aceptar formalmente un riesgo requiere:", o: ["Nada, es automático", "Aprobación documentada del responsable dentro del apetito", "Eliminar el activo"], c: 1, e: "La aceptación es una decisión de gobierno trazable y con dueño." },
    ],
  },
  86: {
    i: [
      { q: "El ENS (Esquema Nacional de Seguridad) aplica a:", o: ["Empresas de EE.UU.", "El sector público español y sus proveedores", "Solo bancos"], c: 1, e: "Marco obligatorio para administraciones públicas en España." },
      { q: "La 'Declaración de Aplicabilidad' (SoA) en ISO 27001 documenta:", o: ["Qué controles aplican y la justificación", "La contraseña del admin", "El presupuesto de TI"], c: 0, e: "Vincula controles del Anexo A con los riesgos tratados." },
      { q: "El DPO (Delegado de Protección de Datos) es requerido por:", o: ["PCI-DSS", "RGPD en ciertos casos", "ISO 9001"], c: 1, e: "Supervisa el cumplimiento del RGPD en la organización." },
      { q: "El ciclo PDCA de un SGSI significa:", o: ["Planificar, Hacer, Verificar, Actuar", "Probar, Depurar, Cifrar, Auditar", "Public Data Compliance Audit"], c: 0, e: "Mejora continua: Plan-Do-Check-Act." },
    ],
    a: [
      { q: "SOC 2 Type II evalúa:", o: ["El diseño de controles en un instante", "La eficacia operativa de los controles durante un periodo", "Solo la confidencialidad"], c: 1, e: "Type I = diseño puntual; Type II = operación sostenida (3-12 meses)." },
      { q: "Una 'no conformidad mayor' implica:", o: ["Una observación menor", "Una falla sistémica que compromete el objetivo del control", "Un elogio del auditor"], c: 1, e: "Requiere acción correctiva antes de certificar." },
      { q: "Los Trust Services Criteria de SOC 2 incluyen Security y:", o: ["Availability, Processing Integrity, Confidentiality, Privacy", "Solo Privacy", "Velocidad de red"], c: 0, e: "5 criterios; Security (Common Criteria) es obligatorio." },
      { q: "Un plan de acción correctiva (CAPA) debe atacar:", o: ["El síntoma visible", "La causa raíz de la no conformidad", "El presupuesto"], c: 1, e: "Corrige el origen para que la desviación no se repita." },
    ],
  },
};

export const QUIZ_LEVELS: QuizLevel[] = ["b", "i", "a"];

export const QUIZ_LEVEL_LABELS: Record<QuizLevel, string> = {
  b: "Básico",
  i: "Intermedio",
  a: "Avanzado",
};

// Devuelve el quiz de una lección para el nivel pedido (básico por defecto).
// 'b' sale de QUIZZES (back-compat); 'i'/'a' de QUIZZES_IA.
export function getQuiz(lessonId: number, level: QuizLevel = "b"): QuizQuestion[] | undefined {
  if (level === "b") return QUIZZES[lessonId];
  return QUIZZES_IA[lessonId]?.[level];
}

// Niveles con contenido disponible para una lección, en orden b → i → a.
export function availableLevels(lessonId: number): QuizLevel[] {
  const levels: QuizLevel[] = [];
  if (QUIZZES[lessonId]) levels.push("b");
  const ia = QUIZZES_IA[lessonId];
  if (ia?.i) levels.push("i");
  if (ia?.a) levels.push("a");
  return levels;
}
