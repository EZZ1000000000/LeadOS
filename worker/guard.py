"""
LeadOS Worker — guard.py
التنظيم الذكي المانع للحظر: ميزانيات يومية + قواطع دائرة + فواصل بشرية + حالة محفوظة.

الفكرة: أي عملية شبكة لازم تمر من هنا. لو المنصة اعتدت ميزانيتها أو انطرد منها
الووركر (bot detection)، بنقفلها لباقي اليوم ونكمل على المنصات التانية بس.
"""
from __future__ import annotations

import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

CONFIG_PATH = Path(os.environ.get("WORKER_CONFIG", Path(__file__).parent / "config.yaml"))
STATE_DIR = Path(__file__).parent / "state"


def load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    # تجاوزات بيئة (Environment) — أولوية دايمًا
    lev = os.environ
    if lev.get("LEADOS_BASE_URL"):
        cfg.setdefault("leados", {})["base_url"] = lev["LEADOS_BASE_URL"]
    if lev.get("LEADOS_API_KEY"):
        cfg.setdefault("leados", {})["api_key"] = lev["LEADOS_API_KEY"]
    if lev.get("WORKER_PROXY"):
        cfg["proxy"] = lev["WORKER_PROXY"]
    if lev.get("WORKER_MODE"):
        cfg.setdefault("worker", {})["mode"] = lev["WORKER_MODE"]
    return cfg


class Guard:
    """حارس المنصات: ميزانية/يوم + circuit breaker + عداد الدورات الفارغة."""

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.state_file = Path(cfg.get("safety", {}).get("state_file", "state/guard.json"))
        if not self.state_file.is_absolute():
            self.state_file = Path(__file__).parent / self.state_file
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state: Dict = self._load()
        self._last_action = 0.0

    # ---------- الحالة ----------
    def _load(self) -> Dict:
        try:
            return json.loads(self.state_file.read_text(encoding="utf-8"))
        except Exception:
            return {"date": self._today(), "counts": {}, "blocked": {}, "empty_cycles": {}}

    def _save(self) -> None:
        self.state_file.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    @staticmethod
    def _today() -> str:
        reset_hour = 21  # 21:00 UTC ≈ منتصف ليل مصر
        now = datetime.now(timezone.utc)
        d = now
        if now.hour < reset_hour:  # اليوم "الجديد" يبدأ من ساعة التصفير
            d = now.replace(day=now.day)  # نفس التاريخ، الفرق في عدّاد الساعة يظبطه المنطق أدناه
        key = f"{d:%Y-%m-%d}-{(now.hour >= reset_hour)}"
        return key

    # ---------- الميزانيات ----------
    def take(self, platform: str, n: int = 1) -> int:
        """احجز n من ميزانية المنصة، وارجع العدد المسموح فعليًا."""
        self._rollover()
        budget = int(self.cfg.get("budgets", {}).get("daily", {}).get(platform, 0))
        counts: Dict = self.state.setdefault("counts", {})
        used = int(counts.get(platform, 0))
        blocked = self.state.get("blocked", {}).get(platform)
        if blocked == self._today():
            return 0  # قاطع الدائرة قافل النهاردة
        if budget <= 0:
            return 0
        allowed = max(0, min(n, budget - used))
        if allowed:
            counts[platform] = used + allowed
            self._save()
        return allowed

    def remaining(self, platform: str) -> int:
        """كم استعلام باقي من ميزانية المنصة النهاردة (0 لو مقفولة)."""
        self._rollover()
        if self.blocked(platform):
            return 0
        budget = int(self.cfg.get("budgets", {}).get("daily", {}).get(platform, 0))
        used = int(self.state.get("counts", {}).get(platform, 0))
        return max(0, budget - used)

    def blocked(self, platform: str) -> bool:
        self._rollover()
        return self.state.get("blocked", {}).get(platform) == self._today()

    def trip(self, platform: str, reason: str) -> None:
        """قفل المنصة لباقي اليوم (كابتشا/حظر/ميزانية خلصت)."""
        self.state.setdefault("blocked", {})[platform] = self._today()
        self.state.setdefault("block_reasons", {})[platform] = reason
        self._save()
        print(f"[guard] 🚫 {platform} مقفولة النهاردة — {reason}")

    def note_empty_cycle(self, platform: str) -> bool:
        """سجّل دورة فارغة؛ لو عدّت الحد ارجع True عشان ناخد راحة."""
        safety = self.cfg.get("safety", {})
        limit = int(safety.get("min_results_to_stop", 3))
        cycles: Dict = self.state.setdefault("empty_cycles", {})
        # نزبط المفتاح على التاريخ عشان ما يتراكمش للأبد
        cycles[platform] = int(cycles.get(platform, 0)) + 1
        self._save()
        return cycles[platform] >= limit

    def note_results(self, platform: str, n: int) -> None:
        if n > 0:
            self.state.setdefault("empty_cycles", {})[platform] = 0
            self._save()

    def _rollover(self) -> None:
        today = self._today()
        if self.state.get("date") != today:
            self.state = {"date": today, "counts": {}, "blocked": {}, "empty_cycles": {}}
            self._save()

    # ---------- الفواصل البشرية ----------
    def _pause(self, seconds: float) -> None:
        jitter = random.uniform(0, seconds * 0.35) if self.cfg.get("delays", {}).get("jitter", True) else 0
        time.sleep(seconds + jitter)

    def pause(self, kind: str) -> None:
        rng = self.cfg.get("delays", {}).get(kind, [3, 8])
        a, b = float(rng[0]), float(rng[1])
        t = random.uniform(a, b)
        print(f"[guard] ⏳ {kind}: {t:.1f}s")
        self._pause(t)

    def human(self, seconds: float) -> None:
        """فاصل إجباري منخفض المستوى مع عشوائية."""
        self._pause(seconds)

    # ---------- حالة الحارس ----------
    def status(self) -> str:
        lines = [f"اليوم: {self._today()}"]
        budgets = self.cfg.get("budgets", {}).get("daily", {})
        for p, b in budgets.items():
            used = self.state.get("counts", {}).get(p, 0)
            mark = "🚫" if self.blocked(p) else "✅"
            lines.append(f"  {mark} {p}: {used}/{b}")
        return "\n".join(lines)


def pick_queries(cfg: dict, platform: str, n: int, guard: Guard) -> List[str]:
    """اختيار استعلامات بترتيب دوراني عشوائي (rotation) حسب الميزانية المتاحة."""
    pool: List[str] = list(cfg.get("queries", {}).get(platform, []))
    if not pool or n <= 0:
        return []
    random.shuffle(pool)
    # دوران: لو فيه offset محفوظ نكمل من عند اللي وقفنا عنده — تغطية أوسع كل دورة
    offsets = guard.state.setdefault("query_offsets", {})
    offset = int(offsets.get(platform, 0)) % len(pool)
    picked = [pool[(offset + i) % len(pool)] for i in range(min(n, len(pool)))]
    offsets[platform] = (offset + len(picked)) % len(pool)
    guard._save()
    return picked
