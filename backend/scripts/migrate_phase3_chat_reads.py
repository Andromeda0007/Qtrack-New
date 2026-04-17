"""
Schema migration for Phase 3: chat read-receipts.

Creates:
  - Table `chat_message_reads` (message_id, user_id, read_at)
  - Unique constraint (message_id, user_id)
  - Index (user_id, message_id)

Safety:
  - Dry run by default (prints SQL, does not commit)
  - --apply to execute
  - Idempotent (IF NOT EXISTS)

Usage:
  python scripts/migrate_phase3_chat_reads.py          # dry run
  python scripts/migrate_phase3_chat_reads.py --apply  # commit
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import psycopg2  # noqa: E402


SQL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS chat_message_reads (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        read_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_message_user_read UNIQUE (message_id, user_id)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_chat_message_reads_message_id ON chat_message_reads(message_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_chat_message_reads_user_id ON chat_message_reads(user_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_chat_reads_user_msg ON chat_message_reads(user_id, message_id);
    """,
]


def normalize_db_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def main():
    parser = argparse.ArgumentParser(description="Phase 3 chat read-receipts migration.")
    parser.add_argument("--apply", action="store_true", help="Commit the migration.")
    args = parser.parse_args()

    env_path = BACKEND_DIR.parent / ".env"
    if not env_path.exists():
        env_path = BACKEND_DIR / ".env"
    load_dotenv(env_path)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print(f"ERROR: DATABASE_URL not set (looked in {env_path})", file=sys.stderr)
        return 1

    db_url = normalize_db_url(db_url)

    if not args.apply:
        for stmt in SQL_STATEMENTS:
            print(">>", stmt.strip()[:80], "...")
        print("\n(dry run — pass --apply to execute)")
        return 0

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        for stmt in SQL_STATEMENTS:
            print(">>", stmt.strip()[:80], "...")
            cur.execute(stmt)
        conn.commit()
        print("\nMigration applied successfully.")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        cur.close()
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
