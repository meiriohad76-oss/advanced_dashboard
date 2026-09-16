"""Build company name database from SEC EDGAR and Yahoo Finance API."""
from __future__ import annotations

import json
import os
import re
import urllib.request

SEC_URL = "https://www.sec.gov/files/company_tickers.json"

POPULAR_ETFS = {
    "CGDV": "Capital Group Dividend Value ETF",
    "IGM": "iShares Expanded Tech-Sector ETF",
    "SPY": "SPDR S&P 500 ETF Trust",
    "QQQ": "Invesco QQQ Trust",
    "IWM": "iShares Russell 2000 ETF",
    "VOO": "Vanguard S&P 500 ETF",
    "VTI": "Vanguard Total Stock Market ETF",
    "IVV": "iShares Core S&P 500 ETF",
    "DIA": "SPDR Dow Jones Industrial Average ETF",
    "XLF": "Financial Select Sector SPDR Fund",
    "XLK": "Technology Select Sector SPDR Fund",
    "XLE": "Energy Select Sector SPDR Fund",
    "XLV": "Health Care Select Sector SPDR Fund",
    "XLY": "Consumer Discretionary Select Sector SPDR Fund",
    "XLP": "Consumer Staples Select Sector SPDR Fund",
    "XLI": "Industrial Select Sector SPDR Fund",
    "XLC": "Communication Services Select Sector SPDR Fund",
    "XLB": "Materials Select Sector SPDR Fund",
    "XLU": "Utilities Select Sector SPDR Fund",
    "XLRE": "Real Estate Select Sector SPDR Fund",
    "SMH": "VanEck Semiconductor ETF",
    "SOXX": "iShares Semiconductor ETF",
    "ARKK": "ARK Innovation ETF",
}


def clean_title(title: str) -> str:
    if not title:
        return ""
    if title.isupper():
        words = title.split()
        cleaned_words = []
        for w in words:
            w_lower = w.lower().strip(",")
            if w_lower in ("inc", "inc."):
                cleaned_words.append("Inc.")
            elif w_lower in ("corp", "corp."):
                cleaned_words.append("Corp.")
            elif w_lower in ("ltd", "ltd."):
                cleaned_words.append("Ltd.")
            elif w_lower in ("co", "co."):
                cleaned_words.append("Co.")
            elif w_lower in ("plc", "plc."):
                cleaned_words.append("plc")
            elif w_lower in ("llc", "llc."):
                cleaned_words.append("LLC")
            elif w_lower in ("etf", "etfs"):
                cleaned_words.append("ETF")
            elif w_lower in ("usa", "us"):
                cleaned_words.append(w.upper())
            else:
                cleaned_words.append(w.capitalize())
        return " ".join(cleaned_words)
    return title


def fetch_sec_tickers() -> dict[str, str]:
    print("Fetching SEC tickers...")
    req = urllib.request.Request(
        SEC_URL,
        headers={"User-Agent": "AtlasPortfolio/1.0 (contact@atlasportfolio.com)"}
    )
    with urllib.request.urlopen(req) as res:
        raw = json.loads(res.read())
    mapping = {}
    for item in raw.values():
        sym = item["ticker"].upper().strip()
        mapping[sym] = clean_title(item["title"].strip())
    mapping.update(POPULAR_ETFS)
    return mapping


def fetch_online_name(symbol: str) -> str | None:
    """Fetch company name dynamically from Yahoo Finance API for any ticker."""
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(symbol)}"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read())
            quotes = data.get("quotes", [])
            if quotes:
                match = quotes[0]
                return match.get("longname") or match.get("shortname")
    except Exception:
        pass
    return None


def main():
    sec_map = fetch_sec_tickers()
    print(f"Total mapped tickers: {len(sec_map)}")

    py_content = f'''"""Company name lookup directory for ticker symbols."""
from __future__ import annotations
import json
import urllib.request
import urllib.parse

COMPANY_NAMES: dict[str, str] = {json.dumps(sec_map, indent=4)}

def resolve_company_name(symbol: str, fallback_name: str | None = None) -> str:
    """Resolve full company name for a ticker symbol using local database + online fallback."""
    sym = (symbol or "").strip().upper()
    if not sym:
        return ""
    if fallback_name and fallback_name.strip() and fallback_name.strip().upper() != sym:
        return fallback_name.strip()
    if sym in COMPANY_NAMES:
        return COMPANY_NAMES[sym]

    # Dynamic Internet Lookup Fallback
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={{urllib.parse.quote(sym)}}"
        req = urllib.request.Request(url, headers={{"User-Agent": "Mozilla/5.0"}})
        with urllib.request.urlopen(req, timeout=2) as res:
            data = json.loads(res.read())
            quotes = data.get("quotes", [])
            if quotes:
                name = quotes[0].get("longname") or quotes[0].get("shortname")
                if name:
                    COMPANY_NAMES[sym] = name
                    return name
    except Exception:
        pass

    return sym
'''
    with open("backend/app/company_names.py", "w", encoding="utf-8") as f:
        f.write(py_content)
    print("Wrote backend/app/company_names.py")

    ts_content = f'''export const COMPANY_NAMES: Record<string, string> = {json.dumps(sec_map, indent=2)};

export function resolveCompanyName(symbol: string, fallbackName?: string | null): string {{
  const sym = (symbol || '').trim().toUpperCase()
  if (!sym) return ''
  if (fallbackName && fallbackName.trim() && fallbackName.trim().toUpperCase() !== sym) {{
    return fallbackName.trim()
  }}
  return COMPANY_NAMES[sym] || sym
}}
'''
    with open("src/data/companyNames.ts", "w", encoding="utf-8") as f:
        f.write(ts_content)
    print("Wrote src/data/companyNames.ts")


if __name__ == "__main__":
    main()
