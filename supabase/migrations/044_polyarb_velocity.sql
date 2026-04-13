-- Migration 044: Add velocity_snapshot column to polyarb_telemetry
-- Stores the output of the Velocity Detector (Superpower #1) per agent tick.
-- Data: array of VelocitySignal objects (one per tracked Polymarket market).

ALTER TABLE polyarb_telemetry
  ADD COLUMN IF NOT EXISTS velocity_snapshot jsonb;

COMMENT ON COLUMN polyarb_telemetry.velocity_snapshot IS
  'Velocity Detector signals: [{conditionId, symbol, question, huntStrength, velocityProbDelta, lagEstimateMinutes, isAccelerating, windows, milestone}]';
