// Shared promise cache for per-symbol market payloads. StockChart's compare
// menu and PortfolioChart's benchmark menu used to keep separate per-component
// Map caches for the same /api/stock payloads — module scope shares them and
// survives component remounts. Entries live ~5 min (matches the backend's
// intraday TTL); failed fetches are evicted so a retry can succeed.
import { api } from './api.js';

const TTL_MS = 5 * 60_000;

function makeCache(fetcher) {
  const map = new Map(); // key → { at, p }
  return (...args) => {
    const key = args.join(':');
    const hit = map.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
    const p = fetcher(...args);
    map.set(key, { at: Date.now(), p });
    p.catch(() => { if (map.get(key)?.p === p) map.delete(key); });
    return p;
  };
}

export const cachedStock = makeCache((sym) => api.stock(sym));
export const cachedIntraday = makeCache((sym, range) => api.intraday(sym, range));
