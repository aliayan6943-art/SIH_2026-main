"""
MediKiosk — Database Setup
Handles NeonDB (PostgreSQL) with automatic schema migration for new columns.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medikiosk.db")

_is_sqlite = "sqlite" in SQLALCHEMY_DATABASE_URL

def _create_engine(url, is_sqlite):
    return create_engine(
        url,
        connect_args={"check_same_thread": False} if is_sqlite else {},
        pool_pre_ping=True,
    )

engine = _create_engine(SQLALCHEMY_DATABASE_URL, _is_sqlite)

# Connection fallback: If NeonDB fails (e.g. DNS issues), fallback to local SQLite
try:
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"[Database] Failed to connect to {SQLALCHEMY_DATABASE_URL}: {e}")
    print("[Database] Falling back to local SQLite database.")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./medikiosk_fallback.db"
    _is_sqlite = True
    engine = _create_engine(SQLALCHEMY_DATABASE_URL, _is_sqlite)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """
    Add new columns to existing tables without dropping data.
    Safe to run on every startup — uses IF NOT EXISTS pattern.
    This handles the case where NeonDB already has older schema.
    """
    if _is_sqlite:
        # SQLite: add columns that might be missing
        migrations = [
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en'",
            "ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_ayush BOOLEAN DEFAULT FALSE",
            "ALTER TABLE visits ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en'",
            "ALTER TABLE visits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE clinical_summaries ADD COLUMN IF NOT EXISTS chief_complaint TEXT",
            "ALTER TABLE clinical_summaries ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en'",
            "ALTER TABLE clinical_summaries ADD COLUMN IF NOT EXISTS is_ayush BOOLEAN DEFAULT FALSE",
            "ALTER TABLE clinical_summaries ADD COLUMN IF NOT EXISTS prose_summary TEXT",
            "ALTER TABLE clinical_summaries ADD COLUMN IF NOT EXISTS raw_history TEXT",
        ]
    else:
        # PostgreSQL (NeonDB): use DO $$ blocks for conditional ALTER
        migrations = [
            """
            DO $$ BEGIN
                ALTER TABLE patients ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'en';
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE visits ADD COLUMN is_ayush BOOLEAN DEFAULT FALSE;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE visits ADD COLUMN language VARCHAR(5) DEFAULT 'en';
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE clinical_summaries ADD COLUMN chief_complaint TEXT;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE clinical_summaries ADD COLUMN language VARCHAR(5) DEFAULT 'en';
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE clinical_summaries ADD COLUMN is_ayush BOOLEAN DEFAULT FALSE;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE clinical_summaries ADD COLUMN prose_summary TEXT;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE clinical_summaries ADD COLUMN raw_history TEXT;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
            """
            DO $$ BEGIN
                ALTER TABLE visits ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
            """,
        ]

    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                print(f"[Migration] Warning: {e} — skipping")
                conn.rollback()

    print("[Database] Schema migrations complete.")
