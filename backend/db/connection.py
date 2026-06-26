import sqlite3
from config import DB_PATH

def get_connection():
    """Get SQLite database connection"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row      # Returns rows as dicts
    return conn

def init_db():
    """Initialize database - create all tables"""
    from db.schema import create_tables
    create_tables()
