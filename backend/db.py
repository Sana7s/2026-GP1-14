"""
BurnCare — db.py
-----------------------------------------------------------------------
Connects Flask to the PostgreSQL database.

Every request gets ONE database connection. It is opened the first time
a route needs it (get_db) and closed automatically when the request ends
(close_db). The small helper functions below run SQL and return rows as
Python dictionaries, e.g. {"account_id": 1, "email": "sara@example.com"}.

SQL values are always passed separately as "params" (the %s marks).
Never put user input inside the SQL text yourself: passing params lets
psycopg2 escape them safely and protects against SQL injection.
"""

import psycopg2
import psycopg2.extras
from flask import current_app, g


def get_db():
    """Return this request's database connection (opens it if needed)."""
    if "db" not in g:
        g.db = psycopg2.connect(current_app.config["DATABASE_URL"])
    return g.db


def close_db(error=None):
    """Close the connection at the end of the request."""
    db = g.pop("db", None)
    if db is not None:
        if error is not None:
            db.rollback()  # something went wrong: undo unsaved changes
        db.close()


def query_all(sql, params=()):
    """Run a SELECT and return every row as a list of dictionaries."""
    with get_db().cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def query_one(sql, params=()):
    """Run a SELECT (or INSERT ... RETURNING) and return ONE row, or None."""
    with get_db().cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute(sql, params=()):
    """Run an INSERT / UPDATE / DELETE that does not return rows."""
    with get_db().cursor() as cur:
        cur.execute(sql, params)


def commit():
    """Save all changes made during this request."""
    get_db().commit()


def init_app(app):
    """Tell Flask to close the connection after every request."""
    app.teardown_appcontext(close_db)
