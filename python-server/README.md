# python-server

Python service for:
- Fetching Bybit market data
- Running strategy signals
- Publishing trade signals to Kafka
- Providing REST backtest endpoints for Java to call

## Quick start
```bash
cd python-server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` from `.env.example` and set:
- `BYBIT_TESTNET`
- `BYBIT_API_KEY`
- `BYBIT_API_SECRET`
- `BYBIT_WS_ENABLED`
- `KAFKA_ENABLED`, `KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_SIGNAL_TOPIC`

Run:
```bash
uvicorn app.main:app --reload --port 8001
```

## REST API
- `GET /health`
- `POST /backtest`

## Signal flow
- Python polls Bybit klines on candle close and emits Kafka signals
- Java consumes Kafka signals and executes orders + stores results
