# BTC Options Strategy Capital Deployment Risk Monitor

A self-hosted web app + Telegram bot that calculates a composite risk score (0-70) to determine whether it's safe to deploy capital into a BTC options selling strategy.

## Features

- **Risk Score Engine**: 7-component scoring (Fear & Greed, ETF Flows, 200-day MA, Support Distance, Open Interest, Macro Events, Day of Week)
- **Telegram Bot**: Real-time commands for status, price, calendar, history, and manual overrides
- **Flash Crash Detector**: 5-minute checks for rapid BTC drops with severity-based alerts
- **Live Dashboard**: React-based UI with risk gauge, score breakdown, price charts, and news feed
- **Scheduled Alerts**: Automatic Telegram updates every 6 hours (IST 6:00, 12:00, 18:00, 00:00)
- **News Scanner**: RSS feed monitoring with risk keyword detection
- **Historical Data**: 90 days of stored scores, prices, and events in SQLite

## Signal Levels

| Score   | Signal | Meaning                     |
|---------|--------|-----------------------------|
| 0-15    | GREEN  | Safe to deploy capital      |
| 16-30   | YELLOW | Deploy with caution (half)  |
| 31-45   | ORANGE | Do not deploy new capital   |
| 46-70   | RED    | Pause strategy              |

## Quick Start

### Prerequisites

- Node.js 18+
- A Telegram bot token (get from [@BotFather](https://t.me/BotFather))
- Your Telegram chat ID (get from [@userinfobot](https://t.me/userinfobot))

### Setup

```bash
cd btc-risk-monitor

# Run the setup script (installs deps, builds frontend)
bash scripts/setup.sh

# Edit your environment variables
nano .env
```

### Configure .env

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
COINGLASS_API_KEY=optional
PORT=3000
```

### Run

```bash
# Start the server
npm start

# Or with auto-reload for development
npm run dev
```

Open http://localhost:3000 to view the dashboard.

### Docker

```bash
cd deploy
docker-compose up -d
```

## Telegram Bot Commands

| Command                | Description                          |
|------------------------|--------------------------------------|
| `/status`              | Current risk score + breakdown       |
| `/price`               | BTC price + 200-day MA distance      |
| `/calendar`            | Macro events (next 7 days)           |
| `/etf <amount>`        | Set today's ETF flow (e.g., `/etf -500`) |
| `/history`             | Last 7 days of risk scores           |
| `/support <prices>`    | Update support levels                |
| `/alert`               | Toggle alerts on/off                 |
| `/force`               | Force immediate recalculation        |
| `/override <signal>`   | Manual override (RED/ORANGE/YELLOW/GREEN/none) |
| `/help`                | Show all commands                    |

## API Endpoints

| Method | Endpoint           | Description                    |
|--------|-------------------|--------------------------------|
| GET    | `/api/status`      | Current risk score             |
| POST   | `/api/calculate`   | Force fresh calculation        |
| GET    | `/api/price`       | BTC price data                 |
| GET    | `/api/scores/history?days=30` | Historical scores    |
| GET    | `/api/prices/history?days=30` | Historical prices    |
| GET    | `/api/calendar?days=14` | Upcoming macro events     |
| GET    | `/api/news?limit=10` | Flagged news items           |
| GET    | `/api/support`     | Current support levels         |
| PUT    | `/api/support`     | Update support levels          |
| POST   | `/api/etf`         | Set ETF flow                   |
| POST   | `/api/override`    | Set manual override            |

## Scheduled Jobs

- **Risk Score**: Every 6 hours (IST 6:00, 12:00, 18:00, 00:00)
- **Flash Crash Check**: Every 5 minutes
- **News Scan**: Every 2 hours
- **DB Cleanup**: Daily at 9:00 AM IST (removes data older than 90 days)

## Flash Crash Alerts

| Drop      | Timeframe | Severity   |
|-----------|-----------|------------|
| >3%       | 1 hour    | WARNING    |
| >5%       | 4 hours   | CRITICAL   |
| >8%       | 24 hours  | EMERGENCY  |

## Updating Macro Calendar

Edit `src/config/macro-calendar.json` to add upcoming events:

```json
{
  "events": [
    {"date": "2026-03-18", "type": "FOMC", "name": "FOMC Meeting"}
  ]
}
```

Event types: `FOMC`, `CPI`, `NFP`, `EARNINGS`, `OPTIONS_EXPIRY`, `TARIFF`, `GEOPOLITICAL`

## Updating Support Levels

Via Telegram: `/support 60000,58000,50000,40000`

Or edit `src/config/support-levels.json` directly.

## Architecture

```
btc-risk-monitor/
├── src/
│   ├── server.js          — Express server + API routes
│   ├── config/            — Macro calendar, support levels
│   ├── data/              — API integrations (CoinGecko, F&G, ETF, OI, News, Macro)
│   ├── scoring/           — Risk scoring engine
│   ├── alerts/            — Telegram bot, flash crash detector
│   ├── db/                — SQLite storage
│   ├── scheduler/         — Cron jobs
│   └── utils/             — Logger, IST time helpers
├── frontend/              — React dashboard (Vite + Tailwind + Recharts)
├── data/                  — SQLite database file (auto-created)
├── logs/                  — Application logs
├── scripts/setup.sh       — Setup script
└── deploy/                — Docker files
```

## Notes

- All times are in IST (Indian Standard Time, UTC+5:30)
- If any API fails, the last cached value is used and noted in the score
- The dashboard auto-refreshes every 5 minutes
- Historical data is retained for 90 days
- Mobile-responsive design
