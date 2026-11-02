from pathlib import Path
import os
ROOT = Path(__file__).resolve().parents[3]
_BUNDLED_DATA = Path(__file__).resolve().parents[2] / 'runtime-data'
DATA_ROOT = _BUNDLED_DATA if _BUNDLED_DATA.exists() else ROOT / 'data'
DATA = DATA_ROOT / 'processed'
MODELS = ROOT / 'models'
ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://127.0.0.1:5173')
