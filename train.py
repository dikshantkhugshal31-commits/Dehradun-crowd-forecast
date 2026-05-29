"""
train.py — ML pipeline for Dehradun Tourist Crowd Forecast
Run this script ONCE to generate prediction CSVs used by the Flask app.

Usage:
  python train.py

Outputs:
  data/daily_tourists_historical.csv   — historical daily tourist data
  data/daily_tourists_<year>.csv       — next-year daily predictions

Requirements: pip install -r requirements-ml.txt
"""

import pandas as pd
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import numpy as np
import calendar
import holidays
import json
import os
import seaborn as sns
import matplotlib.pyplot as plt
import requests
from pytrends.request import TrendReq
from datetime import date
from prophet import Prophet

# ── OUTPUT DIRECTORY ──────────────────────────────────────────────────────────
os.makedirs("data", exist_ok=True)

# ── STEP 1: LOAD RAW DATA ────────────────────────────────────────
data = pd.read_excel("draft1-dataset1.xlsx", header=None, names=['Date', 'Tourists'])
data['Date']  = pd.to_datetime(data['Date'])
data['Year']  = data['Date'].dt.year
data['Month'] = data['Date'].dt.month
data          = data.sort_values('Date').reset_index(drop=True)

# ── STEP 2: HOLIDAYS ─────────────────────────────────────────────
festival_dates = {
    date(2010, 2, 28), date(2011, 3, 20), date(2012, 3, 8),
    date(2013, 3, 27), date(2014, 3, 17), date(2015, 3, 6),
    date(2016, 3, 24), date(2017, 3, 13), date(2018, 3, 2),
    date(2019, 3, 21), date(2020, 3, 10), date(2021, 3, 29),
    date(2022, 3, 18), date(2023, 3, 8),  date(2024, 3, 25),
    date(2025, 3, 14), date(2026, 3, 3),
    *[date(y, 1, 1)  for y in range(2010, 2027)],
    *[date(y, 1, 14) for y in range(2010, 2027)],
    date(2010, 8, 24), date(2011, 8, 13), date(2012, 8, 2),
    date(2013, 8, 21), date(2014, 8, 10), date(2015, 8, 29),
    date(2016, 8, 18), date(2017, 8, 7),  date(2018, 8, 26),
    date(2019, 8, 15), date(2020, 8, 3),  date(2021, 8, 22),
    date(2022, 8, 11), date(2023, 8, 30), date(2024, 8, 19),
    date(2025, 8, 9),  date(2026, 8, 29),
    date(2010, 3, 16), date(2011, 4, 4),  date(2012, 3, 23),
    date(2013, 4, 11), date(2014, 3, 31), date(2015, 3, 21),
    date(2016, 4, 8),  date(2017, 3, 28), date(2018, 3, 18),
    date(2019, 4, 6),  date(2020, 3, 25), date(2021, 4, 13),
    date(2022, 4, 2),  date(2023, 3, 22), date(2024, 4, 9),
    date(2025, 3, 30), date(2026, 4, 18),
    date(2010, 10, 8),  date(2011, 9, 28), date(2012, 10, 16),
    date(2013, 10, 5),  date(2014, 9, 25), date(2015, 10, 13),
    date(2016, 10, 2),  date(2017, 9, 21), date(2018, 10, 10),
    date(2019, 9, 29),  date(2020, 10, 17),date(2021, 10, 7),
    date(2022, 9, 26),  date(2023, 10, 15),date(2024, 10, 3),
    date(2025, 9, 22),  date(2026, 10, 12),
}

official_holidays = holidays.India(years=range(2010, 2027))
for d in festival_dates:
    official_holidays[d] = "Festival"

# ── STEP 3: CALENDAR FUNCTION ────────────────────────────────────
def calender(year, month):
    dates = pd.date_range(
        start=f"{year}-{month}-01",
        end  =f"{year}-{month}-{calendar.monthrange(year, month)[1]}"
    )
    weekdays = weekends = holiday_count = long_weekend_count = 0
    for d in dates:
        if d.weekday() < 5: weekdays += 1
        else: weekends += 1
        if d.date() in official_holidays or d in official_holidays:
            holiday_count += 1
            if d.weekday() in [0, 3, 4]: long_weekend_count += 1
    return weekdays, weekends, holiday_count, long_weekend_count

# ── STEP 4: CALENDAR FEATURES ────────────────────────────────────
file_name = "calendar_features.json"
if os.path.exists(file_name):
    print("Loading calendar features...")
    with open(file_name) as f:
        calendar_features = pd.DataFrame(json.load(f))
else:
    print("Generating calendar features...")
    cal_data = []
    for year in range(data['Year'].min(), data['Year'].max() + 1):
        for month in range(1, 13):
            w, we, h, lw = calender(year, month)
            cal_data.append({"Year": year, "Month": month, "Weekdays": w, "Weekends": we, "Holidays": h, "long_weekend": lw})
    with open(file_name, "w") as f:
        json.dump(cal_data, f)
    calendar_features = pd.DataFrame(cal_data)

data = data.merge(calendar_features, on=["Year", "Month"], how="left")
data['total_days']    = data.apply(lambda x: calendar.monthrange(int(x['Year']), int(x['Month']))[1], axis=1)
data['leisure_ratio'] = (data['Weekends'] + data['Holidays']) / data['total_days']
data = data.sort_values('Date').reset_index(drop=True)

# ── STEP 5: WEATHER ──────────────────────────────────────────────
weather_file = "weather_combined.json"

def fetch_weather(lat, lon):
    url = (f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
           f"&start_date=2010-01-01&end_date=2025-12-31"
           f"&daily=temperature_2m_mean,precipitation_sum,snowfall_sum,relative_humidity_2m_mean")
    r = requests.get(url)
    if r.status_code != 200: return None
    raw = r.json()
    if "daily" not in raw: return None
    df = pd.DataFrame({'Date': raw["daily"]["time"], 'Temp': raw["daily"]["temperature_2m_mean"],
                       'Rain': raw["daily"]["precipitation_sum"], 'Snow': raw["daily"]["snowfall_sum"],
                       'Humidity': raw["daily"]["relative_humidity_2m_mean"]})
    df["Date"] = pd.to_datetime(df["Date"])
    df["Year"] = df["Date"].dt.year
    df["Month"] = df["Date"].dt.month
    return df

if os.path.exists(weather_file):
    print("Loading weather data...")
    weather_daily = pd.read_json(weather_file)
else:
    print("Fetching weather data...")
    wd, wm, wr, wc = fetch_weather(30.3165,78.0322), fetch_weather(30.4598,78.0664), fetch_weather(30.0869,78.2676), fetch_weather(30.6833,77.8667)
    if any(x is None for x in [wd, wm, wr, wc]):
        raise Exception("Weather API failed")
    weather_daily = pd.DataFrame({
        "Date": wd["Date"], "Year": wd["Year"], "Month": wd["Month"],
        "Temp":     wm["Temp"]*0.50 + wr["Temp"]*0.25 + wc["Temp"]*0.15 + wd["Temp"]*0.10,
        "Rain":     wm["Rain"]*0.40 + wr["Rain"]*0.30 + wc["Rain"]*0.15 + wd["Rain"]*0.15,
        "Snow":     wm["Snow"]*0.50 + wc["Snow"]*0.35 + wd["Snow"]*0.10 + wr["Snow"]*0.05,
        "Humidity": wm["Humidity"]*0.50 + wr["Humidity"]*0.25 + wc["Humidity"]*0.15 + wd["Humidity"]*0.10,
    })
    weather_daily["comfortable"] = (
        ((weather_daily["Temp"]>=12)&(weather_daily["Temp"]<=25)&(weather_daily["Rain"]<8)) |
        ((weather_daily["Temp"]>=2) &(weather_daily["Temp"]<=12)&(weather_daily["Snow"]>0))
    ).astype(int)
    weather_daily.to_json(weather_file)

weather_monthly = weather_daily.groupby(["Year","Month"]).agg({"Temp":"mean","Rain":"sum","Snow":"sum","Humidity":"mean","comfortable":"sum"}).reset_index()
weather_monthly.rename(columns={"comfortable":"ComfortableDays"}, inplace=True)
data = data.merge(weather_monthly, on=["Year","Month"], how="left")

# ── STEP 6: GOOGLE TRENDS ────────────────────────────────────────
pytrends = TrendReq(hl='en-US', tz=330)
keywords = ["Dehradun hotels", "places to visit in Dehradun"]
pytrends.build_payload(keywords, timeframe='2010-01-01 2025-12-31', geo='IN')
trend_data = pytrends.interest_over_time().reset_index()
trend_data["trends"] = trend_data[keywords].mean(axis=1)/100
trend_data["Year"]   = trend_data["date"].dt.year
trend_data["Month"]  = trend_data["date"].dt.month
trend_monthly = trend_data.groupby(["Year","Month"])["trends"].mean().reset_index()
data = data.merge(trend_monthly, on=["Year","Month"], how='left')
data["trends"] = data["trends"].replace(0, np.nan).interpolate(method='linear')
data["trends_norm"] = (data["trends"]-data["trends"].min())/(data["trends"].max()-data["trends"].min())

# ── STEP 7: TARGET VARIABLE ──────────────────────────────────────
data['tourist_yearly'] = data.groupby("Year")['Tourists'].transform('sum')
data['excel_pct']      = data['Tourists']/data['tourist_yearly']
data['snow_norm']    = data['Snow']/(data['Snow'].max()+1e-6)
data['rain_norm']    = data['Rain']/(data['Rain'].max()+1e-6)
data['comfort_norm'] = (data['ComfortableDays']-data['ComfortableDays'].min())/(data['ComfortableDays'].max()-data['ComfortableDays'].min()+1e-6)
data['peak_season']  = data['Month'].isin([3,4,5,6]).astype(int)
data['winter_peak']  = data['Month'].isin([12,1]).astype(int)
data['season_base']  = 1+0.7*data['peak_season']+0.5*data['winter_peak']
data['attractiveness'] = (0.25*data['season_base']+0.40*data['trends_norm']+0.15*data['comfort_norm']+0.10*data['snow_norm']+0.10*data['leisure_ratio']-0.05*data['rain_norm'])
data['attr_total']   = data.groupby('Year')['attractiveness'].transform('sum')
data['attr_percent'] = data['attractiveness']/data['attr_total']
data['blended_pct']  = 0.50*data['excel_pct']+0.50*data['attr_percent']
data['Tourists']     = data['blended_pct']*data['tourist_yearly']

# ── STEP 8: FEATURE ENGINEERING ──────────────────────────────────
data['trend']          = np.arange(len(data))
data['covid_crash']    = data['Year'].isin([2020,2021]).astype(int)
data['month_sin']      = np.sin(2*np.pi*data['Month']/12)
data['month_cos']      = np.cos(2*np.pi*data['Month']/12)
data['summer_vacation']= data['Month'].isin([5,6]).astype(int)
data['lag-1']          = data['Tourists'].shift(1)
data['lag-12']         = data['Tourists'].shift(12)
data['rolling_3']      = data['Tourists'].shift(1).rolling(3).mean()

# ── STEP 9: TRAIN XGBOOST ────────────────────────────────────────
data = data.dropna().reset_index(drop=True)

feature_cols = ['month_sin','month_cos','lag-1','lag-12','rolling_3','trend','peak_season','covid_crash','Humidity','summer_vacation','long_weekend']
train = data[data['Year']<2024].copy()
test  = data[data['Year']>=2024].copy()
X_train, Y_train = train[feature_cols], train['Tourists']
X_test,  Y_test  = test[feature_cols],  test['Tourists']

train['weight'] = np.exp(1.0*(train['Year']-train['Year'].min()))
train['weight'] = train['weight']/train['weight'].mean()

model = XGBRegressor(objective='reg:tweedie', tweedie_variance_power=1.3, n_estimators=500,
                     learning_rate=0.03, max_depth=3, subsample=0.8, colsample_bytree=0.8,
                     reg_lambda=50, random_state=42)
model.fit(X_train, Y_train, sample_weight=train['weight'])

predictions = model.predict(X_test)
train_pred  = model.predict(X_train)
print(f"\nXGBoost Train MAE : {mean_absolute_error(Y_train, train_pred):.4f}")
print(f"XGBoost Test  MAE : {mean_absolute_error(Y_test,  predictions):.4f}")
print(f"XGBoost RMSE      : {np.sqrt(mean_squared_error(Y_test, predictions)):.4f}")

# ── STEP 10: PROPHET ─────────────────────────────────────────────
print("\nFitting Prophet on monthly data...")
prophet_df = data[['Date','Tourists']].copy()
prophet_df.columns = ['ds','y']
prophet_df = prophet_df.sort_values('ds')

prophet_holidays = pd.DataFrame({'holiday': 'india_festival', 'ds': pd.to_datetime(list(festival_dates)), 'lower_window': -1, 'upper_window': 1})
prophet_model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False,
                         holidays=prophet_holidays, seasonality_mode='multiplicative', changepoint_prior_scale=0.3)
prophet_model.fit(prophet_df)
future   = prophet_model.make_future_dataframe(periods=12, freq='MS')
forecast = prophet_model.predict(future)
last_date       = prophet_df['ds'].max()
target_year     = last_date.year+1
prophet_monthly = forecast[forecast['ds'].dt.year==target_year][['ds','yhat']].copy()
prophet_monthly['yhat'] = prophet_monthly['yhat'].clip(lower=0)
prophet_annual  = prophet_monthly['yhat'].sum()
print(f"Prophet {target_year} annual estimate: {prophet_annual:.2f}")

# ── STEP 11: XGBOOST MONTHLY PREDICTION ──────────────────────────
base_year   = target_year-1
years_ahead = target_year-data['Year'].max()
predicted   = {}

for month in range(1, 13):
    if month==1: lag1 = data[(data['Year']==base_year)&(data['Month']==12)]['Tourists'].values[0]
    else: lag1 = predicted[month-1]
    lag12 = data[(data['Year']==base_year)&(data['Month']==month)]['Tourists'].values[0]
    if month==1: r3 = data[data['Year']==base_year].tail(3)['Tourists'].mean()
    elif month==2: r3 = np.mean([predicted[1], data[(data['Year']==base_year)&(data['Month']==12)]['Tourists'].values[0], data[(data['Year']==base_year)&(data['Month']==11)]['Tourists'].values[0]])
    elif month==3: r3 = np.mean([predicted[2], predicted[1], data[(data['Year']==base_year)&(data['Month']==12)]['Tourists'].values[0]])
    else: r3 = np.mean([predicted[month-1], predicted[month-2], predicted[month-3]])
    _, _, _, lw = calender(target_year, month)
    avail_years = sorted(data['Year'].unique())[-3:]
    humidity = weather_monthly[(weather_monthly['Year'].isin(avail_years))&(weather_monthly['Month']==month)]['Humidity'].mean()
    row = {'month_sin': np.sin(2*np.pi*month/12), 'month_cos': np.cos(2*np.pi*month/12),
           'lag-1': lag1, 'lag-12': lag12, 'rolling_3': r3,
           'trend': len(data)+(years_ahead-1)*12+month-1,
           'peak_season': int(month in [3,4,5,6]), 'covid_crash': 0,
           'Humidity': humidity, 'summer_vacation': int(month in [5,6]), 'long_weekend': lw}
    predicted[month] = model.predict(pd.DataFrame([row])[feature_cols])[0]

# ── STEP 12: SCALE XGB TO PROPHET ────────────────────────────────
xgb_total    = sum(predicted.values())
scale_factor = prophet_annual/xgb_total
final_monthly= {m: v*scale_factor for m,v in predicted.items()}
print(f"Scale factor: {scale_factor:.4f}")

# ── STEP 13: DAILY DISTRIBUTION ──────────────────────────────────
def generate_daily_tourists(monthly_df, weather_df):
    all_daily = []
    for _, row in monthly_df.iterrows():
        year, month, monthly_total = int(row['Year']), int(row['Month']), row['Tourists']
        month_weather = weather_df[(weather_df['Date'].dt.year==year)&(weather_df['Date'].dt.month==month)].set_index('Date')
        dates = pd.date_range(start=f"{year}-{month}-01", end=f"{year}-{month}-{calendar.monthrange(year,month)[1]}")
        daily_rows = []
        for d in dates:
            weight = 1.0
            factors = {'Date': d, 'Year': year, 'Month': month, 'is_weekend': 0, 'is_holiday': 0, 'is_longweekend': 0, 'weather_factor': 1.0}
            if d.weekday()>=5: weight*=1.8; factors['is_weekend']=1
            if d.date() in official_holidays or d in official_holidays:
                weight*=1.5; factors['is_holiday']=1
                if d.weekday() in [0,3,4]: weight*=1.3; factors['is_longweekend']=1
            weather_factor = 1.0
            if d in month_weather.index:
                temp,rain,snow = month_weather.loc[d,'Temp'], month_weather.loc[d,'Rain'], month_weather.loc[d,'Snow']
                if 12<=temp<=25: weather_factor*=1.2
                elif 0<=temp<12: weather_factor*=0.9
                elif temp<0: weather_factor*=0.8
                elif temp>35: weather_factor*=0.7
                if rain>20: weather_factor*=0.6
                elif rain>8: weather_factor*=0.8
                if snow>0: weather_factor*=1.3
            weight*=weather_factor; factors['weather_factor']=round(weather_factor,3); factors['raw_weight']=round(weight,3)
            daily_rows.append(factors)
        day_df = pd.DataFrame(daily_rows)
        day_df['weight']   = day_df['raw_weight']/day_df['raw_weight'].sum()
        day_df['Tourists'] = day_df['weight']*monthly_total
        all_daily.append(day_df)
    return pd.concat(all_daily, ignore_index=True).sort_values('Date').reset_index(drop=True)

print("\nGenerating historical daily data (2010-2025)...")
daily_historical = generate_daily_tourists(data[['Year','Month','Tourists']], weather_daily)
daily_historical.to_csv('data/daily_tourists_historical.csv', index=False)
print(f"Saved {len(daily_historical)} rows -> data/daily_tourists_historical.csv")

avail_years  = sorted(weather_daily['Date'].dt.year.unique())[-3:]
weather_base = weather_daily[weather_daily['Date'].dt.year.isin(avail_years)].copy()
weather_base['DayOfMonth'] = weather_base['Date'].dt.day
avg_weather  = weather_base.groupby(['Month','DayOfMonth'])[['Temp','Rain','Snow']].mean().reset_index()
future_dates   = pd.date_range(start=f"{target_year}-01-01", end=f"{target_year}-12-31")
future_weather = pd.DataFrame({'Date': future_dates, 'Month': future_dates.month, 'DayOfMonth': future_dates.day}).merge(avg_weather, on=['Month','DayOfMonth'], how='left')
future_monthly_df = pd.DataFrame([{'Year': target_year, 'Month': m, 'Tourists': v} for m,v in final_monthly.items()])

print(f"\nGenerating daily predictions for {target_year}...")
daily_future = generate_daily_tourists(future_monthly_df, future_weather)
daily_future.to_csv(f'data/daily_tourists_{target_year}.csv', index=False)
print(f"Saved {len(daily_future)} rows -> data/daily_tourists_{target_year}.csv")
print(f"\nDone! Annual total: {daily_future['Tourists'].sum():.0f}")
