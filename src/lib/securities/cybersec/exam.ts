import type { ExamQuestion } from "./types";

// Final exam — 56 questions sampled across the full 58-module curriculum,
// balanced by category (Fundamentos, Redes, Sistemas, Criptografía, Web,
// Pentesting, Ingeniería Social, Malware, Forense, Blue Team, Cloud,
// Especializado, Programación). Pass threshold: 70%.
// Question strings are unique (the test asserts no duplicates).
export const EXAM: ExamQuestion[] = [
  // ── Fundamentos ──
  { q: "La ciberseguridad combina:", o: ["HW, SW, Firmware", "Tecnología, Procesos, Personas", "Ataque, Defensa, Monitoreo"], c: 1 },
  { q: "¿Qué fase del Cyber Kill Chain consiste en entregar el payload al objetivo?", o: ["Reconnaissance", "Delivery", "Exploitation"], c: 1 },
  { q: "Un ransomware viola principalmente:", o: ["Confidencialidad", "Integridad", "Disponibilidad"], c: 2 },
  { q: "El principio Zero Trust se resume en:", o: ["Confiar en la red interna", "Never trust, always verify", "Solo el admin accede"], c: 1 },
  { q: "Las 5 funciones del NIST CSF son:", o: ["Atacar, Defender, Reportar, Parchear, Auditar", "Identificar, Proteger, Detectar, Responder, Recuperar", "Planear, Hacer, Verificar, Actuar, Medir"], c: 1 },
  { q: "MITRE ATT&CK cataloga:", o: ["Certificaciones", "TTPs de atacantes", "Vulnerabilidades con CVE"], c: 1 },
  { q: "El grupo APT atribuido a Corea del Norte es:", o: ["APT28", "Lazarus Group", "APT41"], c: 1 },
  { q: "Un gusano (worm) se distingue de un virus porque:", o: ["Cifra archivos", "Se propaga solo, sin interacción", "Necesita un click"], c: 1 },

  // ── Redes ──
  { q: "El modelo OSI tiene cuántas capas:", o: ["4", "5", "7"], c: 2 },
  { q: "HTTP opera en la capa OSI número:", o: ["3", "4", "7"], c: 2 },
  { q: "A diferencia de UDP, TCP:", o: ["Es más rápido", "Garantiza entrega con handshake", "No usa puertos"], c: 1 },
  { q: "El puerto estándar de HTTPS es:", o: ["80", "443", "22"], c: 1 },
  { q: "DNS utiliza principalmente el puerto:", o: ["53", "25", "143"], c: 0 },
  { q: "Una red /24 tiene cuántos hosts usables:", o: ["256", "254", "128"], c: 1 },
  { q: "El estándar WiFi que introduce SAE (Dragonfly) es:", o: ["WEP", "WPA2", "WPA3"], c: 2 },
  { q: "Un ataque de deauth en WiFi sirve para:", o: ["Crackear el cifrado directo", "Tirar clientes y forzar reconexión", "Clonar el router"], c: 1 },

  // ── Sistemas ──
  { q: "Los hashes de contraseñas en Linux se guardan en:", o: ["/etc/passwd", "/etc/shadow", "/var/log/syslog"], c: 1 },
  { q: "Un binario con bit SUID se ejecuta con permisos:", o: ["Del usuario que lo invoca", "Del dueño del archivo", "De nadie"], c: 1 },
  { q: "El Event ID 4625 de Windows indica:", o: ["Logon exitoso", "Logon fallido", "Servicio instalado"], c: 1 },
  { q: "El ataque Kerberoasting apunta a:", o: ["Cuentas de servicio con SPN", "El firewall", "El DNS"], c: 0 },
  { q: "Un Golden Ticket se forja con el hash de la cuenta:", o: ["Administrator", "krbtgt", "guest"], c: 1 },
  { q: "El Script Block Logging (Event 4104) de PowerShell sirve para:", o: ["Acelerar scripts", "Auditar el código ejecutado", "Cifrar scripts"], c: 1 },

  // ── Criptografía ──
  { q: "La criptografía simétrica se caracteriza por:", o: ["Usar la misma clave para cifrar y descifrar", "Usar dos claves", "No usar claves"], c: 0 },
  { q: "El modo de cifrado ECB es inseguro porque:", o: ["Es muy lento", "Bloques iguales producen cifrado igual (patrones)", "No usa clave"], c: 1 },
  { q: "El modo que cifra y autentica (AEAD) es:", o: ["ECB", "CBC", "GCM"], c: 2 },
  { q: "En criptografía asimétrica, para confidencialidad cifrás con la clave:", o: ["Privada del emisor", "Pública del receptor", "Compartida"], c: 1 },
  { q: "El algoritmo recomendado hoy para hashear contraseñas es:", o: ["MD5", "SHA-1", "Argon2"], c: 2 },
  { q: "En una PKI, quién emite y firma los certificados es:", o: ["El navegador", "La Certificate Authority (CA)", "El servidor DNS"], c: 1 },
  { q: "HSTS protege contra:", o: ["SQL Injection", "SSL stripping (degradar a HTTP)", "Buffer overflow"], c: 1 },
  { q: "La amenaza cuántica (algoritmo de Shor) compromete a:", o: ["AES-256", "RSA y ECC", "SHA-3"], c: 1 },

  // ── Web Security ──
  { q: "El header que más directamente mitiga XSS es:", o: ["Content-Security-Policy", "X-Frame-Options", "Referrer-Policy"], c: 0 },
  { q: "Una cookie con flag HttpOnly:", o: ["Solo viaja por HTTP", "No es accesible desde JavaScript", "Nunca expira"], c: 1 },
  { q: "El #1 del OWASP Top 10 actual es:", o: ["Injection", "Broken Access Control", "SSRF"], c: 1 },
  { q: "El payload ' OR 1=1 -- corresponde a:", o: ["XSS", "SQL Injection", "CSRF"], c: 1 },
  { q: "La defensa principal contra SQL Injection es:", o: ["Un WAF", "Consultas parametrizadas (prepared statements)", "Renombrar las tablas"], c: 1 },
  { q: "Leer http://169.254.169.254 desde el servidor es síntoma de:", o: ["XSS", "SSRF", "CSRF"], c: 1 },
  { q: "El flag de cookie que mitiga CSRF es:", o: ["Secure", "SameSite", "HttpOnly"], c: 1 },
  { q: "Validar un archivo subido por su extensión (.jpg):", o: ["Es seguro", "Es bypasseable; validá por contenido", "Mejora el rendimiento"], c: 1 },

  // ── Pentesting ──
  { q: "El reconocimiento pasivo se caracteriza por:", o: ["Escanear puertos", "No tocar al objetivo (OSINT)", "Explotar vulnerabilidades"], c: 1 },
  { q: "La opción de Nmap para detectar versiones de servicio es:", o: ["-sn", "-sV", "-f"], c: 1 },
  { q: "CVSS mide:", o: ["El precio del exploit", "La severidad de una vulnerabilidad (0-10)", "La latencia de red"], c: 1 },
  { q: "En Metasploit, el payload es:", o: ["La vulnerabilidad explotada", "Lo que se ejecuta tras explotar", "El escáner"], c: 1 },
  { q: "En Burp Suite, para reenviar y modificar un request manualmente usás:", o: ["Intruder", "Repeater", "Sequencer"], c: 1 },
  { q: "En Linux, sudo -l revela:", o: ["Los puertos abiertos", "Qué comandos podés correr como root", "Los usuarios"], c: 1 },
  { q: "La familia de exploits Potato (Windows) escala de:", o: ["Servicio a SYSTEM", "Invitado a usuario", "Red a host"], c: 0 },
  { q: "Pass-the-Hash permite:", o: ["Autenticar con el hash NTLM sin la password", "Romper AES", "Saltar el firewall físico"], c: 0 },

  // ── Ingeniería Social / Malware / Forense ──
  { q: "Hacerse pasar por el CEO en un email explota el principio de:", o: ["Escasez", "Autoridad", "Reciprocidad"], c: 1 },
  { q: "SPF, DKIM y DMARC sirven para:", o: ["Cifrar el disco", "Autenticar el email y frenar spoofing", "Escanear adjuntos"], c: 1 },
  { q: "Las reglas YARA sirven para:", o: ["Cifrar malware", "Identificar malware por patrones", "Acelerar la VM"], c: 1 },
  { q: "Las APIs importadas (IAT) de un binario revelan:", o: ["Su precio", "Sus capacidades (inyección, red, cifrado)", "Su icono"], c: 1 },
  { q: "Según el orden de volatilidad forense, primero se captura:", o: ["El disco", "La RAM", "Los backups"], c: 1 },
  { q: "El framework Volatility se usa para forense de:", o: ["Disco", "Memoria (RAM)", "Red"], c: 1 },

  // ── Blue Team / Cloud / Programación ──
  { q: "El corazón de un SOC que correlaciona logs y alerta es el:", o: ["Firewall", "SIEM", "Proxy"], c: 1 },
  { q: "El ciclo de respuesta a incidentes (NIST 800-61) comienza con:", o: ["Recuperación", "Preparación", "Erradicación"], c: 1 },
  { q: "En la nube, la causa #1 de brechas suele ser:", o: ["Fallas del proveedor", "Misconfiguración del cliente (ej: S3 público)", "Ataques cuánticos"], c: 1 },
  { q: "Una ventaja de Go para herramientas de seguridad es:", o: ["Necesita intérprete", "Binarios estáticos y cross-compilation", "Solo corre en Linux"], c: 1 },
];

export const EXAM_PASS_RATIO = 0.7;
