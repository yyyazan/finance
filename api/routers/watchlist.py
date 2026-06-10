"""Watchlist — non-held tickers on the radar (the stock view's "+ Watch").

GET returns light quotes (price + day move) so the sidebar rail can render
rows without another round-trip. Quotes come from yfinance ``fast_info`` with
a short in-process TTL — watchlist names aren't in the holdings momentum poll.
"""
from __future__ import annotations

import re
import time

import yfinance as yf
from fastapi import APIRouter
from pydantic import BaseModel

from portfolio.data import db as db_mod, prices as prices_mod
from api.serialize import _py

router = APIRouter(prefix="/api", tags=["watchlist"])

_TICKER_RE = re.compile(r"^[A-Z0-9.\-]{1,10}$")

_QUOTE_TTL = 300.0  # 5 min — rail strips, not a trading terminal
_quote_cache: dict[str, tuple[float, dict]] = {}


def _quote(ticker: str) -> dict:
    now = time.time()
    hit = _quote_cache.get(ticker)
    if hit is not None and now - hit[0] < _QUOTE_TTL:
        return hit[1]
    price = prev = None
    try:
        fi = yf.Ticker(prices_mod.yf_symbol(ticker)).fast_info
        price = float(fi.last_price)
        prev = float(fi.previous_close)
    except Exception:
        pass
    q = {
        "price": _py(round(price, 2)) if price is not None else None,
        "dayPct": _py(round((price / prev - 1) * 100, 2)) if (price and prev) else None,
    }
    _quote_cache[ticker] = (now, q)
    return q


def _payload(conn, user_id: int) -> list[dict]:
    out = []
    for t in db_mod.watchlist_tickers(conn, user_id):
        try:
            name = prices_mod.profile(t).get("name") or t
        except Exception:
            name = t
        out.append({"ticker": t, "name": name, **_quote(t)})
    return out


@router.get("/watchlist")
def watchlist(user_id: int = db_mod.DEFAULT_USER_ID):
    return _payload(db_mod.connect(), user_id)


class WatchIn(BaseModel):
    ticker: str


@router.post("/watchlist")
def add(body: WatchIn, user_id: int = db_mod.DEFAULT_USER_ID):
    ticker = (body.ticker or "").strip().upper()
    if not _TICKER_RE.match(ticker):
        return {"ok": False, "error": "Invalid ticker.", "watchlist": None}
    conn = db_mod.connect()
    db_mod.watchlist_add(conn, ticker, user_id)
    return {"ok": True, "error": None, "watchlist": _payload(conn, user_id)}


@router.delete("/watchlist/{ticker}")
def remove(ticker: str, user_id: int = db_mod.DEFAULT_USER_ID):
    conn = db_mod.connect()
    db_mod.watchlist_remove(conn, ticker.strip().upper(), user_id)
    return {"ok": True, "error": None, "watchlist": _payload(conn, user_id)}
