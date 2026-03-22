# Finished goods (FG) and QA — roadmap

FG and QA are **separate** from raw-material QC. This file records **Phase 7** follow-ups; core RM flows are documented in [LIFECYCLE.md](./LIFECYCLE.md).

## Target flow (client spec)

1. Production completes a batch.
2. Production user registers **FG** and **shipper label** in the system.
3. QA Executive inspects quantity and quality (FG **QA_PENDING**).
4. QA Head approves or rejects; optional **revise entry** (QA Head only).
5. Warehouse **receives** FG into stock after QA approval, then **dispatches**.

## Already in the codebase (baseline)

- `FinishedGoodsBatch` with statuses including `QA_PENDING`, `QA_APPROVED`, `WAREHOUSE_RECEIVED`, `DISPATCHED`.
- Production: create FG batch, QR + shipper label generation.
- QA: inspect / approve / reject endpoints and mobile flows for **QA-pending** FG only.
- Warehouse: receive FG, dispatch FG.

## Suggested next enhancements

- QA Head–only **revise FG entry** API + audit trail.
- Purchase / read-only **FG stock** views if required.
- Stronger **separation of duties** checks (who can create vs approve FG).

Use this document when prioritising sprints after RM depth (retest, grade transfer, stock reporting) is stable.
