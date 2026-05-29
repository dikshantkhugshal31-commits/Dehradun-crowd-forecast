"""
app.py — Flask server for Dehradun Tourist Crowd Forecast
Serves the frontend and exposes REST endpoints for crowd/weather/prediction data.
"""

from flask import Flask, jsonify, render_template, send_from_directory, abort
import os, json, csv, math, random
from datetime import datetime, date
import requests

app = Flask(__name__, template_folder="templates", static_folder="static")

# ─── WEATHER ─────────────────────────────────────────────────────────────────

def fetch_live_weather():
    """Fetch live weather from Open-Meteo (free, no key needed)."""
    try:
        url = (
            "https://api.open-meteo.com/v1/forecast?"
            "latitude=30.3165&longitude=78.0322"
            "&current=temperature_2m,precipitation,weathercode,relative_humidity_2m"
            "&timezone=Asia%2FKolkata"
        )
        r = requests.get(url, timeout=5)
        d = r.json()["current"]

        code = d.get("weathercode", 0)
        temp = round(d.get("temperature_2m", 22), 1)
        rain = d.get("precipitation", 0)

        if code in range(0, 2):
            condition, icon = "sunny", "☀️"
        elif code in range(2, 50):
            condition, icon = "cloudy", "⛅"
        elif code in range(50, 80):
            condition, icon = "rainy", "🌧️"
        elif code in range(80, 100):
            condition, icon = "rainy", "⛈️"
        else:
            condition, icon = "foggy", "🌫️"

        if rain > 3:
            condition, icon = "rainy", "🌧️"

        return {"temperature": temp, "condition": condition, "icon": icon,
                "humidity": d.get("relative_humidity_2m", 60), "ok": True}
    except Exception as e:
        app.logger.warning(f"Weather fetch failed: {e}")
        return {"temperature": 22, "condition": "sunny", "icon": "☀️",
                "humidity": 55, "ok": False}


# ─── PREDICTION DATA ─────────────────────────────────────────────────────────

def load_predictions():
    """Load precomputed daily CSV if available, else return None."""
    year = datetime.now().year
    for fname in [f"data/daily_tourists_{year}.csv",
                  "data/daily_tourists_historical.csv"]:
        path = os.path.join(os.path.dirname(__file__), fname)
        if os.path.exists(path):
            rows = []
            with open(path, newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    rows.append(row)
            return rows
    return None


def synthetic_monthly(year):
    """
    Fallback: generate realistic-looking monthly tourist numbers
    if no ML output CSV exists yet.
    """
    base = 380000
    seasonal = [0.55, 0.60, 0.85, 0.95, 1.0, 0.90,
                0.65, 0.70, 0.80, 0.88, 0.75, 0.70]
    result = {}
    for m, s in enumerate(seasonal, 1):
        noise = 1 + random.uniform(-0.04, 0.04)
        result[m] = round(base * s * noise)
    return result


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/weather")
def api_weather():
    return jsonify(fetch_live_weather())


@app.route("/api/predictions/monthly")
def api_predictions_monthly():
    """Return monthly tourist totals for the current year."""
    year = datetime.now().year
    rows = load_predictions()
    monthly = {}

    if rows:
        for row in rows:
            try:
                d = datetime.strptime(row["Date"], "%Y-%m-%d")
            except (KeyError, ValueError):
                continue
            if d.year != year:
                continue
            m = d.month
            monthly[m] = monthly.get(m, 0) + float(row.get("Tourists", 0))
        monthly = {k: round(v) for k, v in monthly.items()}

    if not monthly:
        monthly = synthetic_monthly(year)

    ordered = {str(m): monthly.get(m, 0) for m in range(1, 13)}
    return jsonify({"year": year, "monthly": ordered})


@app.route("/api/predictions/daily")
def api_predictions_daily():
    """Return daily tourists for a given month (query: ?year=2026&month=5)."""
    from flask import request
    year  = int(request.args.get("year",  datetime.now().year))
    month = int(request.args.get("month", datetime.now().month))

    rows  = load_predictions()
    daily = []

    if rows:
        for row in rows:
            try:
                d = datetime.strptime(row["Date"], "%Y-%m-%d")
            except (KeyError, ValueError):
                continue
            if d.year == year and d.month == month:
                daily.append({
                    "date":           row["Date"],
                    "tourists": float(row.get("Tourists", 0)),
                    "is_weekend":     int(row.get("is_weekend", 0)),
                    "is_holiday":     int(row.get("is_holiday", 0)),
                    "weather_factor": float(row.get("weather_factor", 1.0)),
                })

    if not daily:
        # Synthetic fallback
        import calendar
        monthly = synthetic_monthly(year)
        total   = monthly.get(month, 300000)
        n_days  = calendar.monthrange(year, month)[1]
        for day in range(1, n_days + 1):
            d         = date(year, month, day)
            is_wknd   = d.weekday() >= 5
            tourists  = round((total / n_days) * (1.6 if is_wknd else 0.85)
                              * (1 + random.uniform(-0.08, 0.08)))
            daily.append({
                "date":           d.isoformat(),
                "tourists":       tourists,
                "is_weekend":     int(is_wknd),
                "is_holiday":     0,
                "weather_factor": round(random.uniform(0.9, 1.2), 2),
            })

    return jsonify({"year": year, "month": month, "daily": daily})


@app.route("/api/status")
def api_status():
    year  = datetime.now().year
    rows  = load_predictions()
    has_ml = bool(rows)
    return jsonify({
        "status":       "ok",
        "ml_data":      has_ml,
        "current_year": year,
        "server_time":  datetime.now().isoformat(),
    })


# Serve static files explicitly (fallback for any sub-path)
@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


# ─── MAIN ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
