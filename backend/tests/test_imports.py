import pytest

from app.imports import ImportError_, parse_portfolio, parse_watchlist, read_tabular


def _csv(text: str):
    return read_tabular("x.csv", text.encode("utf-8"))


def test_portfolio_weights_from_quantity_and_price():
    rows = _csv("Ticker,Shares,Price\nAAPL,10,200\nMSFT,10,300\n")
    result = parse_portfolio(rows)
    holdings = {h["symbol"]: h for h in result["holdings"]}
    # 2000 vs 3000 -> 40% / 60%
    assert holdings["AAPL"]["weight"] == 40.0
    assert holdings["MSFT"]["weight"] == 60.0
    assert result["has_signal_inputs"] is False  # no technical columns
    assert all(h["hasSignalInputs"] is False for h in result["holdings"])


def test_portfolio_explicit_weight_and_fraction_scaling():
    rows = _csv("symbol,weight\nAAPL,0.25\nMSFT,0.75\n")  # fractions -> percent
    holdings = {h["symbol"]: h for h in parse_portfolio(rows)["holdings"]}
    assert holdings["AAPL"]["weight"] == 25.0
    assert holdings["MSFT"]["weight"] == 75.0


def test_portfolio_technical_columns_flag_signal_ready():
    rows = _csv("symbol,weight,rsi,macd,sma50,sma200\nCRDO,50,58,true,yes,1\nNVDA,50,61,true,true,true\n")
    result = parse_portfolio(rows)
    assert result["has_signal_inputs"] is True
    crdo = next(h for h in result["holdings"] if h["symbol"] == "CRDO")
    assert crdo["hasSignalInputs"] is True
    assert crdo["rsi"] == 58
    assert crdo["macdBullish"] is True
    assert crdo["aboveSma50"] is True


def test_portfolio_currency_and_dollar_parsing_and_defaults():
    rows = _csv('symbol,name,sector,quantity,price,avg_cost\nAAPL,Apple,Tech,"1,000","$230.50","$180.00"\n')
    h = parse_portfolio(rows)["holdings"][0]
    assert h["name"] == "Apple" and h["sector"] == "Tech"
    assert h["quantity"] == 1000 and h["price"] == 230.5 and h["avgCost"] == 180.0
    assert h["weight"] == 100.0  # single holding


def test_portfolio_requires_symbol_and_a_way_to_weight():
    with pytest.raises(ImportError_):
        parse_portfolio(_csv("name,price\nApple,200\n"))  # no symbol column
    with pytest.raises(ImportError_):
        parse_portfolio(_csv("symbol\nAAPL\n"))  # no weight, no qty*price


def test_watchlist_parses_symbols_notes_and_dedupes():
    rows = _csv("Ticker,Name,Note\nNVDA,NVIDIA,core AI\nAVGO,Broadcom,\nNVDA,dupe,\n")
    result = parse_watchlist(rows)
    symbols = [i["symbol"] for i in result["items"]]
    assert symbols == ["NVDA", "AVGO"]  # duplicate dropped, order preserved
    assert result["items"][0]["note"] == "core AI"
    assert any("duplicate" in w for w in result["warnings"])


def test_portfolio_with_brokerage_metadata_title_rows():
    text = "Account: 123456\nGenerated: 2026-09-14\n\nSymbol/Ticker,Shares,Current Price\nNVDA,50,120\nMSFT,50,400\n"
    rows = read_tabular("schwab.csv", text.encode("utf-8"))
    res = parse_portfolio(rows)
    assert len(res["holdings"]) == 2
    assert res["holdings"][0]["symbol"] == "NVDA"
    assert res["holdings"][1]["symbol"] == "MSFT"


def test_portfolio_headerless_and_alternate_delimiter():
    text = "NVDA;100;150\nMSFT;50;450\n"
    rows = read_tabular("headerless.csv", text.encode("utf-8"))
    res = parse_portfolio(rows)
    assert len(res["holdings"]) == 2
    assert res["holdings"][0]["symbol"] == "NVDA"


def test_utf16_encoded_csv():
    text = "Ticker,Weight\nAAPL,50\nNVDA,50\n"
    rows = read_tabular("excel_utf16.csv", text.encode("utf-16"))
    res = parse_portfolio(rows)
    assert len(res["holdings"]) == 2
    assert res["holdings"][0]["symbol"] == "AAPL"


def test_messy_ticker_symbols_with_descriptions_and_apostrophes():
    text = 'Security Description,Quantity,Price\n"AAPL - Apple Inc.",10,200\n"MCD - McDonald\'s Corp.",10,280\n"NASDAQ:MSFT",5,400\n'
    rows = read_tabular("messy.csv", text.encode("utf-8"))
    res = parse_portfolio(rows)
    symbols = [h["symbol"] for h in res["holdings"]]
    assert symbols == ["AAPL", "MCD", "MSFT"]


def test_portfolio_skips_tax_lot_dates_and_numeric_symbols():
    text = (
        "Symbol,Shares,Price,Weight\n"
        "AAPL,100,200,0.5\n"
        "2023-06-09 00:00:00,50,200,0.25\n"
        "2024-01-15,50,200,0.25\n"
        "MSFT,50,400,0.5\n"
        "00,10,100,0.05\n"
        "TOTAL,-,-,-\n"
    )
    rows = read_tabular("lots.csv", text.encode("utf-8"))
    res = parse_portfolio(rows)
    symbols = [h["symbol"] for h in res["holdings"]]
    assert symbols == ["AAPL", "MSFT"]
    assert res["holdings"][0]["quantity"] == 100
    assert res["holdings"][1]["quantity"] == 50
    assert res["holdings"][0]["weight"] == 50.0
    assert res["holdings"][1]["weight"] == 50.0


def test_portfolio_derives_quantity_from_market_value_and_price():
    text = "Ticker,Price,Market Value\nAAPL,200,20000\nNVDA,100,30000\n"
    rows = read_tabular("mv.csv", text.encode("utf-8"))
    res = parse_portfolio(rows)
    holdings = {h["symbol"]: h for h in res["holdings"]}
    assert holdings["AAPL"]["quantity"] == 100.0
    assert holdings["NVDA"]["quantity"] == 300.0
    assert holdings["AAPL"]["weight"] == 40.0
    assert holdings["NVDA"]["weight"] == 60.0


def test_multisheet_excel_prefers_holdings_with_quantity():
    import io
    import openpyxl
    wb = openpyxl.Workbook()
    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.append(["Symbol", "Price", "Weight"])
    ws_summary.append(["AAPL", 200, 0.5])
    ws_summary.append(["MSFT", 400, 0.5])

    ws_holdings = wb.create_sheet("Holdings")
    ws_holdings.append(["Symbol", "Shares", "Price", "Weight"])
    ws_holdings.append(["AAPL", 100, 200, 0.5])
    ws_holdings.append(["MSFT", 50, 400, 0.5])

    buf = io.BytesIO()
    wb.save(buf)
    wb.close()

    rows = read_tabular("multi.xlsx", buf.getvalue())
    res = parse_portfolio(rows)
    assert len(res["holdings"]) == 2
    assert res["holdings"][0]["symbol"] == "AAPL"
    assert res["holdings"][0]["quantity"] == 100
    assert res["holdings"][1]["symbol"] == "MSFT"
    assert res["holdings"][1]["quantity"] == 50



