import json
import re

with open('preview.html', 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'const COMPANY_NAMES = (\{.*?\});', html, re.DOTALL)
if m:
    try:
        names = json.loads(m.group(1), strict=False)
    except Exception as e:
        # Fallback regex parser for symbol lines
        names = {}
        for line in m.group(1).splitlines():
            sm = re.search(r'"([A-Z0-9.\-]+)"\s*:\s*"(.*?)"', line)
            if sm:
                names[sm.group(1)] = sm.group(2)

    test_syms = ['COHR', 'CRDO', 'CRM', 'CRWV', 'DRAM', 'IGM', 'IONQ', 'IREN', 'MTZ', 'NOW', 'ONDS', 'QBTS', 'QQQ', 'SPY']
    for s in test_syms:
        print(f"{s} -> {names.get(s, 'MISSING')}")
