import type { QuizQuestion } from "./types";

// Quizzes keyed by lesson id. Each one is short (4-5 questions) so users can
// finish in a couple minutes. `c` is the index of the correct option in `o`.
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
};

export function getQuiz(lessonId: number): QuizQuestion[] | undefined {
  return QUIZZES[lessonId];
}
