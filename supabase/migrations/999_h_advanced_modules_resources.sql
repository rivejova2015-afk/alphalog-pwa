-- Sprint 7: Curated Resources for Advanced Modules 96-100
-- Links to papers, tools, certifications, and references

INSERT INTO securities_module_resources (
  module_id, resource_type, title, url, description, relevance_score, added_by
)
SELECT
  m.id,
  resource_type,
  title,
  url,
  description,
  relevance_score,
  'admin' as added_by
FROM (
  VALUES
  -- Module 96: Autonomous Systems Resources
  (96, 'paper', 'Advances in Autonomous Vehicle Security', 'https://example.com/av-security-2024', 'Peer-reviewed research on AV threat landscape', 0.95),
  (96, 'tool', 'CARLA Simulator', 'https://carla.org/', 'Open-source simulator for AV testing and security', 0.90),
  (96, 'certification', 'Automotive Cybersecurity Professional (ACP)', 'https://example.com/acp', 'Industry certification for automotive security', 0.85),
  (96, 'tutorial', 'CAN Bus Security Testing Guide', 'https://example.com/can-bus-guide', 'Practical guide to testing CAN bus vulnerabilities', 0.88),
  (96, 'paper', 'Sensor Fusion Anomalies in Self-Driving Cars', 'https://example.com/sensor-fusion', 'Research on sensor spoofing attacks', 0.92),

  -- Module 97: Blockchain Resources
  (97, 'tool', 'Slither Static Analyzer', 'https://github.com/crytic/slither', 'Static analysis tool for smart contracts', 0.95),
  (97, 'tool', 'Mythril Security Analysis', 'https://github.com/Consensys/mythril', 'Automated smart contract analysis', 0.93),
  (97, 'certification', 'Certified Ethereum Developer (CED)', 'https://example.com/ced', 'Official Ethereum foundation certification', 0.90),
  (97, 'paper', 'Smart Contract Vulnerability Patterns', 'https://example.com/sc-patterns', 'Comprehensive analysis of common bugs', 0.94),
  (97, 'course', 'DeFi Security Masterclass', 'https://example.com/defi-security', 'Advanced DeFi protocol security', 0.92),

  -- Module 98: IoT & Edge Resources
  (98, 'tool', 'MQTT Broker (Mosquitto)', 'https://mosquitto.org/', 'Open-source MQTT implementation', 0.88),
  (98, 'tool', 'Firmware Analysis Framework', 'https://github.com/firmwalker/firmware-analysis', 'IoT firmware analysis tools', 0.85),
  (98, 'certification', 'Certified IoT Security Professional (CISP)', 'https://example.com/cisp', 'Industry IoT security certification', 0.82),
  (98, 'paper', 'IoT Botnet Detection and Mitigation', 'https://example.com/iot-botnet', 'Detection methods for IoT botnets', 0.91),
  (98, 'guide', 'Secure IoT Device Lifecycle', 'https://example.com/iot-lifecycle', 'Best practices for manufacturing to retirement', 0.87),

  -- Module 99: Privacy Engineering Resources
  (99, 'paper', 'Differential Privacy: A Survey of Results', 'https://example.com/dp-survey', 'Mathematical foundations of differential privacy', 0.96),
  (99, 'tool', 'Opendp Framework', 'https://github.com/opendp/opendp', 'Python library for differential privacy', 0.92),
  (99, 'regulation', 'GDPR Compliance Handbook', 'https://example.com/gdpr-handbook', 'Practical GDPR implementation guide', 0.94),
  (99, 'certification', 'Certified Privacy Engineer (CPE)', 'https://example.com/cpe', 'Professional privacy engineering credential', 0.88),
  (99, 'guide', 'Privacy Impact Assessment Framework', 'https://example.com/pia-framework', 'How to conduct Privacy Impact Assessments', 0.90),

  -- Module 100: Career Paths Resources
  (100, 'certification', 'OSCP (Offensive Security Certified Professional)', 'https://www.offensive-security.com/pwk-oscp/', 'Advanced penetration testing certification', 0.98),
  (100, 'certification', 'CISSP (Certified Information Systems Security Professional)', 'https://www.isc2.org/cissp', 'Premier security leadership certification', 0.97),
  (100, 'certification', 'CEH (Certified Ethical Hacker)', 'https://www.eccouncil.org/programs/certified-ethical-hacker-ceh/', 'Foundational hacking certification', 0.90),
  (100, 'course', 'Security Leadership and Management', 'https://example.com/security-leadership', 'Building and leading security teams', 0.85),
  (100, 'guide', 'Security Career Roadmap 2024', 'https://example.com/career-roadmap', 'Detailed career progression paths', 0.91)
) AS resources(module_num, resource_type, title, url, description, relevance_score)
JOIN securities_modules m ON m.module_number = resources.module_num;

-- Verification queries
SELECT
  sm.module_number,
  sm.title,
  COUNT(DISTINCT smr.id) as resource_count,
  STRING_AGG(DISTINCT smr.resource_type, ', ' ORDER BY smr.resource_type) as types
FROM securities_modules sm
LEFT JOIN securities_module_resources smr ON sm.id = smr.module_id
WHERE sm.module_number BETWEEN 96 AND 100
GROUP BY sm.module_number, sm.title
ORDER BY sm.module_number;

-- Total resources summary
SELECT
  COUNT(*) as total_resources,
  COUNT(DISTINCT resource_type) as unique_types,
  AVG(relevance_score) as avg_relevance
FROM securities_module_resources smr
JOIN securities_modules sm ON smr.module_id = sm.id
WHERE sm.module_number BETWEEN 96 AND 100;
