"""Standard sector mapping and resolution for equity tickers and ETFs."""

TICKER_SECTORS: dict[str, str] = {
    # Portfolios & Common Watchlist
    "AEM": "Basic Materials",
    "ANET": "Technology",
    "ASML": "Technology",
    "B": "Industrials",
    "BTI": "Consumer Defensive",
    "CGDV": "Financial Services",
    "ERO": "Basic Materials",
    "IONQ": "Technology",
    "KRMN": "Aerospace & Defense",
    "KTOS": "Aerospace & Defense",
    "LHX": "Aerospace & Defense",
    "LMT": "Aerospace & Defense",
    "NASA": "Technology",
    "NBIX": "Healthcare",
    "NEM": "Basic Materials",
    "NOC": "Aerospace & Defense",
    "ONDS": "Technology",
    "ORCL": "Technology",
    "PAAS": "Basic Materials",
    "PM": "Consumer Defensive",
    "PPA": "Aerospace & Defense",
    "PR": "Energy",
    "SCHY": "Financial Services",
    "TATT": "Aerospace & Defense",
    "USAR": "Basic Materials",

    # Benchmarks & Common Large Caps
    "CRDO": "Semiconductors",
    "NVDA": "Semiconductors",
    "MSFT": "Technology",
    "AAPL": "Technology",
    "GOOGL": "Communication Services",
    "GOOG": "Communication Services",
    "AMZN": "Consumer Cyclical",
    "META": "Communication Services",
    "TSLA": "Consumer Cyclical",
    "AVGO": "Semiconductors",
    "AMD": "Semiconductors",
    "INTC": "Semiconductors",
    "QCOM": "Semiconductors",
    "VRT": "Industrials",
    "SPY": "Diversified",
    "QQQ": "Technology",
    "IWM": "Diversified",
    "DIA": "Diversified",
    "XLE": "Energy",
    "XLF": "Financial Services",
    "XLK": "Technology",
    "XLV": "Healthcare",
    "XLI": "Industrials",
    "XLP": "Consumer Defensive",
    "XLY": "Consumer Cyclical",
    "XLU": "Utilities",
    "XLB": "Basic Materials",
    "XLRE": "Real Estate",
    "NVO": "Healthcare",
    "RIO": "Basic Materials",
    "CASH": "Cash",
}


def resolve_sector(symbol: str, user_provided_sector: str | None = None) -> str:
    """Resolve a ticker's sector, preferring user_provided_sector if explicitly given, else dictionary mapping."""
    if user_provided_sector and user_provided_sector.strip() and user_provided_sector.strip().lower() not in {"uncategorized", "unknown", "none", "n/a", ""}:
        return user_provided_sector.strip()
    if not symbol:
        return "Uncategorized"
    sym = symbol.strip().upper()
    if sym in TICKER_SECTORS:
        return TICKER_SECTORS[sym]
    return "Uncategorized"
