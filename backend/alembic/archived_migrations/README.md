# Archived Alembic revisions

These files are **not** loaded by Alembic (they live outside `versions/`).

They assumed tables already existed and failed on **empty** databases (`audit_logs` missing).

New deploys use **`versions/20260322_0001_initial_schema.py`** (`initial_schema_001`), which runs `Base.metadata.create_all()` from current models.

If you have an **existing** database that already applied these revisions, keep using your old migration history — do not run `initial_schema_001` on that DB (it would try to recreate tables). This archive is for reference only.
