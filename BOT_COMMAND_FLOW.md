# Command / ACK Flow (Strict Mode)

```mermaid
flowchart TD
  A[User issues command] --> B[Insert bot_commands + bot_command_status (PENDING)]
  B --> C[EA polls /bot-commands every 10s]
  C --> D{Command applies?}
  D -- yes --> E[EA executes + POST /bot-ack (APPLIED)]
  D -- no --> F[EA POST /bot-ack (FAILED)]
  E --> G{All accounts ACK?}
  F --> G
  G -- all APPLIED --> H[bot_commands = APPLIED]
  G -- any FAILED --> I[bot_commands = FAILED]
  B --> J[Timer 60s]
  J --> K{Still PENDING?}
  K -- yes --> L[bot_command_status = FAILED]
  L --> M[bot_event + push]
```

Notas:
- Timeout job: /bot-command-timeout (cron, 60s).
- Push: usa /api/push/notify-user si está configurado.
