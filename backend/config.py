import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
CASES_DIR = DATA_DIR / "cases"
DATABASE_PATH = BASE_DIR / "data.db"

# Create directories if they don't exist
CASES_DIR.mkdir(parents=True, exist_ok=True)

# API settings
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))

# Frontend URL (for CORS)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Database
DB_PATH = str(DATABASE_PATH)

# Image settings
MAX_IMAGE_SIZE_MB = 500
ALLOWED_EXTENSIONS = [".dcm", ".dicom"]

# AI Model settings
CONFIDENCE_THRESHOLD = 0.70
URGENT_BIRADS = 5
CONCERNING_BIRADS = 4
