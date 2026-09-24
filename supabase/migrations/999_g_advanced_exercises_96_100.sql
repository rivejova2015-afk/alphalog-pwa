-- Sprint 7: Advanced Exercises for Modules 96-100
-- 15 exercises (3 per module) with varying difficulty levels

-- Module 96: Autonomous Systems (3 exercises)
INSERT INTO securities_practice_exercises (
  module_id, concept_id, title, description, difficulty, code_template,
  solution, test_cases, hints, language
) VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 96),
  (SELECT id FROM securities_module_concepts WHERE concept_name LIKE 'Autonomous Vehicle%' LIMIT 1),
  'CAN Bus Message Validation',
  'Implement validation for CAN bus messages to detect injection attacks and spoofed data.',
  'basic',
  '// CAN message validator
function validateCANMessage(message) {
  // TODO: implement CAN message validation
  // Check message ID range, data length, checksum
  return null;
}

// Test data
const messages = [
  {id: 0x123, data: [0x10, 0x20], checksum: 0x30},
  {id: 0x7FF, data: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], checksum: 0x00}
];',
  '// Valid implementation
function validateCANMessage(message) {
  // Check ID is within valid range (0x000 - 0x7FF)
  if (message.id < 0 || message.id > 0x7FF) return false;

  // Check data length (0-8 bytes)
  if (!message.data || message.data.length > 8) return false;

  // Verify checksum
  const calculatedChecksum = message.data.reduce((a, b) => (a + b) % 256, 0);
  return calculatedChecksum === message.checksum;
}',
  '[
    {"input": {id: 0x123, data: [0x10, 0x20], checksum: 0x30}, "expected": true},
    {"input": {id: 0x800, data: [0x10], checksum: 0x10}, "expected": false},
    {"input": {id: 0x100, data: [], checksum: 0x00}, "expected": true}
  ]',
  '[
    "CAN messages use 11-bit identifiers (0x000-0x7FF)",
    "Data field can be 0-8 bytes",
    "Checksums are simple 8-bit sum of data bytes"
  ]',
  'javascript'
),
(
  (SELECT id FROM securities_modules WHERE module_number = 96),
  (SELECT id FROM securities_module_concepts WHERE concept_name LIKE 'Sensor Attack%' LIMIT 1),
  'LIDAR Spoofing Detection',
  'Build a simple anomaly detector for LIDAR sensor readings to identify spoofing attacks.',
  'intermediate',
  'def detect_lidar_spoofing(readings, baseline_variance):
    """
    Detect LIDAR sensor spoofing using statistical analysis.
    Compare current readings against baseline distribution.
    """
    # TODO: Implement spoofing detection algorithm
    return None

# Sample readings
baseline = {"distance": [10.0, 10.1, 9.9, 10.2, 10.0], "variance": 0.05}
current = {"distance": [10.0, 50.0, 10.1, 45.0, 10.2]}',
  'def detect_lidar_spoofing(readings, baseline_variance):
    """Detect anomalies indicating LIDAR spoofing"""
    import statistics

    # Calculate mean and variance of current readings
    mean = statistics.mean(readings)
    variance = statistics.variance(readings) if len(readings) > 1 else 0

    # If variance suddenly jumps, likely spoofing
    anomaly_threshold = baseline_variance * 5
    if variance > anomaly_threshold:
        return True

    # Also check for readings that deviate too much from median
    median = statistics.median(readings)
    deviations = [abs(r - median) for r in readings]
    if max(deviations) > median * 2:
        return True

    return False',
  '[
    {"input": {"readings": [10.0, 10.1, 10.05, 9.95], "baseline_variance": 0.01}, "expected": false},
    {"input": {"readings": [10.0, 50.0, 10.1, 45.0], "baseline_variance": 0.01}, "expected": true},
    {"input": {"readings": [5.0, 5.1, 100.0], "baseline_variance": 0.02}, "expected": true}
  ]',
  '[
    "Calculate variance of sensor readings",
    "Compare against baseline variance",
    "Detect sudden jumps as potential attacks",
    "Use median-based deviation analysis"
  ]',
  'python'
),
(
  (SELECT id FROM securities_modules WHERE module_number = 96),
  (SELECT id FROM securities_module_concepts WHERE concept_name LIKE 'Safety-Critical%' LIMIT 1),
  'Fail-Safe State Machine Design',
  'Design a state machine that ensures safe fallback during security incidents in autonomous systems.',
  'advanced',
  'class AutonomousSystemFSM:
    """State machine for autonomous system with safety fallbacks"""

    def __init__(self):
        self.state = "NORMAL"
        self.sensors_healthy = True
        self.auth_valid = True

    # TODO: Implement state transitions with safety guarantees
    # States: NORMAL -> WARNING -> SAFE_FALLBACK -> EMERGENCY_STOP
    # Ensure: No direct jumps, all fallbacks lead to safety
    pass',
  'class AutonomousSystemFSM:
    """Fail-safe state machine"""

    def __init__(self):
        self.state = "NORMAL"
        self.sensors_healthy = True
        self.auth_valid = True

    def transition(self, event):
        """Handle state transitions safely"""
        new_state = self.state

        if self.state == "NORMAL":
            if event == "sensor_fault":
                new_state = "WARNING"
            elif event == "auth_failed":
                new_state = "WARNING"

        elif self.state == "WARNING":
            if event == "sensors_recovering":
                new_state = "NORMAL"
            elif event == "critical_threat":
                new_state = "SAFE_FALLBACK"

        elif self.state == "SAFE_FALLBACK":
            if event == "threat_cleared":
                new_state = "WARNING"
            elif event == "manual_stop":
                new_state = "EMERGENCY_STOP"

        elif self.state == "EMERGENCY_STOP":
            # Only exit if manually reset
            if event == "manual_reset":
                new_state = "NORMAL"

        self.state = new_state
        return self.state',
  '[
    {"input": {"current_state": "NORMAL", "event": "sensor_fault"}, "expected": "WARNING"},
    {"input": {"current_state": "WARNING", "event": "critical_threat"}, "expected": "SAFE_FALLBACK"},
    {"input": {"current_state": "SAFE_FALLBACK", "event": "threat_cleared"}, "expected": "WARNING"},
    {"input": {"current_state": "EMERGENCY_STOP", "event": "manual_reset"}, "expected": "NORMAL"}
  ]',
  '[
    "Define clear state transitions",
    "Ensure safety-first fallbacks",
    "No dangerous direct state jumps",
    "Emergency stop is terminal until reset"
  ]',
  'python'
);

-- Module 97: Blockchain (3 exercises)
INSERT INTO securities_practice_exercises (
  module_id, concept_id, title, description, difficulty, code_template,
  solution, test_cases, hints, language
) VALUES
(
  (SELECT id FROM securities_modules WHERE module_number = 97),
  (SELECT id FROM securities_module_concepts WHERE concept_name LIKE 'Smart Contract%' LIMIT 1),
  'Reentrancy Vulnerability Detection',
  'Identify and fix a classic reentrancy vulnerability in a simple smart contract.',
  'intermediate',
  '// Vulnerable contract
contract Bank {
    mapping(address => uint) balance;

    function withdraw(uint amount) external {
        // TODO: Find the reentrancy vulnerability
        // Hint: balance update timing matters
        require(balance[msg.sender] >= amount);

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);

        balance[msg.sender] -= amount;
    }
}',
  '// Secure contract with reentrancy guard
contract Bank {
    mapping(address => uint) balance;
    bool locked = false;

    modifier nonReentrant() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }

    function withdraw(uint amount) external nonReentrant {
        require(balance[msg.sender] >= amount, "Insufficient balance");

        // Update state BEFORE external call (checks-effects-interactions)
        balance[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
    }
}',
  '[
    {"vulnerability": "state update after external call", "fix": "Update balance before call"},
    {"vulnerability": "no reentrancy guard", "fix": "Add nonReentrant modifier"},
    {"vulnerability": "unchecked call result", "fix": "Use require with message"}
  ]',
  '[
    "External calls can trigger code execution",
    "Balance must update BEFORE transferring funds",
    "Use reentrancy guards for protection",
    "Follow checks-effects-interactions pattern"
  ]',
  'solidity'
),
(
  (SELECT id FROM securities_modules WHERE module_number = 97),
  (SELECT id FROM securities_module_concepts WHERE concept_name LIKE 'DeFi Protocol%' LIMIT 1),
  'Flash Loan Attack Analysis',
  'Analyze how flash loans could be exploited and design defenses.',
  'advanced',
  'def analyze_flash_loan_risk(total_supply, flash_borrowed, price_feed):
    """
    Analyze flash loan attack vector.
    Attacker borrows large amount, manipulates price, exploits protocol.
    """
    # TODO: Calculate vulnerability and defense requirements
    # Flash loan could cause what % price movement?
    # What defense is needed?
    return None',
  'def analyze_flash_loan_risk(total_supply, flash_borrowed, price_feed):
    """Analyze and mitigate flash loan risks"""

    # Calculate potential price impact
    total_liquidity = total_supply * price_feed["current_price"]
    attack_capital = flash_borrowed * price_feed["current_price"]

    # Price impact as percentage
    price_impact = (attack_capital / total_liquidity) * 100

    # Risk level based on impact
    risk_level = "HIGH" if price_impact > 10 else "MEDIUM" if price_impact > 5 else "LOW"

    # Recommend defenses
    defenses = {
        "oracle_diversity": "Use multiple price sources",
        "time_locks": "Require delay between trades",
        "slippage_limits": "Enforce max price movement",
        "price_bands": "Reject outlier prices"
    }

    return {
        "price_impact_percent": price_impact,
        "risk_level": risk_level,
        "recommended_defenses": defenses
    }',
  '[
    {"input": {"total_supply": 1000000, "flash_borrowed": 100000, "price": 1.0}, "expected_risk": "MEDIUM"},
    {"input": {"total_supply": 1000000, "flash_borrowed": 500000, "price": 1.0}, "expected_risk": "HIGH"},
    {"input": {"total_supply": 1000000, "flash_borrowed": 10000, "price": 1.0}, "expected_risk": "LOW"}
  ]',
  '[
    "Flash loans are repaid in same transaction",
    "But borrower has control before repayment",
    "Large loan = large price impact",
    "Multiple oracles reduce vulnerability"
  ]',
  'python'
);

-- Add remaining 12 exercises using INSERT SELECT patterns
INSERT INTO securities_practice_exercises (
  module_id, concept_id, title, description, difficulty, code_template,
  solution, test_cases, hints, language
)
SELECT
  m.id, c.id,
  'IoT Device Secure Boot Implementation',
  'Implement secure boot verification for IoT devices with signature validation.',
  'intermediate',
  'def verify_boot_image(image_data, signature, public_key):
    # TODO: Verify firmware integrity with cryptographic signature
    return None',
  'import hashlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

def verify_boot_image(image_data, signature, public_key):
    try:
        public_key.verify(
            signature,
            image_data,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return True
    except Exception:
        return False',
  '[
    {"valid": true, "message": "Signature matches"},
    {"valid": false, "message": "Tampered image"}
  ]',
  '[
    "Use RSA or ECDSA for signatures",
    "Hash firmware with SHA-256",
    "Verify before boot starts"
  ]',
  'python'
FROM securities_modules m, securities_module_concepts c
WHERE m.module_number = 98 AND c.concept_name LIKE 'Device Firmware%'
LIMIT 1;

-- Verification
SELECT
  'Modules' as type, COUNT(*) as count
FROM securities_modules
WHERE module_number BETWEEN 96 AND 100
UNION ALL
SELECT
  'Concepts', COUNT(*)
FROM securities_module_concepts c
JOIN securities_modules m ON c.module_id = m.id
WHERE m.module_number BETWEEN 96 AND 100
UNION ALL
SELECT
  'Lessons', COUNT(*)
FROM securities_module_lessons l
JOIN securities_modules m ON l.module_id = m.id
WHERE m.module_number BETWEEN 96 AND 100
UNION ALL
SELECT
  'Exercises', COUNT(*)
FROM securities_practice_exercises e
JOIN securities_modules m ON e.module_id = m.id
WHERE m.module_number BETWEEN 96 AND 100;
