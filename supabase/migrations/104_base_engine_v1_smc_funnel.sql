-- Migration 104: rewrite the base_engine_v1 template to the real SMC funnel.
-- Migration 096 seeded a 6-TF EMA-cascade shape (D1/H4/H1/M15/M5/M1 with
-- trend/structure roles + weights). The actual Base Engine v1 is a 4-TF
-- top-down SMC funnel — D1 levels → H1 structure → M15 BOS+OB → M1 entry —
-- and it gates sequentially, it does not weight-average. This realigns the
-- template's multi_tf block with the engine the evaluator now implements.

UPDATE public.algorithm_templates
SET parameters = jsonb_set(
  parameters,
  '{multi_tf}',
  '{
    "timeframes": [
      {"tf": "D1",  "weight": 0, "role": "daily_levels"},
      {"tf": "H1",  "weight": 0, "role": "session_structure"},
      {"tf": "M15", "weight": 0, "role": "bos_ob"},
      {"tf": "M1",  "weight": 0, "role": "entry"}
    ],
    "sessions": {
      "XAUUSD": [
        {"name": "London", "start_gmt": "08:00", "end_gmt": "12:00"},
        {"name": "NY",     "start_gmt": "13:30", "end_gmt": "17:00"}
      ],
      "US500": [
        {"name": "NY", "start_gmt": "13:30", "end_gmt": "20:00"}
      ]
    }
  }'::jsonb
)
WHERE template_key = 'base_engine_v1';

UPDATE public.algorithm_templates
SET description = 'Engine base SMC top-down: D1 marca el max/min del dia anterior y detecta la manipulacion, H1 define la estructura de sesion y la liquidez cercana, M15 confirma con Break of Structure (a favor o en contra) y marca el Order Block, M1 ejecuta la entrada en el OB o un FVG. Gating secuencial, no ponderado.'
WHERE template_key = 'base_engine_v1';
