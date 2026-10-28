"""SQLite data store for an explicitly unauthenticated LOCAL classroom prototype."""
import os, sqlite3, uuid, json
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager

DB_PATH = Path(os.environ.get('BURNCARE_DB', str(Path(__file__).resolve().parent / 'instance' / 'burncare.db')))
ROLES = ['Doctor', 'Nurse', 'Paramedic or ambulance crew', 'Burn specialist', 'Other']

def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def ident():
    return str(uuid.uuid4())

@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=10000')
    try:
        yield db
        db.commit()
    except:
        db.rollback()
        raise
    finally:
        db.close()

def initialize():
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS staff (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
          specialty TEXT NOT NULL DEFAULT '', organization TEXT NOT NULL,
          department TEXT NOT NULL DEFAULT '', license_number TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '', approval TEXT NOT NULL DEFAULT 'Not required',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY, patient_code TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES staff(id),
          injury_date TEXT NOT NULL, age INTEGER NOT NULL, pain INTEGER NOT NULL,
          mechanism TEXT NOT NULL, time_since TEXT NOT NULL, diabetes TEXT NOT NULL,
          regions TEXT NOT NULL, tbsa_method TEXT NOT NULL,
          tbsa_estimate REAL, tbsa_final REAL NOT NULL,
          medical_history TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
          emergency_json TEXT NOT NULL DEFAULT '{}', supplemental_json TEXT NOT NULL DEFAULT '{}',
          image_file TEXT NOT NULL, image_name TEXT NOT NULL, image_mime TEXT NOT NULL,
          created_at TEXT NOT NULL, updated_at TEXT,
          revision INTEGER NOT NULL DEFAULT 1,
          depth TEXT, destination TEXT, confidence REAL, heatmap_file TEXT
        );
        CREATE TABLE IF NOT EXISTS tbsa_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT NOT NULL REFERENCES reports(id),
          clinician_id TEXT NOT NULL REFERENCES staff(id), old_value REAL NOT NULL,
          new_value REAL NOT NULL, reason TEXT NOT NULL, changed_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS clinical_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          report_id TEXT NOT NULL REFERENCES reports(id),
          clinician_id TEXT NOT NULL REFERENCES staff(id),
          changes_json TEXT NOT NULL,
          reason TEXT NOT NULL,
          changed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS clinical_changes_report ON clinical_changes(report_id);
        CREATE TABLE IF NOT EXISTS consultations (
          id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id),
          requested_by TEXT NOT NULL REFERENCES staff(id), question TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Waiting', claimed_by TEXT REFERENCES staff(id),
          advice TEXT, created_at TEXT NOT NULL, claimed_at TEXT, answered_at TEXT, answered_revision INTEGER
        );
        CREATE INDEX IF NOT EXISTS consultations_status ON consultations(status);
        CREATE INDEX IF NOT EXISTS consultations_report ON consultations(report_id);
        ''')
        # Lightweight migrations for an existing local project database.
        columns = {row['name'] for row in db.execute('PRAGMA table_info(reports)')}
        if 'updated_at' not in columns:
            db.execute('ALTER TABLE reports ADD COLUMN updated_at TEXT')
        if 'revision' not in columns:
            db.execute('ALTER TABLE reports ADD COLUMN revision INTEGER NOT NULL DEFAULT 1')
        if 'emergency_json' not in columns:
            db.execute("ALTER TABLE reports ADD COLUMN emergency_json TEXT NOT NULL DEFAULT '{}'")
        if 'supplemental_json' not in columns:
            db.execute("ALTER TABLE reports ADD COLUMN supplemental_json TEXT NOT NULL DEFAULT '{}'")
        consult_columns = {row['name'] for row in db.execute('PRAGMA table_info(consultations)')}
        if 'answered_revision' not in consult_columns:
            db.execute('ALTER TABLE consultations ADD COLUMN answered_revision INTEGER')
        # New installations intentionally have no fabricated staff profiles.

def dictrow(row):
    return dict(row) if row else None

def report_obj(db, rid):
    r = db.execute('SELECT * FROM reports WHERE id=?', (rid,)).fetchone()
    if not r: return None
    value = dict(r)
    value['report_id'] = value.pop('id')
    value['regions'] = json.loads(value['regions'])
    value['emergency'] = json.loads(value.pop('emergency_json') or '{}')
    value['supplemental'] = json.loads(value.pop('supplemental_json') or '{}')
    value['audit'] = [dict(x) for x in db.execute('SELECT * FROM tbsa_changes WHERE report_id=? ORDER BY id DESC',(rid,))]
    value['clinical_audit'] = [
        {**dict(x), 'changes': json.loads(x['changes_json'])}
        for x in db.execute('SELECT * FROM clinical_changes WHERE report_id=? ORDER BY id DESC',(rid,))
    ]
    value['consultations'] = [dict(x) for x in db.execute('''SELECT id,question,status,created_at,claimed_at,answered_at,answered_revision,advice,claimed_by,requested_by FROM consultations WHERE report_id=? ORDER BY created_at DESC''',(rid,))]
    return value
