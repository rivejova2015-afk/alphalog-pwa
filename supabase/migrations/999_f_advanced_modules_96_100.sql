-- Sprint 7: Advanced Security Modules 96-100
-- Final tier: Autonomous Systems, Blockchain, IoT, Privacy Engineering, Career Paths

INSERT INTO securities_modules (
  module_number, title, description, difficulty_level, estimated_hours,
  prerequisite_modules, learning_outcomes, industry_relevance, sort_index
) VALUES
-- Module 96: Autonomous Systems Security
(
  96,
  'Autonomous Systems Security',
  'Securing autonomous vehicles, drones, robotics: firmware, communication, sensor spoofing, fail-safes',
  'advanced',
  13,
  ARRAY[45, 50, 55],
  ARRAY[
    'Identify autonomous system vulnerabilities',
    'Defend against sensor attacks and spoofing',
    'Secure autonomous communication protocols',
    'Implement safety-critical security',
    'Test autonomous system resilience'
  ],
  ARRAY['Automotive', 'Robotics', 'Defense', 'Aerospace'],
  96
),
-- Module 97: Blockchain & Smart Contract Security
(
  97,
  'Blockchain & Smart Contract Security',
  'Blockchain fundamentals, smart contract vulnerabilities, DeFi security, consensus attacks, audit practices',
  'advanced',
  14,
  ARRAY[30, 35, 55],
  ARRAY[
    'Understand blockchain architecture',
    'Identify smart contract vulnerabilities',
    'Prevent reentrancy and overflow attacks',
    'Analyze DeFi security risks',
    'Perform security audits of contracts'
  ],
  ARRAY['FinTech', 'Crypto', 'Enterprise'],
  97
),
-- Module 98: IoT & Edge Security
(
  98,
  'IoT & Edge Security',
  'Internet of Things security: device firmware, network protocols, edge computing, constraint-based security',
  'advanced',
  12,
  ARRAY[50, 65],
  ARRAY[
    'Secure IoT device lifecycles',
    'Implement edge security patterns',
    'Protect IoT communications',
    'Manage IoT device firmware',
    'Respond to IoT compromises'
  ],
  ARRAY['Industrial', 'Smart Home', 'Healthcare'],
  98
),
-- Module 99: Privacy Engineering
(
  99,
  'Privacy Engineering',
  'Building privacy by design: differential privacy, data minimization, anonymization, GDPR/CCPA implementation',
  'advanced',
  13,
  ARRAY[40, 55, 70],
  ARRAY[
    'Design privacy-preserving systems',
    'Implement differential privacy',
    'Anonymize sensitive data',
    'Ensure regulatory compliance',
    'Conduct privacy impact assessments'
  ],
  ARRAY['Enterprise', 'Healthcare', 'FinTech', 'Government'],
  99
),
-- Module 100: Security Career Paths & Specializations
(
  100,
  'Security Career Paths & Specializations',
  'Career planning in cybersecurity: roles, certifications (OSCP, CEH, CISSP), specializations, continuous learning',
  'advanced',
  10,
  ARRAY[45, 50, 55, 60, 65, 70, 75, 80],
  ARRAY[
    'Identify security career paths',
    'Understand certification requirements',
    'Build specialized expertise',
    'Develop security leadership skills',
    'Plan continuous learning strategy'
  ],
  ARRAY['Career Development', 'Leadership'],
  100
);

-- Module 96 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (96, 'Autonomous Vehicle Security', 'Security in self-driving cars: CAN bus, LIDAR, GPS spoofing, fallback systems', 'advanced'),
  (96, 'Sensor Attack Detection', 'Detecting and preventing sensor spoofing attacks on autonomous systems', 'advanced'),
  (96, 'Firmware Security', 'Securing embedded firmware in autonomous devices and controllers', 'advanced'),
  (96, 'Safety-Critical Systems', 'Security in safety-critical environments: fail-safe modes, redundancy', 'advanced'),
  (96, 'UAV & Drone Security', 'Securing unmanned aerial vehicles: communication, GPS, payload protection', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 97 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (97, 'Smart Contract Vulnerabilities', 'Common bugs: reentrancy, overflow, underflow, access control', 'advanced'),
  (97, 'Consensus Mechanism Security', 'Proof of Work vs Proof of Stake attacks and defenses', 'advanced'),
  (97, 'DeFi Protocol Security', 'Securing decentralized finance: liquidity pools, oracle attacks, flash loans', 'advanced'),
  (97, 'Cryptographic Primitives', 'ECDSA, hashing, merkle trees, zero-knowledge proofs', 'advanced'),
  (97, 'Smart Contract Auditing', 'Formal verification and security testing of blockchain code', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 98 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (98, 'IoT Protocol Security', 'MQTT, CoAP, Z-Wave: protocol vulnerabilities and hardening', 'advanced'),
  (98, 'Edge Computing Security', 'Securing edge devices and edge-to-cloud communication', 'advanced'),
  (98, 'Device Firmware Updates', 'Secure OTA updates, firmware integrity, rollback prevention', 'advanced'),
  (98, 'Resource-Constrained Security', 'Security for low-power, low-memory IoT devices', 'advanced'),
  (98, 'IoT Botnet Mitigation', 'Preventing and detecting IoT botnets (Mirai, Dyn)', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 99 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (99, 'Privacy by Design', 'Principles and practices of building privacy into systems', 'advanced'),
  (99, 'Differential Privacy', 'Mathematical framework for privacy-preserving analytics', 'advanced'),
  (99, 'Data Anonymization', 'Techniques: k-anonymity, l-diversity, differential privacy', 'advanced'),
  (99, 'Privacy Regulations', 'GDPR, CCPA, HIPAA: compliance requirements and enforcement', 'advanced'),
  (99, 'Privacy Impact Assessment', 'Evaluating privacy risks in new systems and processing', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 100 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (100, 'Security Roles & Positions', 'SOC Analyst, Penetration Tester, Security Architect, CISO', 'advanced'),
  (100, 'Industry Certifications', 'OSCP, CEH, CISSP, SANS, CompTIA Security+', 'advanced'),
  (100, 'Specialization Paths', 'Incident Response, Cloud Security, AppSec, IoT Security', 'advanced'),
  (100, 'Leadership in Security', 'Managing security teams, strategic planning, board communication', 'advanced'),
  (100, 'Continuous Learning', 'Staying current with threats, research, community participation', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 96 Lessons
INSERT INTO securities_module_lessons (module_id, lesson_number, title, content, learning_objectives, duration_minutes)
VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 96),
  1,
  'Autonomous Vehicle Architecture & Threats',
  'Learn the architecture of autonomous vehicles: sensors (LIDAR, radar, camera), ECUs, communication buses. Understand threat models: sensor spoofing, CAN bus injection, GPS jamming, and physical tampering.',
  ARRAY['Understand AV architecture', 'Identify threat vectors', 'Learn sensor fusion concepts'],
  60
),
(
  (SELECT id FROM securities_modules WHERE module_number = 96),
  2,
  'Defending Against Sensor Attacks',
  'Techniques to detect and prevent sensor spoofing: sensor redundancy, cross-validation, anomaly detection, secure sensor fusion algorithms.',
  ARRAY['Detect spoofing attacks', 'Design sensor validation', 'Implement anomaly detection'],
  55
),
(
  (SELECT id FROM securities_modules WHERE module_number = 96),
  3,
  'Safety-Critical Security',
  'Security in safety-critical systems: fail-safe modes, defense in depth, formal verification, safety standards (ISO 26262, SOTIF).',
  ARRAY['Design fail-safe systems', 'Understand safety standards', 'Balance security and safety'],
  50
);

-- Module 97 Lessons
INSERT INTO securities_module_lessons (module_id, lesson_number, title, content, learning_objectives, duration_minutes)
VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 97),
  1,
  'Blockchain Fundamentals & Consensus',
  'How blockchain works: distributed ledgers, consensus mechanisms (PoW, PoS), cryptographic hashing, merkle trees. Attack vectors against consensus.',
  ARRAY['Understand blockchain', 'Learn consensus mechanisms', 'Identify consensus attacks'],
  65
),
(
  (SELECT id FROM securities_modules WHERE module_number = 97),
  2,
  'Smart Contract Vulnerabilities & Auditing',
  'Common smart contract bugs: reentrancy, integer overflow/underflow, access control flaws. Audit techniques and tools (Slither, Mythril, formal verification).',
  ARRAY['Find contract vulnerabilities', 'Perform code reviews', 'Use analysis tools'],
  70
),
(
  (SELECT id FROM securities_modules WHERE module_number = 97),
  3,
  'DeFi Security & Risk Management',
  'DeFi protocol security: oracle attacks, flash loan exploits, impermanent loss attacks, liquidity risks. Building secure DeFi applications.',
  ARRAY['Understand DeFi risks', 'Prevent oracle attacks', 'Secure liquidity pools'],
  60
);

-- Module 98 Lessons
INSERT INTO securities_module_lessons (module_id, lesson_number, title, content, learning_objectives, duration_minutes)
VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 98),
  1,
  'IoT Architecture & Threat Landscape',
  'IoT device lifecycle: manufacturing, deployment, operation, retirement. Threat landscape: botnets, physical attacks, protocol flaws, firmware vulnerabilities.',
  ARRAY['Understand IoT systems', 'Learn threat models', 'Identify vulnerabilities'],
  55
),
(
  (SELECT id FROM securities_modules WHERE module_number = 98),
  2,
  'Securing IoT Devices & Communication',
  'Device-level security: secure boot, code signing, hardware security. Communication security: encrypted channels, TLS/DTLS, authentication.',
  ARRAY['Secure boot and firmware', 'Encrypt communications', 'Implement authentication'],
  60
),
(
  (SELECT id FROM securities_modules WHERE module_number = 98),
  3,
  'Edge Computing & Botnet Prevention',
  'Edge security: processing at the edge, secure computation, offline capabilities. Preventing botnets: patching, isolation, monitoring, incident response.',
  ARRAY['Secure edge devices', 'Prevent botnet infection', 'Detect compromises'],
  50
);

-- Module 99 Lessons
INSERT INTO securities_module_lessons (module_id, lesson_number, title, content, learning_objectives, duration_minutes)
VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 99),
  1,
  'Privacy by Design & Differential Privacy',
  'Privacy by Design principles: data minimization, purpose limitation, transparency. Mathematical privacy: differential privacy, k-anonymity, l-diversity.',
  ARRAY['Apply Privacy by Design', 'Understand differential privacy', 'Implement anonymization'],
  70
),
(
  (SELECT id FROM securities_modules WHERE module_number = 99),
  2,
  'Data Protection & Regulations',
  'Data protection techniques: encryption, access controls, data retention policies. Regulatory compliance: GDPR, CCPA, HIPAA, PIPEDA.',
  ARRAY['Implement protections', 'Ensure compliance', 'Design privacy-friendly flows'],
  65
),
(
  (SELECT id FROM securities_modules WHERE module_number = 99),
  3,
  'Privacy Assessments & Incident Response',
  'Conducting Privacy Impact Assessments (PIAs), Privacy Threat Modeling, incident response for data breaches, notification requirements.',
  ARRAY['Conduct PIAs', 'Respond to breaches', 'Manage notifications'],
  55
);

-- Module 100 Lessons
INSERT INTO securities_module_lessons (module_id, lesson_number, title, content, learning_objectives, duration_minutes)
VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 100),
  1,
  'Security Career Landscape',
  'Overview of security careers: roles (analyst, engineer, architect, CISO), specializations, salary ranges, job market trends. Certification landscape.',
  ARRAY['Understand career paths', 'Learn about certifications', 'Explore specializations'],
  50
),
(
  (SELECT id FROM securities_modules WHERE module_number = 100),
  2,
  'Building Expertise & Certifications',
  'Detailed paths to OSCP, CEH, CISSP, SANS certifications. Study strategies, resources, exam tips. Building hands-on experience.',
  ARRAY['Plan certification path', 'Study effectively', 'Build experience'],
  55
),
(
  (SELECT id FROM securities_modules WHERE module_number = 100),
  3,
  'Security Leadership & Continuous Learning',
  'Transitioning to leadership roles, managing security teams, board communication. Staying current: research, conferences, communities, continuous learning.',
  ARRAY['Develop leadership skills', 'Stay current with threats', 'Build professional network'],
  50
);

-- Verification query
SELECT
  COUNT(*) as total_modules,
  COUNT(CASE WHEN difficulty_level = 'advanced' THEN 1 END) as advanced_count,
  MIN(module_number) as min_module,
  MAX(module_number) as max_module
FROM securities_modules
WHERE module_number >= 96 AND module_number <= 100;

SELECT
  sm.module_number,
  sm.title,
  COUNT(DISTINCT smc.id) as concept_count,
  COUNT(DISTINCT sml.id) as lesson_count
FROM securities_modules sm
LEFT JOIN securities_module_concepts smc ON sm.id = smc.module_id
LEFT JOIN securities_module_lessons sml ON sm.id = sml.module_id
WHERE sm.module_number >= 96 AND sm.module_number <= 100
GROUP BY sm.module_number, sm.title
ORDER BY sm.module_number;
