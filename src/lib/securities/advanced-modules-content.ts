/**
 * Advanced Modules 96-100: Detailed Lesson Content
 * Provides structured learning material for final tier modules
 */

export const ADVANCED_MODULE_CONTENT = {
  96: {
    title: 'Autonomous Systems Security',
    summary: 'Securing the next generation of transportation and robotics',
    lessons: [
      {
        number: 1,
        title: 'Autonomous Vehicle Architecture & Threats',
        duration_minutes: 60,
        sections: [
          {
            title: 'AV System Components',
            content: `
              Modern autonomous vehicles use multiple interconnected systems:

              1. Sensor Suite
                 - LIDAR: 360° range detection (up to 200m)
                 - Radar: Velocity and distance measurement
                 - Cameras: Multi-spectral image processing
                 - GPS/INS: Localization (±10cm accuracy)

              2. Processing Units
                 - Edge computing (NVIDIA Drive, Tesla FSD Computer)
                 - Real-time kernel requirements
                 - Redundant processing for safety

              3. Communication Bus
                 - CAN (Controller Area Network)
                 - LIN (Local Interconnect Network)
                 - FlexRay (high-speed backup)

              4. Actuators
                 - Steering servo
                 - Throttle/Brake control
                 - Park brake engagement
            `,
          },
          {
            title: 'Threat Landscape',
            content: `
              Top attack vectors on autonomous vehicles:

              1. Sensor Spoofing (CRITICAL)
                 Risk: Physical attacks on sensors
                 Impact: Vehicle can misinterpret environment
                 Examples: Adversarial patches on road signs, radar jamming

              2. GPS Spoofing
                 Risk: False localization data
                 Impact: Vehicle navigates to wrong location
                 Mitigation: GPS authentication, INS fallback

              3. CAN Bus Injection
                 Risk: Direct command injection on vehicle network
                 Impact: Override legitimate commands
                 Example: 2015 Jeep Cherokee hack (gas/brake)

              4. Software/Firmware Vulnerabilities
                 Risk: OTA update tampering
                 Impact: Complete system compromise
                 Mitigation: Code signing, secure boot

              5. Physical Tampering
                 Risk: Hardware modification
                 Impact: Inserted devices on CAN bus
                 Mitigation: Tamper detection, sealed enclosures
            `,
          },
        ],
        key_takeaways: [
          'AV architecture: sensors, processing, actuation, communication',
          'Threat model includes both physical and digital attacks',
          'Defense requires redundancy and sensor validation',
        ],
      },
      {
        number: 2,
        title: 'Defending Against Sensor Attacks',
        duration_minutes: 55,
        sections: [
          {
            title: 'Sensor Fusion & Anomaly Detection',
            content: `
              Defense Strategy: Cross-Validation

              1. Sensor Redundancy
                 - Multiple sensors per modality (3x LIDAR, 6x camera)
                 - Different technologies (radar + LIDAR cross-check)
                 - Independent data streams processed separately

              2. Consensus Algorithms
                 - Majority voting on obstacle detection
                 - Ensemble methods for decision making
                 - Weighted voting based on confidence scores

              3. Anomaly Detection
                 - Statistical baseline of normal readings
                 - Real-time deviation monitoring
                 - Machine learning for pattern recognition

              4. Cross-Modal Validation
                 - LIDAR detects object → confirm with camera
                 - Radar measures speed → validate trajectory
                 - GPS sanity checks against visual odometry
            `,
          },
          {
            title: 'Implementation Example: LIDAR Anomaly Detector',
            content: `
              Algorithm for detecting LIDAR spoofing:

              1. Baseline Establishment (training phase)
                 - Record 1000 frames in controlled environment
                 - Calculate point cloud distribution statistics
                 - Identify normal variance patterns by distance

              2. Real-time Monitoring
                 - Input: Raw LIDAR point cloud (64 beams, 1200 RPM)
                 - Extract: Distance statistics per bearing
                 - Compare: Against baseline using Mahalanobis distance
                 - Alert: If distance > 3σ (99.7% confidence)

              3. Confidence Scoring
                 - Combine with radar range validation
                 - Weight by sensor health indicators
                 - Output: [0.0-1.0] trust score for object detection

              4. Fallback Behavior
                 - If anomaly detected: reduce speed to <5 mph
                 - Log incident with timestamp, sensor data, decision
                 - Alert human operator for takeover
            `,
          },
        ],
        key_takeaways: [
          'Sensor fusion provides resilience against single-sensor attacks',
          'Statistical anomaly detection can identify spoofing attempts',
          'Fallback behaviors critical for safety-critical systems',
        ],
      },
    ],
  },

  97: {
    title: 'Blockchain & Smart Contract Security',
    summary: 'Building secure decentralized applications',
    lessons: [
      {
        number: 1,
        title: 'Blockchain Fundamentals & Consensus',
        duration_minutes: 65,
        sections: [
          {
            title: 'How Blockchain Works',
            content: `
              Core Blockchain Concepts:

              1. Distributed Ledger
                 - Replicated across 1000+ nodes
                 - Cryptographically linked blocks
                 - Immutable transaction history

              2. Consensus Mechanisms

                 A) Proof of Work (PoW)
                    - Miners solve cryptographic puzzles
                    - First to solve broadcasts block
                    - Difficulty adjusts to maintain ~10min blocks
                    - Security: 51% attack requires majority hash power

                 B) Proof of Stake (PoS)
                    - Validators lock up cryptocurrency as collateral
                    - Randomly selected to propose blocks
                    - Slashing penalty for misbehavior
                    - Security: Economic incentives instead of computation

              3. Merkle Trees
                 - Efficient verification of large datasets
                 - Change in one transaction affects root hash
                 - Allows light clients to verify without full chain
            `,
          },
        ],
        key_takeaways: [
          'Consensus mechanisms ensure agreement without central authority',
          'Cryptography provides immutability',
          'Trade-offs: security vs. energy efficiency vs. throughput',
        ],
      },
      {
        number: 2,
        title: 'Smart Contract Vulnerabilities & Auditing',
        duration_minutes: 70,
        sections: [
          {
            title: 'Critical Vulnerability Patterns',
            content: `
              Top Smart Contract Bugs:

              1. REENTRANCY (Severity: CRITICAL)
                 Pattern:
                   function withdraw(uint amount) {
                     require(balance[msg.sender] >= amount);
                     (bool success, ) = msg.sender.call{value: amount}("");
                     require(success);
                     balance[msg.sender] -= amount;  // ← Update AFTER external call!
                   }

                 Attack: Attacker's fallback() calls withdraw() again
                 Fix: Update state BEFORE external calls (CEI pattern)
                 Cost: ~$31M (TheDAO 2016)

              2. INTEGER OVERFLOW/UNDERFLOW
                 Pattern:
                   uint8 balance = 200;
                   balance += 100;  // ← Wraps to 44 (256 % 344)
                 Fix: Use SafeMath library or uint256
                 Cost: $20M+ (BEC token 2018)

              3. ACCESS CONTROL BYPASS
                 Pattern:
                   function withdrawFunds() public {
                     require(msg.sender == owner);  // ← Owner not set!
                   }
                 Fix: Proper initialization, role-based access
                 Cost: Variable

              4. UNCHECKED EXTERNAL CALLS
                 Pattern:
                   Token.transfer(recipient, amount);  // No return value check
                 Fix: require() on return value or try/catch
                 Cost: User funds lost

              5. FRONT-RUNNING (MEV)
                 Attack: Observe pending transaction, insert own transaction before
                 Target: Price-sensitive operations (swaps, liquidations)
                 Mitigation: Time locks, randomization, private mempools
            `,
          },
          {
            title: 'Audit Methodology',
            content: `
              Professional Smart Contract Audit Process:

              1. Automated Analysis (Tools)
                 - Slither: Static analysis for 70+ vulnerability patterns
                 - Mythril: Symbolic execution to find state space issues
                 - Echidna: Fuzz testing for invariant violations
                 - Manticore: Program analysis at scale

              2. Manual Code Review
                 - Line-by-line analysis by experienced auditors
                 - Check for business logic flaws
                 - Verify cryptographic implementations
                 - Confirm gas optimization assumptions

              3. Test Coverage
                 - 100% line coverage minimum
                 - Edge cases: zero amounts, max values, overflow scenarios
                 - Interaction testing between contracts

              4. Formal Verification
                 - Prove mathematical properties
                 - Example: "mint() always increases totalSupply"
                 - Languages: Certora, Why3, Isabelle

              5. Staging & Monitoring
                 - Deploy to testnet (Goerli, Sepolia)
                 - Monitor for 2+ weeks before mainnet
                 - Have emergency pause mechanisms
                 - Set up on-chain monitoring alerts
            `,
          },
        ],
        key_takeaways: [
          'REENTRANCY and OVERFLOW are the most common critical bugs',
          'Checks-Effects-Interactions (CEI) pattern prevents reentrancy',
          'Combination of automated + manual + formal verification needed',
        ],
      },
    ],
  },

  98: {
    title: 'IoT & Edge Security',
    summary: 'Securing billions of connected devices',
    lessons: [
      {
        number: 1,
        title: 'IoT Architecture & Threat Landscape',
        duration_minutes: 55,
        sections: [
          {
            title: 'IoT Device Lifecycle',
            content: `
              Typical IoT Device Lifecycle:

              1. Manufacturing
                 - Supply chain security
                 - Device identity provisioning
                 - Firmware preload and signing

              2. Deployment
                 - Bootstrap authentication
                 - Certificate installation
                 - Network enrollment

              3. Operation
                 - Regular firmware updates
                 - Anomaly monitoring
                 - Network segmentation

              4. Maintenance
                 - Patch management
                 - Secret rotation
                 - Performance optimization

              5. Retirement
                 - Secure wiping
                 - Credential revocation
                 - Proper disposal

              Threat Window: Largest during manufacturing (supply chain risks)
            `,
          },
        ],
        key_takeaways: [
          'IoT lifecycle spans manufacturing to disposal',
          'Each phase has distinct security requirements',
          'Supply chain security is critical first defense',
        ],
      },
    ],
  },

  99: {
    title: 'Privacy Engineering',
    summary: 'Building systems that respect user privacy',
    lessons: [
      {
        number: 1,
        title: 'Privacy by Design & Differential Privacy',
        duration_minutes: 70,
        sections: [
          {
            title: 'Differential Privacy Mathematics',
            content: `
              Differential Privacy provides formal privacy guarantees:

              Mathematical Definition:
              An algorithm M satisfies (ε, δ)-differential privacy if for any
              two datasets D and D' differing in one record:

              P(M(D) ∈ S) ≤ e^ε · P(M(D') ∈ S) + δ

              Intuition:
              - ε (epsilon): Privacy loss parameter (smaller = more privacy)
              - δ (delta): Probability of violation
              - Typical: (0.1, 10^-6) for strong privacy

              Practical Example: Census Query

              Without DP:
                Q: "How many people in ZIP 12345?"
                A: 50,247 ← Can uniquely identify individuals

              With DP (ε=0.5):
                Q: "How many people in ZIP 12345?"
                A: 50,194 ← Noise added, individual unidentifiable
                   (true answer ± Laplacian noise with scale 1/ε)

              Key Property: Composability
              - Running k independent queries costs ε·k total privacy loss
              - Privacy budget must be allocated strategically
            `,
          },
        ],
        key_takeaways: [
          'Differential privacy provides mathematically-proven privacy',
          'Trade-off between privacy and data utility',
          'Epsilon budget must be allocated across queries',
        ],
      },
    ],
  },

  100: {
    title: 'Security Career Paths',
    summary: 'Planning your cybersecurity career',
    lessons: [
      {
        number: 1,
        title: 'Security Career Landscape',
        duration_minutes: 50,
        sections: [
          {
            title: 'Career Progression Paths',
            content: `
              Common Security Career Trajectories:

              1. Penetration Testing Track
                 Entry: Security Analyst / Junior PenTester
                   - Requirements: CompTIA Security+, some OSCP
                   - Salary: $70-90K
                   - Focus: Vulnerability scanning, basic exploitation

                 Mid: Professional PenTester
                   - Requirements: OSCP, GPEN
                   - Salary: $100-140K
                   - Focus: Full assessments, report writing, methodology

                 Senior: Principal Security Consultant
                   - Requirements: OSCE, CEH, years of experience
                   - Salary: $150-200K+
                   - Focus: Security strategy, client relationships

              2. Cloud Security Track
                 Entry: Cloud Security Analyst
                   - Requirements: AWS Security Associate or Azure Fundamentals
                   - Salary: $75-95K
                   - Focus: IAM, compliance, misconfigurations

                 Mid: Cloud Security Architect
                   - Requirements: AWS SA Professional, CCSK
                   - Salary: $120-160K
                   - Focus: Architecture design, compliance frameworks

                 Senior: CISO / Chief Security Officer
                   - Requirements: CISSP, 10+ years, management skills
                   - Salary: $200-300K+
                   - Focus: Enterprise security strategy

              3. Incident Response Track
                 Entry: SOC Analyst (Tier 1)
                   - Requirements: Security+ or similar
                   - Salary: $50-70K
                   - Focus: Alert monitoring, triage

                 Mid: Incident Response Specialist
                   - Requirements: GCIH, CEH, incident experience
                   - Salary: $90-120K
                   - Focus: Investigation, remediation

                 Senior: CIRT Director
                   - Requirements: Leadership, CISSP, expertise
                   - Salary: $150-200K+
                   - Focus: Incident strategy, coordination

              4. Application Security Track
                 Entry: AppSec Analyst
                   - Requirements: GWAPT, secure coding knowledge
                   - Salary: $80-100K
                   - Focus: Code review, testing

                 Mid: AppSec Engineer
                   - Requirements: OSCP/GPEN, multiple languages
                   - Salary: $120-150K
                   - Focus: Secure architecture, DevSecOps

                 Senior: Principal AppSec Architect
                   - Requirements: Deep expertise, 10+ years
                   - Salary: $160-220K+
                   - Focus: Enterprise secure development
            `,
          },
        ],
        key_takeaways: [
          'Multiple specialization paths with different earning potential',
          'Certifications provide credential progression',
          'Leadership roles require both technical depth and people skills',
        ],
      },
    ],
  },
};

export function getModuleContent(moduleNumber: number) {
  return ADVANCED_MODULE_CONTENT[moduleNumber as keyof typeof ADVANCED_MODULE_CONTENT];
}

export function getModuleLessons(moduleNumber: number) {
  const content = getModuleContent(moduleNumber);
  return content?.lessons || [];
}

export function getModuleLessonContent(moduleNumber: number, lessonNumber: number) {
  const lessons = getModuleLessons(moduleNumber);
  return lessons.find((l) => l.number === lessonNumber);
}
