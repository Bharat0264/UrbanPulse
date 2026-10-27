from pathlib import Path
import os
ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'data' / 'processed'
MODELS = ROOT / 'models'
ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://127.0.0.1:5173')
