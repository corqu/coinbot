from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "AutoTrading Python Server"
    app_env: str = "dev"

    bybit_testnet: bool = True
    bybit_api_key: str = ""
    bybit_api_secret: str = ""
    bybit_ws_enabled: bool = True

    symbols: str = "BTCUSDT"
    intervals: str = "1,5,15,60"
    market_poll_interval_sec: int = 5

    default_short_window: int = 9
    default_long_window: int = 21
    default_trade_qty: float = 0.001

    kafka_enabled: bool = False
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_signal_topic: str = "trade.signals.v1"


settings = Settings()
