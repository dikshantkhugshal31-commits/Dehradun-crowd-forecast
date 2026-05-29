# 🏔️ Dehradun Tourist Crowd Forecast — Flask App

Real-time crowd forecast for Dehradun's top tourist spots, with live weather from Open-Meteo and ML-powered predictions (XGBoost + Prophet).

---

## Project Structure

```
dehradun/
├── app.py                    # Flask server (routes + API endpoints)
├── train.py                  # ML training pipeline (run once)
├── requirements.txt          # Flask-only dependencies
├── requirements-ml.txt       # Full deps including XGBoost/Prophet
├── templates/
│   └── index.html            # Jinja2 HTML template
├── static/
│   ├── css/styles.css        # All styles
│   └── js/
│       ├── app.js            # Frontend controller
│       ├── data.js           # Place data + crowd logic
│       └── api.js            # API client (calls Flask endpoints)
└── data/                     # CSV outputs from train.py
    ├── daily_tourists_historical.csv
    └── daily_tourists_<year>.csv
```

---

## Quick Start (Web App Only)

The app works immediately — no ML training needed. It uses smart synthetic fallback data if no CSVs exist, and fetches live weather from Open-Meteo (free, no API key).

```bash
# 1. Create a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install Flask dependencies
pip install -r requirements.txt

# 3. Run
python app.py
```

Then open **http://localhost:5000** in your browser.

---

## Running the ML Pipeline (Optional)

To regenerate predictions using your own `draft1-dataset1.xlsx`:

```bash
# Install full dependencies (includes XGBoost, Prophet, pytrends)
pip install -r requirements-ml.txt

# Place your Excel file in the project root
cp /path/to/draft1-dataset1.xlsx .

# Train and generate prediction CSVs
python train.py
```

This creates `data/daily_tourists_<year>.csv` which the Flask app automatically picks up.

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Main web app |
| `GET /api/weather` | Live weather for Dehradun (Open-Meteo) |
| `GET /api/predictions/monthly` | Monthly tourist totals for current year |
| `GET /api/predictions/daily?year=2026&month=5` | Daily breakdown for a month |
| `GET /api/status` | Server + ML data status |

---

## Production Deployment

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

Or set environment variable `PORT` to change the port:
```bash
PORT=8080 python app.py
```
