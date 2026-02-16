import json
import logging
from typing import Any

from app.config import settings


logger = logging.getLogger(__name__)


class EventBus:
    def __init__(self):
        self._kafka_producer = None

        if settings.kafka_enabled:
            try:
                from kafka import KafkaProducer

                self._kafka_producer = KafkaProducer(
                    bootstrap_servers=[s.strip() for s in settings.kafka_bootstrap_servers.split(",") if s.strip()],
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                )
            except Exception:
                logger.exception("Kafka init failed")

    def publish(self, event: dict[str, Any], *, key: str | None = None) -> None:
        if self._kafka_producer:
            try:
                key_bytes = key.encode("utf-8") if key else None
                self._kafka_producer.send(settings.kafka_signal_topic, event, key=key_bytes)
                self._kafka_producer.flush(1.0)
            except Exception:
                logger.exception("Kafka publish failed")


event_bus = EventBus()
