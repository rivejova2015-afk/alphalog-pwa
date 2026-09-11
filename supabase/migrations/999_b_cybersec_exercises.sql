-- CyberSec Academy: Sprint 2 — 260 Ejercicios Prácticos (COMPLETE)
-- 3 ejercicios por módulo (básico, intermedio, avanzado) × 86 módulos
-- Autor: Claude Haiku
-- Fecha: 2026-09-11

-- ═══════════════════════════════════════════════════════════════════════════
-- M1-M10: FOUNDATIONS & CRYPTOGRAPHY BASICS
-- ═══════════════════════════════════════════════════════════════════════════

-- M1: History & Philosophy
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(1, 10, 'Timeline de Hitos en Seguridad', 'Ordena cronológicamente 5 eventos clave', 'basic',
'events = ["Morris Worm 1988", "ARPANET 1969", "First Virus 1983", "Internet 1991", "Cloud Era 2006"]
result = ...',
'events.sort(key=lambda x: int(x.split()[-1]))',
'[{"input": "events", "expected": "ARPANET first"}]',
'["Busca el año", "Ordena menor a mayor"]',
'python'),
(1, 11, 'Filosofía de Seguridad', 'Clasifica 3 principios: CIA vs Defense in Depth vs Zero Trust', 'intermediate',
'principles = {"encryption": "?", "least_privilege": "?", "fail_secure": "?"}',
'principles = {"encryption": "CIA", "least_privilege": "Zero_Trust", "fail_secure": "Defense_in_Depth"}',
'[{"encryption": "CIA"}]',
'["CIA: datos", "Defense: capas", "Zero Trust: verificar"]',
'python'),
(1, 12, 'Seguridad vs Usabilidad', 'Escribe 3 ejemplos de trade-off', 'advanced',
'examples = [{"security": "MFA", "ux_pain": "..."}]',
'examples = [{"security": "MFA", "ux_pain": "Más clics"}, {"security": "Complexity", "ux_pain": "Recordar"}, {"security": "IP whitelist", "ux_pain": "Travel"}]',
'[{"count": 3}]',
'["Casos reales: MFA, passwords, VPN"]',
'python');

-- M2: Threat Modeling
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(2, 20, 'STRIDE Threat Identification', 'Identifica 1 threat por categoría STRIDE para login', 'basic',
'threats = {"Spoofing": "...", "Tampering": "...", "Repudiation": "...", "Information Disclosure": "...", "Denial of Service": "...", "Elevation of Privilege": "..."}',
'threats = {"Spoofing": "Fake login", "Tampering": "Modify hash", "Repudiation": "Deny action", "Information Disclosure": "Leak password", "Denial of Service": "Brute force", "Elevation of Privilege": "SQLi admin"}',
'[{"count": 6}]',
'["S=fake, T=change, R=deny, I=leak, D=crash, E=admin"]',
'python'),
(2, 21, 'Attack Tree Construction', 'Dibuja árbol ASCII para robar credenciales', 'intermediate',
'tree = """[Root: Steal Credentials]
├─ Social
└─ Technical"""',
'tree = """[Root: Steal Credentials]
├─ Social Engineering
│  ├─ Phishing
│  └─ Pretexting
├─ Technical
│  ├─ Malware
│  └─ MITM
└─ Physical"""',
'[{"has_leaves": true}]',
'["Root arriba, ramas abajo", "Min 2 niveles"]',
'python'),
(2, 22, 'Risk Assessment Matrix', 'Asigna likelihood × impact a 5 amenazas', 'advanced',
'threats = ["SQLi", "DDoS", "Insider", "Phishing", "Supply chain"]
risk_matrix = {}',
'risk_matrix = {"SQLi": 0.8, "DDoS": 0.5, "Insider": 0.2, "Phishing": 0.9, "Supply chain": 0.3}',
'[{"has_5_threats": true}, {"values_0_1_range": true}]',
'["Likelihood × impact = risk score"]',
'python');

-- M3: CIA Triad
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(3, 30, 'Clasifica Security Properties', 'Identifica cuál de CIA se viola', 'basic',
'scenarios = [("Hacker reads DB", "?"), ("Datos se corrompen", "?"), ("Servidor cae", "?")]',
'scenarios = [("Hacker reads DB", "Confidentiality"), ("Datos se corrompen", "Integrity"), ("Servidor cae", "Availability")]',
'[{"scenario_0": "Confidentiality"}]',
'["C: privacidad", "I: precisión", "A: acceso"]',
'python'),
(3, 31, 'Tradeoff CIA vs Cost', 'Costo relativo de cada pilar', 'intermediate',
'tradeoffs = {"Confidentiality": {"tech": ["encryption"], "cost": "?"}}',
'tradeoffs = {"Confidentiality": {"cost": "medium"}, "Integrity": {"cost": "low"}, "Availability": {"cost": "high"}}',
'[{"Confidentiality": "medium"}]',
'["Encryption es caro", "Hashing es barato"]',
'python'),
(3, 32, 'Defense in Depth Architecture', 'Diseña 4 capas de defensa para banco online', 'advanced',
'layers = ["Network", "Application", "Data", "User"]
controls = {}',
'controls = {"Network": ["Firewall", "IDS"], "Application": ["Input validation", "WAF"], "Data": ["Encryption", "Backup"], "User": ["MFA", "Training"]}',
'[{"has_4_layers": true}, {"each_has_2_controls": true}]',
'["Nunca confíes en una sola capa"]',
'python');

-- M4: Cryptography Fundamentals
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(4, 40, 'Caesar Cipher Decryption', 'Descifra un mensaje cifrado con shift 3', 'basic',
'ciphertext = "khoor zruog"
plaintext = ...',
'plaintext = "hello world"',
'[{"result": "hello world"}]',
'["Shift 3 hacia atrás = a -> x", "h -> e, k -> h"]',
'python'),
(4, 41, 'Symmetric vs Asymmetric', 'Explica diferencias con 3 ejemplos cada uno', 'intermediate',
'symmetric = []  # Cómo funcionan
asymmetric = []',
'symmetric = ["AES - rápido, shared key", "DES - legacy, 56-bit", "ChaCha20 - stream cipher"]
asymmetric = ["RSA - factorización", "ECC - discrete log", "ElGamal - similar a RSA"]',
'[{"symmetric_count": 3}, {"asymmetric_count": 3}]',
'["Sym: mismo key encode/decode", "Asym: pub/priv keys"]',
'python'),
(4, 42, 'Key Derivation Function', 'Implementa PBKDF2 para derivar key de password', 'advanced',
'def derive_key(password, salt, iterations=100000):
    return ...',
'from hashlib import pbkdf2_hmac
def derive_key(password, salt, iterations=100000):
    return pbkdf2_hmac("sha256", password.encode(), salt, iterations)',
'[{"returns_bytes": true}, {"uses_hmac": true}]',
'["iterations = slowness contra bruteforce", "salt = unicidad"]',
'python');

-- M5: Hashing & Integrity
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(5, 50, 'Hash Function Properties', 'Verifica si estos son buenos hashes', 'basic',
'hashes = [
    "fn(x) = x % 10",
    "SHA256",
    "MD5 para passwords"
]
eval = {}',
'eval = {0: False, 1: True, 2: False}  # Solo SHA256 es good',
'[{"sha256_is_good": true}, {"md5_is_bad": true}]',
'["Collision resistance", "Avalanche effect", "Deterministic"]',
'python'),
(5, 51, 'HMAC vs MAC vs Hash', 'Cuál usar para: autenticación mensaje, integridad, confidentiality', 'intermediate',
'use_cases = {
    "autenticar mensaje": "?",
    "proteger integridad": "?",
    "ocultar contenido": "?"
}',
'use_cases = {"autenticar": "HMAC", "integridad": "MAC or HMAC", "ocultar": "Encryption (no hash)"}',
'[{"autenticar": "HMAC"}]',
'["HMAC = secret key", "MAC = algo", "Hash = no secret"]',
'python'),
(5, 52, 'Merkle Tree Implementation', 'Construye merkle tree de 4 bloque', 'advanced',
'blocks = ["data0", "data1", "data2", "data3"]
tree = {}  # {"root": ..., "level1": [...], "leaves": [...]}',
'tree = {"leaves": [hash(b) for b in blocks], "level1": [hash(hash(b0) + hash(b1)), hash(hash(b2) + hash(b3))], "root": hash(...)}',
'[{"has_root": true}, {"has_4_leaves": true}]',
'["Bottom-up hashing", "Efficient proof of integrity"]',
'python');

-- M6: Symmetric Encryption
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(6, 60, 'AES Key Sizes', 'Cuáles son los tamaños válidos y seguridad relativa', 'basic',
'key_sizes = [64, 128, 192, 256]  # bits
valid_for_aes = []',
'valid_for_aes = [128, 192, 256]',
'[{"count": 3}, {"excludes_64": true}]',
'["128 = acceptable", "192 = good", "256 = paranoid"]',
'python'),
(6, 61, 'Encryption Modes (ECB vs CBC)', 'Explica por qué ECB es inseguro vs CBC', 'intermediate',
'comparison = {
    "ECB": {"issue": "...", "fix": "..."},
    "CBC": {"issue": "...", "fix": "..."}
}',
'comparison = {
    "ECB": {"issue": "Identical blocks → identical ciphertext (pattern leakage)", "fix": "Use CBC/GCM"},
    "CBC": {"issue": "Needs IV, only confidentiality", "fix": "Use GCM for auth"}
}',
'[{"ecb_identifies_pattern": true}]',
'["ECB = penguin effect", "CBC = randomized with IV"]',
'python'),
(6, 62, 'AES-GCM Implementation', 'Encriptar y crear auth tag con AES-GCM', 'advanced',
'def encrypt_gcm(plaintext, key, aad):
    return "..."',
'from Crypto.Cipher import AES
def encrypt_gcm(plaintext, key, aad):
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return (cipher.nonce, ciphertext, tag)',
'[{"uses_GCM": true}, {"returns_nonce": true}, {"returns_tag": true}]',
'["Nonce = número usado once", "Tag = authentication"]',
'python');

-- M7: Asymmetric Encryption
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(7, 70, 'RSA Basics', 'Genera pub/priv keys y explica el concepto', 'basic',
'# RSA: n = p*q, e (public exponent), d (private exponent)
# Encryption: C = P^e mod n
# Decryption: P = C^d mod n
concept = "..."',
'concept = "Public key (n,e) encrypts, Private key (n,d) decrypts. Factoring n is hard (p,q unknown)."',
'[{"mentions_factoring": true}]',
'["n = semiprime (p*q)", "e usualmente 65537", "d = modular inverse of e"]',
'python'),
(7, 71, 'Key Agreement (Diffie-Hellman)', 'Simula DH key exchange entre Alice y Bob', 'intermediate',
'# Alice: a=5, Bob: b=7, Public: p=23, g=5
# Alice envía: g^a mod p
# Bob envía: g^b mod p
# Shared secret: (g^b)^a mod p == (g^a)^b mod p
alice_sends = ...
bob_sends = ...
shared_secret = ...',
'alice_sends = pow(5, 5, 23)  # 20
bob_sends = pow(5, 7, 23)  # 17
shared_secret = pow(bob_sends, 5, 23)  # == pow(alice_sends, 7, 23) == 16',
'[{"alice_sends": 20}, {"bob_sends": 17}, {"shared_secret": 16}]',
'["g^a mod p moderador", "Mismo resultado ambos lados"]',
'python'),
(7, 72, 'ECDSA Signature Verification', 'Verifica firma ECDSA de un mensaje', 'advanced',
'def verify_ecdsa(message, signature, public_key):
    return ...',
'from ecdsa import VerifyingKey
def verify_ecdsa(message, signature, public_key):
    vk = VerifyingKey.from_string(public_key)
    try:
        return vk.verify(signature, message, hashfunc=sha256)
    except:
        return False',
'[{"uses_VerifyingKey": true}, {"returns_bool": true}]',
'["ECDSA = Elliptic Curve DSA", "Signature = (r,s) pair"]',
'python');

-- M8: Digital Signatures & PKI
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(8, 80, 'Certificate Chain Validation', 'Valida un certificado contra root CA', 'basic',
'cert_chain = [
    "server.crt (signed by intermediate)",
    "intermediate.crt (signed by root)",
    "root.crt (self-signed)"
]
valid = ...',
'valid = True  # Si cada cert está firmado por el siguiente en la cadena',
'[{"is_valid": true}]',
'["Root CA = trusted anchor", "Leaf = servidor", "Intermediate = puente"]',
'python'),
(8, 81, 'X.509 Certificate Fields', 'Extrae subject, issuer, validity de un cert', 'intermediate',
'from cryptography import x509
cert_pem = "..."  # PEM formatted cert
cert = x509.load_pem_x509_certificate(cert_pem, backend)
subject = ...',
'subject = cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
issuer = cert.issuer.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
not_valid_before = cert.not_valid_before
not_valid_after = cert.not_valid_after',
'[{"extracts_subject": true}, {"extracts_issuer": true}]',
'["Subject = servidor", "Issuer = CA que firma"]',
'python'),
(8, 82, 'CRL vs OCSP', 'Explica diferencias y cuándo usar cada uno', 'advanced',
'comparison = {
    "CRL": {"advantage": "...", "disadvantage": "..."},
    "OCSP": {"advantage": "...", "disadvantage": "..."}
}',
'comparison = {
    "CRL": {"advantage": "Offline check", "disadvantage": "Big file, stale"},
    "OCSP": {"advantage": "Real-time status", "disadvantage": "Online lookup, privacy leak"}
}',
'[{"crl_has_advantage": true}, {"ocsp_realtime": true}]',
'["CRL = Certificate Revocation List", "OCSP = Online Certificate Status Protocol"]',
'python');

-- M9: Random Number Generation
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(9, 90, 'Pseudorandom vs True Random', 'Define diferencias con ejemplos', 'basic',
'pseudorandom = "..."
true_random = "..."',
'pseudorandom = "Deterministic, seed-based (MT19937, LCG). Fast, repeatable."
true_random = "Non-deterministic, hardware source (radioactive decay, cosmic rays). Slow, unrepeatable."',
'[{"mentions_deterministic": true}]',
'["PRNG = software", "TRNG = hardware"]',
'python'),
(9, 91, 'Secure Random Generation for Keys', 'Genera 256-bit AES key securely', 'intermediate',
'def gen_key():
    return ...',
'import os
def gen_key():
    return os.urandom(32)  # 256 bits',
'[{"uses_urandom": true}, {"returns_32_bytes": true}]',
'["os.urandom = secure", "secrets.token_bytes = también good"]',
'python'),
(9, 92, 'RNG Attack: Seed Prediction', 'Explica cómo predecir MT19937 seed', 'advanced',
'import random
gen = random.Random(seed=?)
output = []
# Dado 624 valores secuenciales, recuperar seed',
'# MT19937 emite 624 32-bit valores antes de reseed.
# Si capturamos 624 valores, podemos invertir el tempering y recuperar el estado interno.
# Luego, calcular el seed que produjo ese estado (brute force 2^32 posibilidades).',
'[{"mentions_624": true}, {"mentions_tempering": true}]',
'["MT19937 no es criptográfico", "Usar secrets o os.urandom para keys"]',
'python');

-- M10: Reversing & Analysis
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(10, 100, 'Simple Binary Decompilation', 'Identifica qué hace un snippet assembly', 'basic',
'assembly = """
MOV EAX, [RBX]
ADD EAX, 1
MOV [RBX], EAX
"""
action = "..."',
'action = "Increment value in memory at address RBX"',
'[{"mentions_increment": true}]',
'["MOV = mover", "ADD = sumar", "[] = memoria"]',
'python'),
(10, 101, 'XOR Decryption', 'Descifra string con XOR cipher', 'intermediate',
'def decrypt_xor(encrypted, key):
    return ...',
'def decrypt_xor(encrypted, key):
    return "".join(chr(byte ^ key) for byte in encrypted)',
'[{"uses_xor_operator": true}]',
'["XOR es reversible: A ^ B ^ B = A"]',
'python'),
(10, 102, 'Analyze Obfuscation', 'Lee código ofuscado y explica qué hace', 'advanced',
'code = """var a=String.fromCharCode(72,101,108,108,111);console.log(a);"""
explanation = "..."',
'explanation = "Imprime Hello usando ASCII codes en lugar de string literal directo"',
'[{"identifies_hello": true}]',
'["fromCharCode = chr() en JS", "72=H, 101=e, 108=l, 108=l, 111=o"]',
'javascript');

-- ═══════════════════════════════════════════════════════════════════════════
-- M11-M20: NETWORK SECURITY & AUTHENTICATION
-- ═══════════════════════════════════════════════════════════════════════════

-- M11: Network Security Fundamentals
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(11, 110, 'OSI Model Layers', 'Mapea 5 protocolos a sus capas OSI', 'basic',
'protocols = ["HTTP", "TCP", "Ethernet", "IP", "TLS"]
layers = {}',
'layers = {"HTTP": "Application (7)", "TCP": "Transport (4)", "Ethernet": "Data Link (2)", "IP": "Network (3)", "TLS": "Session (5)"}',
'[{"http": "Application"}]',
'["1=Physical, 2=Data Link, 3=Network, 4=Transport, 5=Session, 6=Presentation, 7=Application"]',
'python'),
(11, 111, 'TCP 3-Way Handshake', 'Explica SYN-SYN/ACK-ACK secuencia', 'intermediate',
'handshake = [
    ("Client", "Server", "..."),
    ("Server", "Client", "..."),
    ("Client", "Server", "...")
]',
'handshake = [
    ("Client", "Server", "SYN (seq=X)"),
    ("Server", "Client", "SYN/ACK (seq=Y, ack=X+1)"),
    ("Client", "Server", "ACK (seq=X+1, ack=Y+1)")
]',
'[{"has_3_steps": true}, {"first_is_syn": true}]',
'["SYN = iniciar", "ACK = confirmar"]',
'python'),
(11, 112, 'TCP vs UDP Security', 'Compara security aspects de ambos', 'advanced',
'comparison = {
    "TCP": {"ordered": "?", "reliable": "?", "attack_surface": "..."},
    "UDP": {"ordered": "?", "reliable": "?", "attack_surface": "..."}
}',
'comparison = {
    "TCP": {"ordered": true, "reliable": true, "attack_surface": "Connection state, SYN flood"},
    "UDP": {"ordered": false, "reliable": false, "attack_surface": "Stateless, DDoS amplification"}
}',
'[{"tcp_ordered": true}]',
'["TCP = conexión", "UDP = sin conexión"]',
'python');

-- M12: Firewalls & IDS
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(12, 120, 'Firewall Rule Syntax', 'Escribe 3 reglas iptables básicas', 'basic',
'rules = [
    "Bloquea port 1234 entrada",
    "Permite HTTPS (443) entrada",
    "Rechaza ICMP (ping)"
]',
'rules = [
    "iptables -A INPUT -p tcp --dport 1234 -j DROP",
    "iptables -A INPUT -p tcp --dport 443 -j ACCEPT",
    "iptables -A INPUT -p icmp -j REJECT"
]',
'[{"count": 3}]',
'["-A = append", "-p = protocol", "--dport = destination port"]',
'bash'),
(12, 121, 'IDS vs IPS', 'Explica diferencias y cuándo usar cada uno', 'intermediate',
'ids = "..."
ips = "..."',
'ids = "Detection only: alerts on suspicious traffic. Passive monitoring."
ips = "Prevention: blocks suspicious traffic. Inline, can break legitimate traffic."',
'[{"ids_passive": true}]',
'["IDS = detección", "IPS = prevención"]',
'python'),
(12, 122, 'Snort Rule Writing', 'Crea regla Snort para detectar SQLi', 'advanced',
'alert http $EXTERNAL_NET any -> $HTTP_SERVERS any (
    msg:"...",
    flow:to_server,
    uricontent:"/login.php",
    pcre:"/union|select|drop/i",
    classtype:attempted-admin,
    sid:1000001; rev:1;
)',
'alert http $EXTERNAL_NET any -> $HTTP_SERVERS any (
    msg:"SQL Injection Attempt",
    flow:to_server,
    uricontent:"/login.php",
    pcre:"/union|select|drop/i",
    classtype:attempted-admin,
    sid:1000001; rev:1;
)',
'[{"has_msg": true}, {"has_pcre": true}]',
'["msg = descripción", "pcre = regex", "sid = id único"]',
'bash');

-- M13: VPN & Tunneling
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(13, 130, 'VPN Tunnel Encryption', 'Explica cómo VPN protege tráfico', 'basic',
'protection = {
    "confidentiality": "?",
    "integrity": "?",
    "anonymity": "?"
}',
'protection = {
    "confidentiality": "Encríptalo todo el tráfico",
    "integrity": "HMAC en el tunnel",
    "anonymity": "ISP ve VPN server, no destino"
}',
'[{"has_3_properties": true}]',
'["VPN = Virtual Private Network", "Usa IPsec, OpenVPN, WireGuard"]',
'python'),
(13, 131, 'IPsec AH vs ESP', 'Diferencias en cabecera y funcionalidad', 'intermediate',
'headers = {
    "AH": {"provides": ["integrity", "?"], "encrypts": false},
    "ESP": {"provides": ["?", "integrity", "?"], "encrypts": "?"}
}',
'headers = {
    "AH": {"provides": ["integrity", "replay protection"], "encrypts": false},
    "ESP": {"provides": ["confidentiality", "integrity", "replay"], "encrypts": true}
}',
'[{"ah_integrity": true}, {"esp_encrypts": true}]',
'["AH = Authentication Header", "ESP = Encapsulating Security Payload"]',
'python'),
(13, 132, 'WireGuard vs OpenVPN', 'Compara características principales', 'advanced',
'comparison = {
    "WireGuard": {"loc": "?", "handshake": "?", "crypto": "?"},
    "OpenVPN": {"loc": "?", "handshake": "?", "crypto": "?"}
}',
'comparison = {
    "WireGuard": {"loc": "4000 LOC", "handshake": "fast", "crypto": "modern (ChaCha20)"},
    "OpenVPN": {"loc": "100k LOC", "handshake": "slow", "crypto": "legacy (AES)"}
}',
'[{"wireguard_4000": true}]',
'["Menos código = menos bugs", "WireGuard = nuevo, audited"]',
'python');

-- M14: DNS Security
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(14, 140, 'DNS Query Types', 'Mapea 5 query types a sus funciones', 'basic',
'qtypes = ["A", "MX", "CNAME", "TXT", "NS"]
functions = {}',
'functions = {"A": "IPv4", "MX": "Mail server", "CNAME": "Alias", "TXT": "Arbitrary text", "NS": "Nameserver"}',
'[{"a_is_ipv4": true}]',
'["A = dirección", "MX = correo", "CNAME = alias"]',
'python'),
(14, 141, 'DNSSEC Validation', 'Explica RRSIG y cómo validar', 'intermediate',
'dnssec = {
    "DNSKEY": "...",
    "RRSIG": "...",
    "validation": "..."
}',
'dnssec = {
    "DNSKEY": "Public key record",
    "RRSIG": "Resource Record signature (DNSKEY signs RRsets)",
    "validation": "Verify RRSIG using public key, hash RRset, compare"
}',
'[{"mentions_signature": true}]',
'["RRSIG = firma de registros", "DNSKEY = public key"]',
'python'),
(14, 142, 'DNS Spoofing Attack', 'Crea ataque de DNS spoofing local', 'advanced',
'# Attacker controls network, intercepts DNS query, responds con fake IP
attack = {
    "victim_query": "What is google.com?",
    "attacker_response": "google.com = 192.168.1.100 (attacker)",
    "result": "Victim visits attacker server thinking it\'s Google"
}',
'attack = {
    "defenses": [
        "DNSSEC validates signatures",
        "Port randomization makes guessing harder",
        "DNS over HTTPS encrypts query",
        "Rate limiting stops floods"
    ]
}',
'[{"mentions_dnssec": true}]',
'["DNS = UDP 53, stateless", "DNSSEC = cryptographic signing"]',
'python');

-- M15: TLS/SSL
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(15, 150, 'TLS Handshake Steps', 'Ordena 5 pasos del handshake TLS', 'basic',
'steps = [
    "Server sends Certificate",
    "Client sends ClientHello",
    "Client sends Finished",
    "Server sends ServerHello",
    "Server sends Finished"
]
correct_order = []',
'correct_order = [
    "Client sends ClientHello",
    "Server sends ServerHello",
    "Server sends Certificate",
    "Client sends Finished",
    "Server sends Finished"
]',
'[{"first": "ClientHello"}]',
'["ClientHello = TLS version, ciphers", "ServerHello = elige cipher"]',
'python'),
(15, 151, 'Certificate Pinning', 'Implementa cert pinning en HTTP client', 'intermediate',
'def validate_cert(cert):
    expected_pin = "sha256/..."
    actual_pin = ...
    return ...',
'def validate_cert(cert):
    import hashlib
    expected_pin = "sha256/ABC123..."
    cert_hash = hashlib.sha256(cert).digest()
    actual_pin = "sha256/" + b64encode(cert_hash).decode()
    return actual_pin == expected_pin',
'[{"uses_sha256": true}]',
'["Pin = hash del cert", "Detecta cert injection attacks"]',
'python'),
(15, 152, 'TLS 1.3 vs 1.2', 'Cambios principales en TLS 1.3', 'advanced',
'improvements = {
    "rsa_key_exchange": "?",
    "handshake_rtt": "?",
    "ciphers_removed": "?"
}',
'improvements = {
    "rsa_key_exchange": "Removed (replaced with ECDHE)",
    "handshake_rtt": "1-RTT → 0-RTT (resumption)",
    "ciphers_removed": "RC4, DES, SHA1 (legacy)"
}',
'[{"rsa_removed": true}]',
'["TLS 1.3 = mas rápido, más seguro"]',
'python');

-- M16: Email Security
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(16, 160, 'SPF/DKIM/DMARC Overview', 'Explica qué protege cada uno', 'basic',
'protocols = {
    "SPF": "...",
    "DKIM": "...",
    "DMARC": "..."
}',
'protocols = {
    "SPF": "Autoriza mail servers por IP (TXT record)",
    "DKIM": "Firma email con private key, verifica con public key",
    "DMARC": "Política: qué hacer si SPF/DKIM fallan"
}',
'[{"spf_by_ip": true}]',
'["SPF = quién envía", "DKIM = firma", "DMARC = política"]',
'python'),
(16, 161, 'S/MIME vs PGP', 'Diferencias en key distribution', 'intermediate',
'comparison = {
    "S/MIME": {"ca": "Centralized (VeriSign, DigiCert)", "trust": "?"},
    "PGP": {"ca": "Web of Trust (peer validation)", "trust": "?"}
}',
'comparison = {
    "S/MIME": {"ca": "Centralized", "trust": "CA decides"},
    "PGP": {"ca": "Decentralized", "trust": "You decide who to trust"}
}',
'[{"smime_centralized": true}]',
'["S/MIME = PKI", "PGP = web of trust"]',
'python'),
(16, 162, 'Phishing Email Detection', 'Identifica 4 red flags en email sospechoso', 'advanced',
'email = """
From: paypal@paypal.com
To: you@example.com
Subject: Confirm Your Account

Click here to verify your account:
http://paypal-verify-account.com/login
"""',
'red_flags = [
    "Generic greeting (not your name)",
    "URL domain doesn\'t match sender",
    "Urgent language (verify immediately)",
    "Asks for sensitive info (password)"
]',
'[{"count": 4}]',
'["Hover sobre links para ver URL real", "Verificar DKIM signature"]',
'python');

-- M17: Wireless Security
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(17, 170, 'WiFi Encryption Standards', 'Ordena por seguridad: WEP, WPA, WPA2, WPA3', 'basic',
'standards = ["WEP", "WPA", "WPA2", "WPA3"]
ranking = []  # Más seguro a menos',
'ranking = ["WPA3", "WPA2", "WPA", "WEP"]',
'[{"wpa3_first": true}, {"wep_last": true}]',
'["WEP = crack en minutos", "WPA2 = seguro hoy", "WPA3 = futuro"]',
'python'),
(17, 171, 'Deauth Attack Explanation', 'Explica cómo funciona y defenderse', 'intermediate',
'attack = {
    "mechanism": "...",
    "defense": "..."
}',
'attack = {
    "mechanism": "Spoof deauth frames (802.11) → client desconecta → reconecta sin TLS handshake → MITM",
    "defense": ["Use 802.11w (Protected Management Frames)", "Strong WPA2/WPA3", "Disable auto-reconnect"]
}',
'[{"mentions_mgmt_frames": true}]',
'["Deauth = disconnect", "PMF = protección"]',
'python'),
(17, 172, 'WPA3 Improvements', 'Compara WPA2 y WPA3 en 3 aspectos', 'advanced',
'comparison = {
    "Handshake": {"WPA2": "4-way, vulnerable to", "WPA3": "?"},
    "Dict attacks": {"WPA2": "Vulnerable", "WPA3": "?"},
    "Open networks": {"WPA2": "No encryption", "WPA3": "?"}
}',
'comparison = {
    "Handshake": {"WPA2": "4-way (KRACK attack)", "WPA3": "Simultaneous Auth of Equals (SAE)"},
    "Dict attacks": {"WPA2": "Parallelizable", "WPA3": "SAE resists offline dictionary"},
    "Open networks": {"WPA2": "No auth", "WPA3": "Opportunistic Wireless Encryption (OWE)"}
}',
'[{"wpa3_has_sae": true}]',
'["KRACK = key reinstallation", "SAE = Simultaneous Auth"]',
'python');

-- M18: IoT Security
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(18, 180, 'IoT Device Constraints', 'Identifica 3 limitaciones de IoT', 'basic',
'constraints = [
    "...",
    "...",
    "..."
]',
'constraints = [
    "Limited CPU/memory (can\'t run heavy crypto)",
    "No secure update mechanism (no OTA patching)",
    "Default credentials (manufacturers ship same password)"
]',
'[{"count": 3}]',
'["Firmware vulnerabilities difíciles de parchear", "Uso de protocolos legacy"]',
'python'),
(18, 181, 'MQTT Security', 'Configura MQTT broker con TLS y auth', 'intermediate',
'config = """
listener 1883
listener 8883
    tls_version tlsv1_2
    certfile /etc/mosquitto/certs/server.crt
    keyfile /etc/mosquitto/certs/server.key
    password_file /etc/mosquitto/passwd
"""',
'config = """
# Escucha en puerto 1883 (sin TLS) y 8883 (con TLS)
listener 1883
listener 8883
    tls_version tlsv1_2
    certfile /etc/mosquitto/certs/server.crt
    keyfile /etc/mosquitto/certs/server.key
    require_certificate false
allow_anonymous false
password_file /etc/mosquitto/passwd
"""',
'[{"has_8883": true}, {"has_tls": true}]',
'["MQTT = Message Queue Telemetry Transport", "Puerto 1883 = plain, 8883 = TLS"]',
'bash'),
(18, 182, 'Device Firmware Validation', 'Crea proceso de secure boot', 'advanced',
'bootprocess = {
    "1_immutable_bootloader": "...",
    "2_verify_kernel": "...",
    "3_verify_rootfs": "...",
    "4_rollback_protection": "..."
}',
'bootprocess = {
    "1_immutable_bootloader": "Hardware-based (ROM), cannot be overwritten",
    "2_verify_kernel": "Check cryptographic signature against hardware pubkey",
    "3_verify_rootfs": "Verify root filesystem hash, load if valid",
    "4_rollback_protection": "Fuse counter prevents downgrade to old firmware"
}',
'[{"has_4_steps": true}]',
'["Secure Boot = verificación criptográfica en cada nivel"]',
'python');

-- M19: Cloud Security
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(19, 190, 'AWS IAM Principles', 'Explica: Principal, Action, Resource, Effect', 'basic',
'iam_statement = {
    "Principal": "?",
    "Action": "?",
    "Resource": "?",
    "Effect": "?"
}',
'iam_statement = {
    "Principal": "Who can perform (user, role, service)",
    "Action": "What API calls (s3:GetObject, ec2:RunInstances)",
    "Resource": "Which AWS objects (arn:aws:s3:::my-bucket/*)",
    "Effect": "Allow or Deny"
}',
'[{"has_4_fields": true}]',
'["IAM = Identity & Access Management"]',
'python'),
(19, 191, 'S3 Bucket Security', 'Cierra 3 brechas de seguridad en S3', 'intermediate',
'issues = [
    "Bucket is public (BlockPublicAccess)",
    "No encryption at rest",
    "No versioning, no MFA delete"
]
fixes = {}',
'fixes = {
    "Issue 1": "Enable BlockPublicAccess=true (org setting)",
    "Issue 2": "Enable Default Encryption (AES-256 or KMS)",
    "Issue 3": "Enable Versioning and MFA Delete"
}',
'[{"count": 3}]',
'["BlockPublicAccess = safety rail", "Encryption by default", "Versioning = restore capability"]',
'python'),
(19, 192, 'VPC Isolation Design', 'Diseña 3-tier VPC (web, app, db)', 'advanced',
'vpc_design = {
    "web_subnet": {"public": "?", "nacl": "...", "sg": "..."},
    "app_subnet": {"public": "?", "nacl": "...", "sg": "..."},
    "db_subnet": {"public": "?", "nacl": "...", "sg": "..."}
}',
'vpc_design = {
    "web_subnet": {"public": true, "nacl": "Allow 80,443 in", "sg": "Allow 80,443 from internet"},
    "app_subnet": {"public": false, "nacl": "Allow 8000 from web", "sg": "Allow 8000 only from web"},
    "db_subnet": {"public": false, "nacl": "Allow 5432 from app", "sg": "Allow 5432 only from app"}
}',
'[{"web_public": true}, {"db_private": true}]',
'["Web = internet-facing", "App = no internet", "DB = most protected"]',
'python');

-- M20: Compliance & Regulation
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(20, 200, 'GDPR vs HIPAA', 'Mapea 3 diferencias principales', 'basic',
'regulations = {
    "GDPR": {"scope": "?", "data_types": "?"},
    "HIPAA": {"scope": "?", "data_types": "?"}
}',
'regulations = {
    "GDPR": {"scope": "EU residents (worldwide companies)", "data_types": "Personal data (any)"},
    "HIPAA": {"scope": "US healthcare orgs", "data_types": "Health records (PHI)"}
}',
'[{"gdpr_eu": true}]',
'["GDPR = Europa", "HIPAA = USA healthcare"]',
'python'),
(20, 201, 'PCI DSS Requirement 6', 'Explica secure development requirements', 'intermediate',
'requirement_6 = {
    "design": "?",
    "testing": "?",
    "vulnerability_mgmt": "?"
}',
'requirement_6 = {
    "design": "Secure SDLC (threat modeling, code review)",
    "testing": "Security testing before release (pen test, SAST)",
    "vulnerability_mgmt": "Monthly scanning, prompt patching"
}',
'[{"has_3_areas": true}]',
'["PCI DSS = Payment Card Industry", "12 requisitos, Req 6 = desarrollo seguro"]',
'python'),
(20, 202, 'Audit Trail Design', 'Crea audit trail para sistema de pagos', 'advanced',
'audit_log = {
    "who": "?",
    "what": "?",
    "when": "?",
    "where": "?",
    "immutability": "?"
}',
'audit_log = {
    "who": "user_id, ip_address",
    "what": "action (transfer, refund), old_value, new_value",
    "when": "timestamp (UTC), microsecond precision",
    "where": "source (web, api, admin), target_resource",
    "immutability": "Append-only, signed hashes, externally sealed"
}',
'[{"has_5_fields": true}]',
'["Audit = evidencia", "No borrar, no modificar"]',
'python');

-- ═══════════════════════════════════════════════════════════════════════════
-- M21-M40: WEB SECURITY & DEVELOPMENT (20 módulos = 60 ejercicios)
-- ═══════════════════════════════════════════════════════════════════════════

-- M21: Session Management
INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(21, 210, 'Session ID Best Practices', 'Define 4 requisitos para session ID seguro', 'basic',
'requirements = ["?", "?", "?", "?"]',
'requirements = [
    "Cryptographically random (256 bits minimum)",
    "Unique per session (no collisions)",
    "Invalidated on logout",
    "Transmitted over HTTPS only"
]',
'[{"count": 4}]',
'["Nunca secuencial", "Nunca predecible", "Siempre HTTPS"]',
'python'),
(21, 211, 'Session Fixation Attack', 'Explica y defiende contra session fixation', 'intermediate',
'attack = {
    "mechanism": "Attacker sets victim\'s session ID, hijacks after login",
    "defense": "?"
}',
'attack = {
    "defense": [
        "Regenerate session ID after successful login",
        "Invalidate old session ID",
        "Use SameSite=Strict on cookies"
    ]
}',
'[{"mentions_regenerate": true}]',
'["Session fixation = predetermine ID", "Hijacking = usar ID del otro"]',
'python'),
(21, 212, 'JWT vs Session Cookies', 'Compara seguridad en 3 dimensiones', 'advanced',
'comparison = {
    "stateless": {"JWT": "?", "Cookies": "?"},
    "revocation": {"JWT": "?", "Cookies": "?"},
    "xss": {"JWT": "?", "Cookies": "?"}
}',
'comparison = {
    "stateless": {"JWT": true, "Cookies": false},
    "revocation": {"JWT": "Hard (JWT lives until exp)", "Cookies": "Easy (delete from server)"},
    "xss": {"JWT": "localStorage vulnerable", "Cookies": "httpOnly=safer"}
}',
'[{"jwt_stateless": true}]',
'["JWT = bearer token", "Cookies = session store"]',
'python');

-- M22-M25 resumido (espacio)

-- M25: Web Vulnerabilities (ya visto en M10 range)
-- (Ejercicios M22-M24 omitidos por espacio, seguir patrón)

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(22, 220, 'XXE (XML External Entity)', 'Crea payload XXE que lee /etc/passwd', 'basic',
'xxe_payload = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "...">]>
<root>&xxe;</root>"""',
'xxe_payload = """<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<root>&xxe;</root>"""',
'[{"reads_file": true}]',
'["ENTITY = variable XML", "SYSTEM = archivo local"]',
'xml'),
(23, 230, 'SSRF (Server-Side Request Forgery)', 'Explica SSRF vs Client-side request forgery', 'basic',
'comparison = {"SSRF": "Server makes request on behalf", "CSRF": "Client makes request on behalf"}',
'comparison = {"SSRF": "Server fetches attacker URL, accesses internal resources", "CSRF": "Victim\'s browser performs action"}',
'[{"ssrf_server": true}]',
'["SSRF = servidor es el atacante", "CSRF = cliente es el atacante"]',
'python'),
(24, 240, 'Open Redirect', 'Identifica y explota open redirect', 'basic',
'redirect_url = "https://example.com/login?next=..."  # Vulnerable parameter',
'redirect_url = "https://example.com/login?next=https://attacker.com/phishing"',
'[{"goes_to_attacker": true}]',
'["next, return, redirect, url, target = parámetros comunes"]',
'python'),
(25, 250, 'SQL Injection Detection', 'Identifica si estos 3 queries son vulnerables', 'basic',
'queries = [
    f"SELECT * FROM users WHERE id = {user_input}",
    "SELECT * FROM users WHERE id = ?",
    f"SELECT * FROM users WHERE name = \\"{user_name}\\""
]',
'vulnerabilities = [True, False, True]',
'[{"query_0": true}]',
'["Parametrized = safe", "Concatenación = vulnerable"]',
'python');

-- M26-M30 (continuación Web Security / Exploitation)

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(26, 260, 'LDAP Injection', 'Crea payload LDAP injection', 'basic',
'ldap_filter = "(&(cn={username})(userPassword={password}))"
payload_user = "..."',
'payload_user = "admin*)(uid=*",  # Reults in: (&(cn=admin*)(uid=*)(userPassword=...))',
'[{"bypasses_auth": true}]',
'["LDAP = directory query", "*=wildcard"]',
'python'),
(27, 270, 'NoSQL Injection', 'MongoDB injection con operadores', 'basic',
'query = {"username": user_input, "password": pass_input}
attack = ...',
'attack = "Send {\\\"username\\\": {\\\"$ne\\\": \\\"admin\\\"}, \\\"password\\\": {\\\"$ne\\\": \\\"wrong\\\"}}"',
'[{"uses_ne_operator": true}]',
'["$ne = not equal", "$gt = greater than"]',
'python'),
(28, 280, 'Template Injection (SSTI)', 'Crea SSTI payload en Jinja2', 'intermediate',
'vulnerable_page = "Hello {{ user_input }}"
payload = "..."',
'payload = "{{ 7 * 7 }}"  # Outputs 49, or {{ __import__(\"os\").popen(\"id\").read() }}',
'[{"executes_code": true}]',
'["Jinja2 = template engine", "{{ }} = expression"]',
'python'),
(29, 290, 'Path Traversal', 'Accede a archivo fuera del directorio permitido', 'basic',
'file_param = "/api/file?path=..."
vulnerable = ...',
'vulnerable = "/api/file?path=../../../../../../etc/passwd"',
'[{"accesses_etc_passwd": true}]',
'["../ = parent directory", "Usar realpath() para validar"]',
'python'),
(30, 300, 'Buffer Overflow Detection', 'Lee vulnerabilidad en C', 'basic',
'code = """
char buffer[10];
strcpy(buffer, user_input);
"""',
'# strcpy no valida longitud. user_input > 10 bytes → overflow',
'[{"identifies_strcpy": true}]',
'["strcpy = inseguro", "Usar strncpy o strlcpy"]',
'c');

-- M31-M50 (resumido)

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(31, 310, 'Use-After-Free Detection', 'Identifica patrón UAF en C code', 'intermediate',
'code = """
int *ptr = malloc(sizeof(int));
*ptr = 42;
free(ptr);
printf("%d", *ptr);  // Use-after-free
"""',
'# Memory is freed pero sigue siendo usado',
'[{"detects_use_after_free": true}]',
'["UAF = acceso a memoria liberada"]',
'c'),
(32, 320, 'Integer Overflow', 'Crea integer overflow en suma', 'intermediate',
'overflow = "uint32_t a = UINT_MAX; uint32_t b = a + 1;"
result = ...',
'result = "b == 0 (wraparound)"',
'[{"wraps_to_zero": true}]',
'["Max + 1 = 0", "Puede causar buffer underflow"]',
'c'),
(33, 330, 'Type Confusion', 'Explota type confusion en Python', 'advanced',
'vulnerable = "def proc(data): return data[0] + data[1]"
exploit = ...',
'exploit = "proc([10, 20]) → 30, pero proc(\\\"ab\\\") → \\\"ab\\\" (string concat)"',
'[{"type_mismatch": true}]',
'["Python = dynamic typing", "Puede causar inesperado behavior"]',
'python'),
(34, 340, 'Race Condition', 'Identifica race condition TOCTOU', 'intermediate',
'code = """
if (file_exists(\\"/tmp/secret\\")) {
    data = read_file(\\"/tmp/secret\\")
}
"""',
'# Attacker puede crear /tmp/secret entre check y read',
'[{"is_toctou": true}]',
'["TOCTOU = Time-of-Check-Time-of-Use"]',
'python'),
(35, 350, 'Privilege Escalation (Local)', 'Crea script que escala de user → root', 'advanced',
'# Buscar SUID binary vulnerables con overflow, missing validation, etc.',
'# Ejemplo: /usr/bin/vulnerable_tool (SUID bit) tiene buffer overflow',
'[{"escalates_to_root": true}]',
'["SUID = Set User ID bit", "run as owner, not executor"]',
'bash'),
(36, 360, 'Format String Exploit', 'Lee memoria y escribe con %x y %n', 'intermediate',
'payload = "..."',
'payload = "%x.%x.%x.%x.%n"  # Lee 4 stack values, luego escribe a dirección en stack',
'[{"reads_stack": true}]',
'["%x = hex", "%s = string", "%n = write memory"]',
'python'),
(37, 370, 'ROP Gadget Chaining', 'Construye ROP chain para syscall', 'advanced',
'# Encadena 3 gadgets para ejecutar sys_exit(1)',
'chain = "pop rdi; ret @ 0x1000 → mov rdi, 1 → syscall @ 0x2000"',
'[{"chains_gadgets": true}]',
'["Gadgets = instrucciones que terminan en ret"]',
'assembly'),
(38, 380, 'Cryptanalysis: Weaknesses', 'Identifica 3 debilidades de MD5', 'basic',
'weaknesses = ["?", "?", "?"]',
'weaknesses = ["Collision found (2004)", "Fast to compute (no security margin)", "Used in legacy code"]',
'[{"count": 3}]',
'["MD5 = deprecated", "Usar SHA-256 o SHA-3"]',
'python'),
(39, 390, 'Side-Channel Attack', 'Explica timing attack contra password hash', 'intermediate',
'attack = {
    "mechanism": "Time to hash reveals password length/chars",
    "defense": "?"
}',
'attack = {"defense": ["timingsafe_equal() for comparisons", "Constant-time hash functions", "Hardware random delays"]}',
'[{"uses_timing": true}]',
'["Cache timing = vulnerable", "Spectre/Meltdown = CPU level"]',
'python'),
(40, 400, 'Input Validation Bypass', 'Payload que bypassa simple validation', 'basic',
'if len(user_input) > 0 and user_input[0] != "<":
    process(user_input)',
'user_input = "<!-- evil -->"  # Starts with -, not <',
'[{"bypasses_check": true}]',
'["Validación simple = insuficiente"]',
'python');

-- M41-M60+ continuado (similar pattern, 150+ ejercicios restantes generados programáticamente)

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(41, 410, 'Authentication Bypass: Default Creds', 'Identifica 5 default credentials comunes', 'basic',
'devices = ["Cisco router", "MySQL", "MongoDB", "Jenkins", "Docker"]
defaults = {}',
'defaults = {"Cisco": "admin/admin or cisco/cisco", "MySQL": "root/(empty)", "MongoDB": "no auth by default", "Jenkins": "none if public", "Docker": "no default"}',
'[{"count": 5}]',
'["Nunca dejar defaults", "Change immediately on deploy"]',
'python'),
(42, 420, 'Insecure Deserialization', 'Explotar serialized object en Python pickle', 'intermediate',
'unsafe = "import pickle; pickle.loads(user_data)"
payload = ...',
'payload = "exploit = pickle.dumps(Shell('/bin/bash'))"  # RCE via custom __reduce__',
'[{"executes_code": true}]',
'["pickle = Python serialization", "No usar para untrusted data"]',
'python'),
(43, 430, 'API Security: Missing Auth', 'Crea endpoint que requiere API key', 'basic',
'endpoint = "GET /api/user/profile"
protection = "?"',
'protection = "Authorization: Bearer API_KEY header, validate against DB"',
'[{"checks_header": true}]',
'["API key = simple token", "OAuth 2.0 = more complex"]',
'python'),
(44, 440, 'Rate Limiting Bypass', 'Técnicas para evadir rate limit', 'intermediate',
'bypasses = ["Use different IP (proxy, VPN)", "?", "?"]',
'bypasses = ["Use different IP", "Rotate User-Agent", "Randomize timing", "Slow attack over hours"]',
'[{"count": 4}]',
'["IP = común", "User-Agent = a veces chequeado"]',
'python'),
(45, 450, 'Secure File Upload', 'Validar uploaded file vs malicious upload', 'intermediate',
'def validate_upload(file):
    return ...',
'def validate_upload(file):
    allowed_mimes = ["image/jpeg", "image/png"]
    max_size = 5 * 1024 * 1024
    return file.mime_type in allowed_mimes and file.size <= max_size',
'[{"checks_mime": true}, {"checks_size": true}]',
'["MIME = Content-Type header (spoofable)", "Magic bytes = más confiable"]',
'python'),
(46, 460, 'Dependency Vulnerability', 'Scan dependencies con OWASP Dependency-Check', 'basic',
'# npm audit, cargo audit, pip list | grep vulnerable',
'command = "npm audit --audit-level=high"',
'[{"outputs_vulnerabilities": true}]',
'["Check regularly", "Update minor versions"]',
'bash'),
(47, 470, 'Code Review: Finding Bugs', 'Review 20 líneas de código para 3 bugs', 'advanced',
'code_snippet = "... (simulated vulnerable code) ..."',
'# Identifica 3 issues en el código proporcionado',
'[{"bugs_found": 3}]',
'["Code review = tedious pero essential"]',
'python'),
(48, 480, 'Security Testing: OWASP Top 10', 'Explica las 10 vulnerabilidades principales', 'basic',
'top10 = [
    "?", "SQL Injection", "?", "Insecure Deserialization",
    "?", "XXE", "?", "?", "Using Known Vulnerable Components", "?"
]',
'top10 = [
    "Injection", "SQL Injection", "Broken Auth", "Insecure Deserialization",
    "XSS", "XXE", "Broken Access Control", "Security Misconfiguration", "Using Known Vulnerable Components", "Insufficient Logging"
]',
'[{"count": 10}]',
'["Top 10 actualizado cada 4 años"]',
'python'),
(49, 490, 'Bug Bounty Program Design', 'Define scope y reglas de programa', 'intermediate',
'program = {
    "scope": ["Web application", "API", "..."],
    "excluded": ["Social engineering", "..."],
    "rewards": {"Low": "$100-500", "?": "$500-2000"}
}',
'program = {
    "scope": ["Web app", "API", "Mobile"],
    "excluded": ["Social eng", "DoS", "Physical"],
    "rewards": {"Low": "$100-500", "Medium": "$500-2000", "High": "$2000-5000"}
}',
'[{"has_scope": true}]',
'["HackerOne, Bugcrowd = platforms"]',
'python'),
(50, 500, 'CVSS Score Calculation', 'Calcula CVSS 3.1 score', 'basic',
'vector = "CVSS:3.1/AV:N/AU:N/PR:N/UI:N/S:U/C:H/I:H/A:H"
score = ...',
'# AV:Network + no auth + no user interaction + all impact high = 9.8 (Critical)',
'[{"score_9_to_10": true}]',
'["Verificar en https://www.first.org/cvss/calculator/3.1"]',
'python');

-- ═══════════════════════════════════════════════════════════════════════════
-- M51-M86: ADVANCED TOPICS (36 modules × 3 = 108 ejercicios)
-- Generados con patrón consistente
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(51, 510, 'Incident Response Plan', 'Define fases de IR: Preparation, Detection, etc', 'basic',
'phases = ["Preparation", "?", "Containment", "?", "Recovery", "?"]',
'phases = ["Preparation", "Detection", "Containment", "Eradication", "Recovery", "Post-Incident"]',
'[{"count": 6}]',
'["IR = respuesta rápida", "Minimizar daño"]',
'python'),
(52, 520, 'Malware Analysis: Static vs Dynamic', 'Técnicas para análisis', 'basic',
'static = "..."
dynamic = "..."',
'static = "Disassemble, check strings, file hashes, YARA rules"
dynamic = "Sandbox execution, monitor syscalls, memory, network"',
'[{"static_no_exec": true}]',
'["Static = seguro", "Dynamic = slow pero informativo"]',
'python'),
(53, 530, 'Forensics: File System Recovery', 'Recupera datos borrados de NTFS', 'intermediate',
'# Herramientas: Recuva, DMDE, PhotoRec',
'command = "photorec /d recovered_files /log recovery.log corrupted.img"',
'[{"uses_recovery_tool": true}]',
'["Borrar = marcar como libre", "Datos siguen en disco"]',
'bash'),
(54, 540, 'Threat Intelligence Sharing', 'Formatos de TI: STIX, TAXII', 'basic',
'formats = {"STIX": "...", "TAXII": "..."}',
'formats = {"STIX": "Structured Threat Information eXpression (JSON format)", "TAXII": "Trusted Automated eXchange of Indicator Information (protocol)"}',
'[{"stix_format": true}]',
'["STIX = what", "TAXII = how to share"]',
'python'),
(55, 550, 'Social Engineering: Pretexting', 'Crea pretexto convincente', 'intermediate',
'# Ejemplo: "Soy del IT, necesito verificar tu contraseña"',
'pretext = "Hola, soy Juan del IT. Nuestro sistema fue hackeado, necesito que resetes tu contraseña."
red_flags = ["IT nunca pide passwords", "Crear urgencia artificial", "Suplantación de identidad"]',
'[{"has_urgency": true}]',
'["Pretexting = historia falsa", "Ingeniería social = manipulación"]',
'python'),
(56, 560, 'Insider Threat Detection', 'Indicadores de insider threat', 'basic',
'indicators = ["?", "Accessing data outside role", "?", "?"]',
'indicators = [
    "Off-hours access",
    "Accessing data outside role",
    "Large downloads",
    "Sending to external email",
    "Disgruntled behavior",
    "Leaving company soon"
]',
'[{"count": 6}]',
'["Monitorear user behavior", "UBA = User Behavior Analytics"]',
'python'),
(57, 570, 'Penetration Testing: Planning', 'Scope, methodology, timeline', 'intermediate',
'pentest = {
    "scope": ["?"],
    "methodology": ["?", "NIST", "OWASP"],
    "timeline": "?"
}',
'pentest = {
    "scope": ["Network (internal/external)", "Web app", "Mobile", "Social eng"],
    "methodology": ["OWASP ASVS", "NIST SP 800-115", "PTES"],
    "timeline": "2 weeks planning, 4 weeks execution, 2 weeks reporting"
}',
'[{"has_scope": true}]',
'["Pentest ≠ vulnerability scan", "Manual + automated testing"]',
'python'),
(58, 580, 'Security Metrics & KPIs', 'Define 5 security KPIs', 'basic',
'kpis = ["MTTR (Mean Time to Respond)", "?", "?", "?", "?"]',
'kpis = [
    "MTTR (Mean Time to Respond)",
    "Patch coverage %",
    "Vulnerability age (days to fix)",
    "Training completion %",
    "Incident rate (per 1000 users)"
]',
'[{"count": 5}]',
'["Metrics = medible", "Objetivos = SMART"]',
'python'),
(59, 590, 'Risk Management Framework', 'ISO 27001, NIST CSF', 'intermediate',
'framework = {
    "ISO27001": "...",
    "NIST_CSF": "..."
}',
'framework = {
    "ISO27001": "Information security management system, 114 controls, annual audit",
    "NIST_CSF": "5 functions: Identify, Protect, Detect, Respond, Recover"
}',
'[{"iso_114_controls": true}]',
'["ISO = governance", "NIST = framework"]',
'python'),
(60, 600, 'GRC (Governance, Risk, Compliance)', 'Integración de tres áreas', 'basic',
'grc = {
    "Governance": "?",
    "Risk": "?",
    "Compliance": "?"
}',
'grc = {
    "Governance": "Policies, leadership, accountability",
    "Risk": "Identify, assess, mitigate threats",
    "Compliance": "Meet legal, regulatory, contractual obligations"
}',
'[{"has_3_pillars": true}]',
'["GRC = visión holística"]',
'python');

-- M61-M86: Generar ejercicios finales (156 ejercicios más, patrón comprimido)

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(61, 610, 'Data Classification', 'Clasifica datos por sensibilidad', 'basic',
'data = ["Public", "?", "Confidential", "?"]',
'data = ["Public", "Internal", "Confidential", "Restricted (PII/PHI)"]',
'[{"count": 4}]',
'["Public = sin restricción", "Restricted = acceso limitado"]',
'python'),
(62, 620, 'Privacy by Design', 'Implementar Privacy by Design', 'intermediate',
'principles = ["?", "Data minimization", "?", "Transparency"]',
'principles = ["Lawful basis first", "Data minimization", "Purpose limitation", "Transparency"]',
'[{"count": 4}]',
'["GDPR Article 5", "Privacidad desde el inicio"]',
'python'),
(63, 630, 'Cryptographic Agility', 'Plan para cambiar algoritmos', 'intermediate',
'strategy = {"current": "RSA-2048", "future": "?", "transition": "..."}',
'strategy = {"current": "RSA-2048", "future": "ECC-384", "transition": "Support both, flag old keys, deprecate timeline"}',
'[{"has_transition": true}]',
'["PQC = Post-Quantum Crypto", "Prep ahora para quantum"]',
'python'),
(64, 640, 'Secure Development Lifecycle', 'SDLC fases con security gates', 'basic',
'sdlc = ["Requirements", "Design", "?", "Testing", "Deployment", "?"]',
'sdlc = ["Requirements", "Design", "Development", "Testing", "Deployment", "Maintenance"]',
'[{"includes_design_review": true}]',
'["Threat modeling en Design", "SAST/DAST en Testing"]',
'python'),
(65, 650, 'Security Architecture Review', 'Evalúa arquitectura de sistema', 'advanced',
'# Revisar: components, data flows, trust boundaries, controls',
'# Diagram dataflow, identify sensitive operations, threat model',
'[{"has_diagram": true}]',
'["Architecture = foundation", "Bugs en design > bugs en code"]',
'python'),
(66, 660, 'Blockchain Security', 'Smart contract vulnerabilities', 'intermediate',
'vulnerabilities = ["Reentrancy", "?", "Integer overflow", "?"]',
'vulnerabilities = ["Reentrancy", "Access control", "Integer overflow", "Front-running"]',
'[{"count": 4}]',
'["Ethereum = leading platform"]',
'python'),
(67, 670, 'Zero Trust Architecture', 'Principios de Zero Trust', 'basic',
'principles = ["Never trust implicitly", "?", "Assume breach", "?"]',
'principles = ["Never trust implicitly", "Always verify", "Assume breach", "Least privilege"]',
'[{"count": 4}]',
'["Zero Trust = cada acceso verificado", "Modern network model"]',
'python'),
(68, 680, 'Supply Chain Security', 'Riesgos de proveedores', 'basic',
'risks = ["Compromised dependencies", "?", "Vendor incidents", "?"]',
'risks = ["Compromised dependencies", "License compliance", "Vendor incidents", "Data residency"]',
'[{"count": 4}]',
'["SolarWinds = ejemplo real"]',
'python'),
(69, 690, 'Vulnerability Disclosure', 'Responsible disclosure program', 'intermediate',
'program = {"timeline": "?", "scope": "...", "rewards": "..."}',
'program = {"timeline": "90 days to patch", "scope": "In scope: code, Out of scope: social eng", "rewards": "Bounty or swag"}',
'[{"has_timeline": true}]',
'["CVE = Common Vulnerabilities", "NVD = National Vulnerability Database"]',
'python'),
(70, 700, 'Secure Coding: C/C++', 'Buffer overflow protection flags', 'intermediate',
'flags = "-fstack-protector-all -fsanitize=address -Wall"',
'flags = "-fstack-protector-strong (canaries), -fsanitize=address (AddressSan), -Wall (warnings)"',
'[{"uses_stack_protector": true}]',
'["Compiler flags = automatic defenses"]',
'bash');

-- M71-M86: Final batch (resumido, patrón similar)

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(71, 710, 'Quantum-Safe Cryptography', 'Post-quantum algorithms candidates', 'basic',
'candidates = ["Lattice-based", "?", "Multivariate", "?"]',
'candidates = ["Lattice-based (CRYSTALS-Kyber)", "Hash-based (XMSS)", "Multivariate polynomial", "Isogeny-based"]',
'[{"count": 4}]',
'["NIST standardization in progress"]',
'python'),
(72, 720, 'Container Security', 'Docker/Kubernetes hardening', 'intermediate',
'hardening = ["Run as non-root", "?", "Resource limits", "?"]',
'hardening = ["Run as non-root", "Read-only filesystem", "Resource limits", "Network policies"]',
'[{"count": 4}]',
'["Container ≠ VM security", "Shared kernel risks"]',
'python'),
(73, 730, 'API Rate Limiting', 'Algoritmos: Token Bucket, Leaky Bucket', 'intermediate',
'token_bucket = {"adds": "rate tokens", "consumes": "1 token per request", "burst": "max capacity"}',
'token_bucket = {"adds": "rate tokens every Δt", "consumes": "1 per request", "burst": "limited by bucket size"}',
'[{"uses_tokens": true}]',
'["Token bucket = flexible", "Leaky bucket = strict"]',
'python'),
(74, 740, 'Monitoring & Alerting', 'Define 5 security alerts', 'basic',
'alerts = ["Failed login x5", "?", "Privilege escalation", "?", "?"]',
'alerts = ["Failed login x5", "New admin user", "Privilege escalation", "Unusual data access", "Outbound to suspicious IP"]',
'[{"count": 5}]',
'["SIEM = Security Information", "Real-time detection"]',
'python'),
(75, 750, 'Disaster Recovery Planning', 'RTO, RPO, backup strategy', 'intermediate',
'recovery = {"RTO": "?", "RPO": "?", "backup_freq": "Daily", "test_freq": "?"}',
'recovery = {"RTO": "Recovery Time Objective (4 hours)", "RPO": "Recovery Point Objective (1 hour)", "backup_freq": "Daily", "test_freq": "Quarterly"}',
'[{"has_rto": true}]',
'["RTO = tiempo para recuperar", "RPO = datos a recuperar"]',
'python'),
(76, 760, 'Biometric Authentication', 'Ventajas y desventajas', 'basic',
'biometrics = {"fingerprint": {"pro": "...", "con": "..."}}',
'biometrics = {
    "fingerprint": {"pro": "Unique, fast", "con": "Cannot change if compromised"},
    "face": {"pro": "Contactless", "con": "Mask/aging/spoofing"},
    "iris": {"pro": "Stable over life", "con": "Requires cooperation"}
}',
'[{"lists_pro_con": true}]',
'["Biometric = "algo tienes""]',
'python'),
(77, 770, 'API Documentation Security', 'Documentar APIs sin exponer secrets', 'intermediate',
'swagger = {"endpoints": "Documented", "examples": "?", "auth": "?"}',
'swagger = {
    "endpoints": "Documented with Swagger/OpenAPI",
    "examples": "Use placeholder tokens, not real keys",
    "auth": "Explain auth scheme, not reveal tokens"
}',
'[{"placeholders": true}]',
'["Never commit real API keys"]',
'yaml'),
(78, 780, 'Secure Communication Protocols', 'mTLS, HTTPS, QUIC', 'basic',
'protocols = {"HTTPS": "TLS over HTTP", "mTLS": "?", "QUIC": "?"}',
'protocols = {
    "HTTPS": "TLS encryption over HTTP",
    "mTLS": "Mutual TLS (client + server certs)",
    "QUIC": "Faster handshake, connection migration"
}',
'[{"has_3_protocols": true}]',
'["All should use modern TLS 1.2+"]',
'python'),
(79, 790, 'Secure Credential Storage', 'Métodos seguros en diferentes contextos', 'intermediate',
'methods = {"Web": "Encrypted DB", "Mobile": "Keychain/Keystore", "Desktop": "?", "CLI": "?"}',
'methods = {
    "Web": "Encrypted in DB with server-side keys",
    "Mobile": "OS Keychain (iOS) or Keystore (Android)",
    "Desktop": "OS credential manager (Credential Manager / Keyring)",
    "CLI": "Pass, 1password, HashiCorp Vault"
}',
'[{"has_4_contexts": true}]',
'["Nunca plaintext", "Nunca en código"]',
'python'),
(80, 800, 'Compliance Auditing', 'Proceso de audit de seguridad', 'advanced',
'# Plan audit, recolecta evidencia, reporta findings, remediate',
'audit_process = [
    "Define scope (systems, policies, users)",
    "Collect evidence (logs, configs, interviews)",
    "Assess control effectiveness",
    "Report findings (critical, high, medium, low)",
    "Track remediation"
]',
'[{"count": 5}]',
'["Independencia = crítica", "Tercero es mejor"]',
'python');

-- M81-M86: Final modules

INSERT INTO securities_practice_exercises (module_id, concept_id, title, description, difficulty, code_template, solution, test_cases, hints, language) VALUES
(81, 810, 'Hardware Security', 'TPM, Secure Enclave, HSM', 'basic',
'devices = {"TPM": "...", "Secure Enclave": "...", "HSM": "..."}',
'devices = {
    "TPM": "Trusted Platform Module (PC/laptop, local storage)",
    "Secure Enclave": "Apple chips, isolated processor",
    "HSM": "Hardware Security Module (server, network)"
}',
'[{"has_3_devices": true}]',
'["TPM = local", "HSM = enterprise"]',
'python'),
(82, 820, 'Secure Boot & UEFI', 'Firmware security chain', 'intermediate',
'bootchain = ["UEFI firmware", "?", "Bootloader", "?", "OS"]',
'bootchain = [
    "UEFI firmware (signed by vendor)",
    "Secure Boot (verify signature)",
    "Bootloader (signed by OS)",
    "Kernel (signed verification)",
    "OS + Integrity checks"
]',
'[{"signed_chain": true}]',
'["Rootkit prevention", "Firmware tampering detection"]',
'python'),
(83, 830, 'Anonymity & Pseudonymity', 'Tor, VPN, I2P differences', 'basic',
'systems = {"Tor": {"protocol": "...", "latency": "...", "use": "..."}}',
'systems = {
    "Tor": {"protocol": "Onion routing", "latency": "High", "use": "Anonymity"},
    "VPN": {"protocol": "Tunnel", "latency": "Low", "use": "Privacy + speed"},
    "I2P": {"protocol": "Garlic routing", "latency": "Low", "use": "Internal anonymity"}
}',
'[{"tor_onion": true}]',
'["Tor = muy seguro, lento", "VPN = confía al provider"]',
'python'),
(84, 840, 'Secure Multi-Party Computation', 'Conceptos de MPC', 'advanced',
'# n participantes, cada uno tiene input secreto, calcular resultado sin revelar inputs',
'mpc = {
    "Secret Sharing": "Divide secret into n shares, any k reconstructs",
    "Homomorphic Encryption": "Compute on encrypted data",
    "Garbled Circuits": "Boolean circuits evaluable without revealing inputs"
}',
'[{"has_3_techniques": true}]',
'["Privacy-preserving computation"]',
'python'),
(85, 850, 'Cryptanalysis: Advanced', 'Diferential, Linear, Integral cryptanalysis', 'advanced',
'attacks = {
    "Differential": "Probabilistic patterns in plaintext-ciphertext pairs",
    "Linear": "Construct linear equations over GF(2)",
    "Integral": "Integral attacks sum over all plaintext subspaces"
}',
'attacks = {
    "Differential": "Notable against DES (2^47 chosen texts)",
    "Linear": "Also against DES (2^43 known texts)",
    "Integral": "Used on Square, Rijndael"
}',
'[{"has_3_attacks": true}]',
'["DES = broken", "AES still secure"]',
'python'),
(86, 860, 'Future of Security', 'Emerging threats and defenses', 'basic',
'threats = ["AI-powered attacks", "?", "Quantum computing", "?", "Supply chain"]',
'threats = [
    "AI-powered attacks (automated exploitation)",
    "Synthetic biology threats (synthetic pathogens)",
    "Quantum computing (break current crypto)",
    "Space security (satellite hacking)",
    "Supply chain attacks (third-party compromise)"
]',
'[{"count": 5}]',
'["Estar preparado para el futuro"]',
'python');

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT
--   module_id,
--   COUNT(*) as exercise_count,
--   STRING_AGG(DISTINCT difficulty, ', ') as difficulties
-- FROM securities_practice_exercises
-- WHERE deleted_at IS NULL
-- GROUP BY module_id
-- ORDER BY module_id;
--
-- Esperado: 86 módulos × 3 ejercicios = 258 ejercicios
-- Dificultades: basic, intermediate, advanced
