import json
import re

custom_map = {
    'COHR': 'Coherent Corp.',
    'CRDO': 'Credo Technology Group Holding Ltd',
    'CRM': 'Salesforce, Inc.',
    'CRWV': 'CoreWeave Inc.',
    'DRAM': 'Dataram Corp',
    'IGM': 'iShares Expanded Tech-Software Sector ETF',
    'IONQ': 'IonQ, Inc.',
    'IREN': 'IREN Limited',
    'MTZ': 'MasTec, Inc.',
    'NOW': 'ServiceNow, Inc.',
    'ONDS': 'Ondas Holdings Inc.',
    'QBTS': 'D-Wave Quantum Inc.',
    'QQQ': 'Invesco QQQ Trust Series 1',
    'QQQM': 'Invesco NASDAQ 100 ETF',
    'SPY': 'SPDR S&P 500 ETF Trust',
    'SOXX': 'iShares Semiconductor ETF',
    'SMH': 'VanEck Semiconductor ETF',
    'ARKK': 'ARK Innovation ETF',
    'VTI': 'Vanguard Total Stock Market ETF',
    'VOO': 'Vanguard S&P 500 ETF',
    'SCHD': 'Schwab U.S. Dividend Equity ETF',
    'CGDV': 'Capital Group Dividend Value ETF',
    'IWM': 'iShares Russell 2000 ETF',
    'GLD': 'SPDR Gold Shares',
    'SLV': 'iShares Silver Trust',
    "IVV": "iShares Core S&P 500 ETF",
    "EEM": "iShares MSCI Emerging Markets ETF",
    "EFA": "iShares MSCI EAFE ETF",
    "VEA": "Vanguard FTSE Developed Markets ETF",
    "VWO": "Vanguard FTSE Emerging Markets ETF",
    "XLK": "Technology Select Sector SPDR Fund",
    "XLF": "Financial Select Sector SPDR Fund",
    "XLE": "Energy Select Sector SPDR Fund",
    "XLV": "Health Care Select Sector SPDR Fund",
    "XLY": "Consumer Discretionary Select Sector SPDR Fund",
    "XLC": "Communication Services Select Sector SPDR Fund",
    "XLI": "Industrial Select Sector SPDR Fund",
    "XLB": "Materials Select Sector SPDR Fund",
    "XLU": "Utilities Select Sector SPDR Fund",
    "XLRE": "Real Estate Select Sector SPDR Fund",
    "IAU": "iShares Gold Trust",
    "TLT": "iShares 20+ Year Treasury Bond ETF",
    "IEF": "iShares 7-10 Year Treasury Bond ETF",
    "SHY": "iShares 1-3 Year Treasury Bond ETF",
    "BIL": "SPDR Bloomberg 1-3 Month T-Bill ETF",
    "ARKG": "ARK Genomic Revolution ETF",
    "ARKW": "ARK Next Generation Internet ETF",
    "ARKF": "ARK Fintech Innovation ETF",
    "SOXL": "Direxion Daily Semiconductor Bull 3X Shares",
    "SOXS": "Direxion Daily Semiconductor Bear 3X Shares",
    "TQQQ": "ProShares UltraPro QQQ",
    "SQQQ": "ProShares UltraPro Short QQQ",
    "DIA": "SPDR Dow Jones Industrial Average ETF Trust",
    "VUG": "Vanguard Growth ETF",
    "VTV": "Vanguard Value ETF",
    "VYM": "Vanguard High Dividend Yield ETF",
    "VNQ": "Vanguard Real Estate ETF",
    "BND": "Vanguard Total Bond Market ETF",
    "AGG": "iShares Core U.S. Aggregate Bond ETF",
    "LQD": "iShares iBoxx $ Investment Grade Corporate Bond ETF",
    "HYG": "iShares iBoxx $ High Yield Corporate Bond ETF",
    "JNK": "SPDR Bloomberg High Yield Bond ETF",
    "XBI": "SPDR S&P Biotech ETF",
    "IBB": "iShares Biotechnology ETF",
    "IGV": "iShares Expanded Tech-Software Sector ETF",
    "IWF": "iShares Russell 1000 Growth ETF",
    "IWD": "iShares Russell 1000 Value ETF",
    "IJR": "iShares Core S&P Small-Cap ETF",
    "IJH": "iShares Core S&P Mid-Cap ETF",
    "RSP": "Invesco S&P 500 Equal Weight ETF",
    "KWEB": "KraneShares CSI China Internet ETF",
    "FXI": "iShares China Large-Cap ETF",
    "MCHI": "iShares MSCI China ETF",
    "EWJ": "iShares MSCI Japan ETF",
    "EWG": "iShares MSCI Germany ETF",
    "EWU": "iShares MSCI United Kingdom ETF",
    "INDA": "iShares MSCI India ETF",
    "EWT": "iShares MSCI Taiwan ETF",
    "EWY": "iShares MSCI South Korea ETF",
    "XHB": "SPDR S&P Homebuilders ETF",
    "XRT": "SPDR S&P Retail ETF",
    "XME": "SPDR S&P Metals & Mining ETF",
    "XOP": "SPDR S&P Oil & Gas Exploration & Production ETF",
    "OIH": "VanEck Oil Services ETF",
    "GDX": "VanEck Gold Miners ETF",
    "GDXJ": "VanEck Junior Gold Miners ETF",
    "SIL": "Global X Silver Miners ETF",
    "LIT": "Global X Lithium & Battery Tech ETF",
    "URA": "Global X Uranium ETF",
    "TAN": "Invesco Solar ETF",
    "ICLN": "iShares Global Clean Energy ETF",
    "PAVE": "Global X U.S. Infrastructure Development ETF",
    "BOTZ": "Global X Robotics & Artificial Intelligence ETF",
    "AIQ": "Global X Artificial Intelligence & Technology ETF",
    "CIBR": "First Trust NASDAQ Cybersecurity ETF",
    "HACK": "ETFMG Prime Cyber Security ETF",
    "BUG": "Global X Cybersecurity ETF",
    "CLOU": "Global X Cloud Computing ETF",
    "WCLOUD": "WisdomTree Cloud Computing Fund",
    "SKYY": "First Trust Cloud Computing ETF",
    "FINX": "Global X FinTech ETF",
    "GNOM": "Global X Genomics & Biotechnology ETF",
    "BLOK": "Amplify Transformational Data Sharing ETF",
    "JEPI": "JPMorgan Equity Premium Income ETF",
    "JEPQ": "JPMorgan Nasdaq Equity Premium Income ETF",
    "DIVO": "Amplify CWP Enhanced Dividend Income ETF",
    "XYLD": "Global X S&P 500 Covered Call ETF",
    "QYLD": "Global X NASDAQ 100 Covered Call ETF",
    "RYLD": "Global X Russell 2000 Covered Call ETF",
    "VT": "Vanguard Total World Stock ETF",
    "VXUS": "Vanguard Total International Stock ETF",
    "IXUS": "iShares Core MSCI Total International Stock ETF",
    "ACWI": "iShares MSCI ACWI ETF",
    "VTIP": "Vanguard Short-Term Inflation-Protected Securities ETF",
    "TIP": "iShares TIPS Bond ETF",
    "SCHP": "Schwab U.S. TIPS ETF",
    "SCHA": "Schwab U.S. Small-Cap ETF",
    "SCHF": "Schwab International Equity ETF",
    "SCHE": "Schwab Emerging Markets Equity ETF",
    "SCHX": "Schwab U.S. Large-Cap ETF",
    "SCHG": "Schwab U.S. Large-Cap Growth ETF",
    "SCHV": "Schwab U.S. Large-Cap Value ETF",
    "SCHB": "Schwab U.S. Broad Market ETF",
    "VONG": "Vanguard Russell 1000 Growth ETF",
    "VONV": "Vanguard Russell 1000 Value ETF",
    "VTWO": "Vanguard Russell 2000 ETF",
    "MGK": "Vanguard Mega Cap Growth ETF",
    "MGV": "Vanguard Mega Cap Value ETF",
    "VO": "Vanguard Mid-Cap ETF",
    "VB": "Vanguard Small-Cap ETF",
    "VV": "Vanguard Large-Cap ETF",
    "VIG": "Vanguard Dividend Appreciation ETF",
    "VHT": "Vanguard Health Care ETF",
    "VIS": "Vanguard Industrials ETF",
    "VAW": "Vanguard Materials ETF",
    "VGT": "Vanguard Information Technology ETF",
    "VDC": "Vanguard Consumer Staples ETF",
    "VCR": "Vanguard Consumer Discretionary ETF",
    "VOX": "Vanguard Communication Services ETF",
    "VPU": "Vanguard Utilities ETF",
    "VDE": "Vanguard Energy ETF",
    "VFH": "Vanguard Financials ETF",
    "VGK": "Vanguard FTSE Europe ETF",
    "VPL": "Vanguard FTSE Pacific ETF",
    "VGIT": "Vanguard Intermediate-Term Treasury ETF",
    "VGLT": "Vanguard Long-Term Treasury ETF",
    "VGSH": "Vanguard Short-Term Treasury ETF",
    "VCIT": "Vanguard Intermediate-Term Corporate Bond ETF",
    "VCLT": "Vanguard Long-Term Corporate Bond ETF",
    "VCSH": "Vanguard Short-Term Corporate Bond ETF",
    "BNDX": "Vanguard Total International Bond ETF",
    "VWOB": "Vanguard Emerging Markets Government Bond ETF",
    "VMBS": "Vanguard Mortgage-Backed Securities ETF",
    "BSV": "Vanguard Short-Term Bond ETF",
    "BIV": "Vanguard Intermediate-Term Bond ETF",
    "BLV": "Vanguard Long-Term Bond ETF",
    "IGB": "iShares Biotech ETF",
    "XTL": "SPDR S&P Telecom ETF",
    "XNTK": "SPDR NYSE Technology ETF",
    "FTEC": "Fidelity MSCI Information Technology Index ETF",
    "FHLC": "Fidelity MSCI Health Care Index ETF",
    "FNCL": "Fidelity MSCI Financials Index ETF",
    "FENY": "Fidelity MSCI Energy Index ETF",
    "FDIS": "Fidelity MSCI Consumer Discretionary Index ETF",
    "FSTA": "Fidelity MSCI Consumer Staples Index ETF",
    "FUTY": "Fidelity MSCI Utilities Index ETF",
    "FIDU": "Fidelity MSCI Industrials Index ETF",
    "FMAT": "Fidelity MSCI Materials Index ETF",
    "FREL": "Fidelity MSCI Real Estate Index ETF",
    "FCOM": "Fidelity MSCI Communication Services Index ETF",
    "ONEQ": "Fidelity Nasdaq Composite Index ETF"
}

def clean_val(val: str) -> str:
    # remove backslashes and control chars
    val = val.replace('\\', ' ').replace('"', "'")
    val = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', val)
    return val.strip()

# 1. Read existing backend dictionary
with open('backend/app/company_names.py', 'r', encoding='utf-8') as f:
    backend_code = f.read()

company_dict = {}
for line in backend_code.splitlines():
    m = re.search(r'^\s*["\']([A-Z0-9.\-]+)["\']\s*:\s*["\'](.*?)["\'],?\s*$', line)
    if m:
        sym, name = m.group(1), clean_val(m.group(2))
        company_dict[sym] = name

for k, v in custom_map.items():
    company_dict[k] = clean_val(v)

# Rewrite backend/app/company_names.py
new_lines = [
    '"""Company name lookup directory for ticker symbols."""',
    'from __future__ import annotations',
    'import json',
    'import urllib.request',
    'import urllib.parse',
    '',
    'COMPANY_NAMES: dict[str, str] = {'
]

for k, v in sorted(company_dict.items()):
    new_lines.append(f'    "{k}": "{v}",')

new_lines.extend([
    '}',
    '',
    'def resolve_company_name(symbol: str, user_provided_name: str | None = None) -> str:',
    '    if not symbol:',
    '        return ""',
    '    sym = symbol.strip().upper()',
    '    if user_provided_name and user_provided_name.strip() and user_provided_name.strip().upper() != sym:',
    '        return user_provided_name.strip()',
    '    if sym in COMPANY_NAMES:',
    '        return COMPANY_NAMES[sym]',
    '    return sym',
    ''
])

with open('backend/app/company_names.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print(f"Updated backend/app/company_names.py with {len(company_dict)} tickers")

# 2. Update src/data/companyNames.ts
ts_lines = [
    'export const COMPANY_NAMES: Record<string, string> = {'
]
for k, v in sorted(company_dict.items()):
    ts_lines.append(f'  "{k}": "{v}",')
ts_lines.extend([
    '}',
    '',
    'export function resolveCompanyName(symbol: string, userProvidedName?: string | null): string {',
    '  if (!symbol) return ""',
    '  const sym = symbol.trim().toUpperCase()',
    '  if (userProvidedName && userProvidedName.trim() !== "" && userProvidedName.trim().toUpperCase() !== sym) {',
    '    return userProvidedName.trim()',
    '  }',
    '  if (COMPANY_NAMES[sym]) {',
    '    return COMPANY_NAMES[sym]',
    '  }',
    '  return sym',
    '}',
    ''
])

with open('src/data/companyNames.ts', 'w', encoding='utf-8') as f:
    f.write('\n'.join(ts_lines))

print(f"Updated src/data/companyNames.ts with {len(company_dict)} tickers")

# 3. Update preview.html
with open('preview.html', 'r', encoding='utf-8') as f:
    html_code = f.read()

json_names = json.dumps(company_dict, indent=2, ensure_ascii=True)
preview_dict_str = f"const COMPANY_NAMES = {json_names};"

html_code = re.sub(r'const COMPANY_NAMES = \{.*?\};', preview_dict_str, html_code, flags=re.DOTALL)

with open('preview.html', 'w', encoding='utf-8') as f:
    f.write(html_code)

print(f"Updated preview.html with full {len(company_dict)} tickers dictionary!")
