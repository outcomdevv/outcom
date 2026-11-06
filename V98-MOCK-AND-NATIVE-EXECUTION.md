# V98 — Mock + Native Execution Foundation

## Implemented
- A deterministic in-memory mock provider for demos and automated tests.
- A typed provider contract and registry for future Outcom-native integrations.
- Separate execution and verification outcomes: succeeded, failed, blocked, verification_failed.
- Mock idempotency within one provider instance using the supplied idempotency key.
- Simulation evidence is explicitly marked with mode `simulation` and `simulated: true`.

## Safety boundaries
- The mock provider performs no network, database, n8n, CRM, or customer-system writes.
- Simulation success is not evidence of a real-world repair.
- The engine has no default provider. A provider must be explicitly registered by trusted server code.
- Live providers require recorded approval and pass the workspace autonomy gate.
- No production live provider is registered and no public live-execution endpoint is added in this change.

## Not yet implemented
- Durable execution-attempt storage and atomic idempotency across server instances.
- Provider-specific write adapters and credential/permission scopes.
- Database-backed rate limits and cooldown enforcement.
- End-to-end integration tests against a real external system.
- UI for simulation and execution evidence.

## Test
`npm run test:unit -- tests/v98-execution.test.ts tests/v98-autonomy.test.ts`

A passing mock test proves only the simulator and engine contract behave as tested. It does not prove any external provider integration works.
