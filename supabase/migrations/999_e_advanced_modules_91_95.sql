-- Sprint 7: Advanced Security Modules 91-95
-- Modules covering cutting-edge security topics

INSERT INTO securities_modules (
  module_number, title, description, difficulty_level, estimated_hours,
  prerequisite_modules, learning_outcomes, industry_relevance, sort_index
) VALUES
-- Module 91: Zero Trust Architecture
(
  91,
  'Zero Trust Architecture',
  'Complete guide to zero trust security model: verify every access, never trust by default, assume breach mentality',
  'advanced',
  12,
  ARRAY[45, 60],
  ARRAY[
    'Design zero trust network architectures',
    'Implement continuous verification systems',
    'Deploy microsegmentation strategies',
    'Monitor and log all access attempts',
    'Respond to zero trust model breaches'
  ],
  ARRAY['Enterprise', 'Cloud', 'FinTech', 'Healthcare'],
  91
),
-- Module 92: Supply Chain Security
(
  92,
  'Supply Chain Security',
  'Securing software and hardware supply chains: vendor management, SBOMs, dependency analysis, attack prevention',
  'advanced',
  11,
  ARRAY[40, 65],
  ARRAY[
    'Audit vendor security practices',
    'Generate and analyze SBOMs',
    'Detect supply chain vulnerabilities',
    'Implement secure procurement policies',
    'Respond to supply chain attacks'
  ],
  ARRAY['Enterprise', 'Government', 'Defense'],
  92
),
-- Module 93: Quantum-Safe Cryptography
(
  93,
  'Quantum-Safe Cryptography',
  'Post-quantum cryptography: preparing for quantum computing era, algorithm selection, migration strategies',
  'advanced',
  14,
  ARRAY[30, 55],
  ARRAY[
    'Understand quantum threats to current cryptography',
    'Implement post-quantum algorithms',
    'Design hybrid cryptographic systems',
    'Migrate legacy systems to quantum-safe',
    'Test quantum-resistant implementations'
  ],
  ARRAY['Government', 'FinTech', 'Infrastructure'],
  93
),
-- Module 94: AI/ML Security
(
  94,
  'AI/ML Security',
  'Securing artificial intelligence and machine learning systems: adversarial attacks, model poisoning, backdoors, privacy',
  'advanced',
  13,
  ARRAY[35, 70],
  ARRAY[
    'Identify ML vulnerabilities and threats',
    'Defend against adversarial attacks',
    'Detect model poisoning attempts',
    'Implement secure ML pipelines',
    'Privacy-preserving machine learning'
  ],
  ARRAY['Enterprise', 'Tech', 'Research'],
  94
),
-- Module 95: Cloud Native Security
(
  95,
  'Cloud Native Security',
  'Security in containerized and serverless environments: Kubernetes, microservices, cloud security best practices',
  'advanced',
  12,
  ARRAY[50, 65],
  ARRAY[
    'Secure container orchestration platforms',
    'Implement microservices security',
    'Deploy serverless security patterns',
    'Secure cloud-native CI/CD pipelines',
    'Monitor and audit cloud infrastructure'
  ],
  ARRAY['Cloud', 'Enterprise', 'DevOps'],
  95
);

-- Module 91 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (91, 'Zero Trust Principles', 'Core tenets: verify identity, least privilege, default deny, continuous verification', 'advanced'),
  (91, 'Microsegmentation', 'Network segmentation at granular level, traffic filtering between segments', 'advanced'),
  (91, 'Identity and Access Management', 'Zero trust IAM: authentication, authorization, verification', 'advanced'),
  (91, 'Continuous Verification', 'Real-time monitoring and re-verification of all access', 'advanced'),
  (91, 'Zero Trust Implementation', 'Practical deployment strategies and tools for zero trust', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 92 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (92, 'Vendor Risk Assessment', 'Evaluating third-party security practices and vulnerabilities', 'advanced'),
  (92, 'Software Bill of Materials', 'SBOM creation, analysis, and component tracking', 'advanced'),
  (92, 'Dependency Management', 'Tracking and securing software dependencies', 'advanced'),
  (92, 'Supply Chain Attacks', 'Understanding and preventing supply chain compromise', 'advanced'),
  (92, 'Secure Procurement', 'Security requirements in vendor contracts and selection', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 93 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (93, 'Quantum Computing Threat', 'Understanding quantum computing threat to current cryptography', 'advanced'),
  (93, 'Post-Quantum Algorithms', 'NIST-approved PQC algorithms: lattice-based, hash-based, code-based', 'advanced'),
  (93, 'Hybrid Cryptography', 'Combining classical and post-quantum algorithms', 'advanced'),
  (93, 'Crypto Agility', 'Systems that can switch between cryptographic algorithms', 'advanced'),
  (93, 'PQC Migration', 'Strategies for migrating to post-quantum cryptography', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 94 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (94, 'Adversarial Machine Learning', 'Attacks against ML models: evasion, poisoning, extraction', 'advanced'),
  (94, 'Model Robustness', 'Techniques for making ML models resistant to attacks', 'advanced'),
  (94, 'Model Poisoning', 'Training data attacks and defense mechanisms', 'advanced'),
  (94, 'Privacy in ML', 'Differential privacy, federated learning, secure multi-party computation', 'advanced'),
  (94, 'Explainable AI Security', 'Interpretability and trustworthiness in ML systems', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 95 Concepts
INSERT INTO securities_module_concepts (module_id, concept_name, description, difficulty)
SELECT m.id, concept_name, description, difficulty
FROM (
  VALUES
  (95, 'Container Security', 'Securing Docker, containerd, and other container runtimes', 'advanced'),
  (95, 'Kubernetes Security', 'RBAC, network policies, pod security, secrets management', 'advanced'),
  (95, 'Microservices Architecture', 'API security, service-to-service communication, circuit breakers', 'advanced'),
  (95, 'Serverless Security', 'AWS Lambda, Azure Functions, securing function execution', 'advanced'),
  (95, 'Cloud Native CI/CD', 'Securing GitOps, container registries, artifact management', 'advanced')
) AS concepts(module_num, concept_name, description, difficulty)
JOIN securities_modules m ON m.module_number = concepts.module_num;

-- Module 91 Lessons
INSERT INTO securities_module_lessons (module_id, lesson_number, title, content, learning_objectives, duration_minutes)
VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 91),
  1,
  'Zero Trust Fundamentals',
  'Zero trust challenges the traditional perimeter-based security model. Instead of trusting everything inside the network, zero trust assumes compromise at every level and verifies every access request.',
  ARRAY['Define zero trust principles', 'Understand trust verification', 'Learn continuous monitoring'],
  45
),
(
  (SELECT id FROM securities_modules WHERE module_number = 91),
  2,
  'Implementing Microsegmentation',
  'Microsegmentation divides the network into small zones to maintain separate access for each part. Learn to implement and maintain microsegmentation strategies.',
  ARRAY['Design network segments', 'Configure segment rules', 'Monitor segment traffic'],
  50
),
(
  (SELECT id FROM securities_modules WHERE module_number = 91),
  3,
  'Zero Trust Identity Management',
  'Identity verification is the foundation of zero trust. Explore strong authentication, multi-factor authentication, and continuous identity verification.',
  ARRAY['Implement MFA strategies', 'Design verification workflows', 'Monitor identity events'],
  55
);

-- Verification query
SELECT
  COUNT(*) as total_modules,
  COUNT(CASE WHEN difficulty_level = 'advanced' THEN 1 END) as advanced_count,
  MIN(module_number) as min_module,
  MAX(module_number) as max_module
FROM securities_modules
WHERE module_number >= 91 AND module_number <= 95;

SELECT
  sm.module_number,
  COUNT(DISTINCT smc.id) as concept_count,
  COUNT(DISTINCT sml.id) as lesson_count
FROM securities_modules sm
LEFT JOIN securities_module_concepts smc ON sm.id = smc.module_id
LEFT JOIN securities_module_lessons sml ON sm.id = sml.module_id
WHERE sm.module_number >= 91 AND sm.module_number <= 95
GROUP BY sm.module_number
ORDER BY sm.module_number;
