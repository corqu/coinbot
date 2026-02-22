import json
import logging
import time
from dataclasses import dataclass
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StrategyGroupItemConfig:
    item_id: int
    sort_order: int
    strategy_code: str
    strategy_source: str
    params: dict[str, Any]


@dataclass(frozen=True)
class StrategyGroupConfig:
    group_id: int
    user_id: int
    items: list[StrategyGroupItemConfig]


class StrategyGroupStore:
    def __init__(self):
        self._redis = None
        self._groups: dict[int, StrategyGroupConfig] = {}
        self._last_refresh_ts = 0.0

        if not settings.redis_enabled:
            logger.info("StrategyGroupStore disabled by redis_enabled=false")
            return

        try:
            from redis import Redis

            self._redis = Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                password=settings.redis_password or None,
                db=settings.redis_db,
                decode_responses=True,
            )
            self._redis.ping()
        except Exception:
            logger.exception("Redis init failed for StrategyGroupStore")
            self._redis = None

    def refresh_if_needed(self) -> None:
        if not self._redis:
            return
        now = time.time()
        if now - self._last_refresh_ts < settings.strategy_group_refresh_sec:
            return
        self.refresh_now()

    def refresh_now(self) -> None:
        if not self._redis:
            return

        try:
            active_group_ids = self._redis.smembers(settings.trading_redis_active_group_set_key) or set()
            if not active_group_ids:
                self._groups = {}
                self._last_refresh_ts = time.time()
                return

            raw_groups = self._redis.hgetall(settings.trading_redis_group_hash_key) or {}
            parsed: dict[int, StrategyGroupConfig] = {}

            for raw_group_id in active_group_ids:
                raw_payload = raw_groups.get(str(raw_group_id))
                if not raw_payload:
                    continue
                group = self._parse_group_payload(raw_payload)
                if group is not None:
                    parsed[group.group_id] = group

            self._groups = parsed
            self._last_refresh_ts = time.time()
        except Exception:
            logger.exception("Failed to refresh strategy groups from redis")

    def groups(self) -> dict[int, StrategyGroupConfig]:
        return self._groups

    def _parse_group_payload(self, raw_payload: str) -> StrategyGroupConfig | None:
        try:
            payload = json.loads(raw_payload)
        except Exception:
            logger.warning("Invalid strategy group payload JSON")
            return None

        try:
            group_id = int(payload.get("groupId"))
            user_id = int(payload.get("userId"))
            if not payload.get("isActive", False):
                return None
        except Exception:
            logger.warning("Invalid group payload fields")
            return None

        items = payload.get("items") or []
        item_configs: list[StrategyGroupItemConfig] = []
        for item in items:
            parsed_item = self._parse_item_payload(item)
            if parsed_item is not None:
                item_configs.append(parsed_item)

        if not item_configs:
            return None

        item_configs.sort(key=lambda x: (x.sort_order, x.item_id))
        return StrategyGroupConfig(group_id=group_id, user_id=user_id, items=item_configs)

    def _parse_item_payload(self, item: dict[str, Any]) -> StrategyGroupItemConfig | None:
        try:
            item_id = int(item.get("itemId"))
            sort_order = int(item.get("sortOrder", 0))
            strategy_code = str(item.get("strategyCode", "")).strip()
            strategy_source = str(item.get("strategySource", "")).strip()
            params_json = item.get("paramsJson", "")
            params = json.loads(params_json) if params_json else {}
            if not isinstance(params, dict):
                params = {}
            if not strategy_source:
                return None
            return StrategyGroupItemConfig(
                item_id=item_id,
                sort_order=sort_order,
                strategy_code=strategy_code,
                strategy_source=strategy_source,
                params=params,
            )
        except Exception:
            logger.warning("Invalid group item payload")
            return None


strategy_group_store = StrategyGroupStore()
