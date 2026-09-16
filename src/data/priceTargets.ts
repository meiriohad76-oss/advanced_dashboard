export interface PriceTargetInfo {
  saWallStreet: number | null
  saHigh?: number | null
  saLow?: number | null
  zacks: number | null
  zacksHigh?: number | null
  zacksLow?: number | null
}

// Extracted price targets directly from Seeking Alpha Wall Street and Zacks consensus database
export const EXTRACTED_PRICE_TARGETS: Record<string, PriceTargetInfo> = {
  "NVDA": {
    "saWallStreet": 225.0,
    "saHigh": 260.0,
    "saLow": 175.0,
    "zacks": 220.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "GOOGL": {
    "saWallStreet": 250.0,
    "saHigh": 275.0,
    "saLow": 220.0,
    "zacks": 245.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "AAOI": {
    "saWallStreet": 163.4,
    "saHigh": 220.0,
    "saLow": 109.0,
    "zacks": 163.4,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ABBNY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 98.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ABBV": {
    "saWallStreet": 274.36,
    "saHigh": 328.0,
    "saLow": 200.0,
    "zacks": 273.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ABT": {
    "saWallStreet": 118.42,
    "saHigh": 135.0,
    "saLow": 103.0,
    "zacks": 119.84,
    "zacksHigh": null,
    "zacksLow": null
  },
  "AEM": {
    "saWallStreet": 214.89,
    "saHigh": 300.0,
    "saLow": 87.0,
    "zacks": 220.78,
    "zacksHigh": null,
    "zacksLow": null
  },
  "AEP": {
    "saWallStreet": 144.48,
    "saHigh": 173.0,
    "saLow": 129.0,
    "zacks": 143.19,
    "zacksHigh": null,
    "zacksLow": null
  },
  "AIQUY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 45.9,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ALNY": {
    "saWallStreet": 375.76,
    "saHigh": 536.0,
    "saLow": 230.0,
    "zacks": 390.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "AMGN": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 377.07,
    "zacksHigh": null,
    "zacksLow": null
  },
  "AMKR": {
    "saWallStreet": 76.4,
    "saHigh": 92.0,
    "saLow": 65.0,
    "zacks": 73.13,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ANET": {
    "saWallStreet": 241.04,
    "saHigh": 289.0,
    "saLow": 185.0,
    "zacks": 242.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "APD": {
    "saWallStreet": 343.37,
    "saHigh": 365.0,
    "saLow": 314.0,
    "zacks": 340.86,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ARGX": {
    "saWallStreet": 1085.78,
    "saHigh": 1350.0,
    "saLow": 770.0,
    "zacks": 1077.43,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ASML": {
    "saWallStreet": 2165.44,
    "saHigh": 2864.31,
    "saLow": 898.54,
    "zacks": 2414.86,
    "zacksHigh": null,
    "zacksLow": null
  },
  "AZN": {
    "saWallStreet": 213.69,
    "saHigh": 240.0,
    "saLow": 184.0,
    "zacks": 211.32,
    "zacksHigh": null,
    "zacksLow": null
  },
  "B": {
    "saWallStreet": 51.74,
    "saHigh": 63.0,
    "saLow": 29.0,
    "zacks": 52.53,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BA": {
    "saWallStreet": 274.69,
    "saHigh": 305.0,
    "saLow": 246.0,
    "zacks": 274.32,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BASFY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 13.13,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BHP": {
    "saWallStreet": 73.64,
    "saHigh": 91.0,
    "saLow": 60.0,
    "zacks": 76.36,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BIIB": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 236.52,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BKR": {
    "saWallStreet": 71.39,
    "saHigh": 85.0,
    "saLow": 51.0,
    "zacks": 72.43,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BMRN": {
    "saWallStreet": 89.52,
    "saHigh": 124.0,
    "saLow": 60.0,
    "zacks": 87.83,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BMY": {
    "saWallStreet": 66.21,
    "saHigh": 80.0,
    "saLow": 40.0,
    "zacks": 66.04,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BNTX": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 124.44,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BP": {
    "saWallStreet": 47.6,
    "saHigh": 64.0,
    "saLow": 37.0,
    "zacks": 47.25,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BSX": {
    "saWallStreet": 62.69,
    "saHigh": 94.0,
    "saLow": 44.0,
    "zacks": 62.31,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BTI": {
    "saWallStreet": 70.43,
    "saHigh": 75.0,
    "saLow": 63.0,
    "zacks": 68.28,
    "zacksHigh": null,
    "zacksLow": null
  },
  "BUD": {
    "saWallStreet": 97.03,
    "saHigh": 111.0,
    "saLow": 85.0,
    "zacks": 98.13,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CAT": {
    "saWallStreet": 972.95,
    "saHigh": 1225.0,
    "saLow": 575.0,
    "zacks": 1002.57,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CEG": {
    "saWallStreet": 349.96,
    "saHigh": 441.0,
    "saLow": 290.0,
    "zacks": 356.43,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CIEN": {
    "saWallStreet": 504.13,
    "saHigh": 660.0,
    "saLow": 325.0,
    "zacks": 520.97,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CL": {
    "saWallStreet": 98.95,
    "saHigh": 110.0,
    "saLow": 87.0,
    "zacks": 98.05,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CLS": {
    "saWallStreet": 477.22,
    "saHigh": 550.0,
    "saLow": 415.0,
    "zacks": 468.29,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CNQ": {
    "saWallStreet": 48.21,
    "saHigh": 55.3,
    "saLow": 44.06,
    "zacks": 51.08,
    "zacksHigh": null,
    "zacksLow": null
  },
  "COHR": {
    "saWallStreet": 415.36,
    "saHigh": 500.0,
    "saLow": 280.0,
    "zacks": 414.75,
    "zacksHigh": null,
    "zacksLow": null
  },
  "COP": {
    "saWallStreet": 142.63,
    "saHigh": 189.0,
    "saLow": 115.0,
    "zacks": 140.76,
    "zacksHigh": null,
    "zacksLow": null
  },
  "COST": {
    "saWallStreet": 1077.31,
    "saHigh": 1315.0,
    "saLow": 740.0,
    "zacks": 1101.94,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CRDO": {
    "saWallStreet": 281.39,
    "saHigh": 350.0,
    "saLow": 185.0,
    "zacks": 282.26,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CRH": {
    "saWallStreet": 138.65,
    "saHigh": 165.0,
    "saLow": 105.0,
    "zacks": 142.09,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CRM": {
    "saWallStreet": 273.37,
    "saHigh": 475.0,
    "saLow": 160.0,
    "zacks": 276.9,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CRSP": {
    "saWallStreet": 87.56,
    "saHigh": 291.0,
    "saLow": 44.0,
    "zacks": 86.47,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CRWD": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 194.1,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CRWV": {
    "saWallStreet": 144.46,
    "saHigh": 317.0,
    "saLow": 39.0,
    "zacks": 140.3,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CTVA": {
    "saWallStreet": 92.4,
    "saHigh": 103.0,
    "saLow": 78.0,
    "zacks": 92.16,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CVLT": {
    "saWallStreet": 161.15,
    "saHigh": 200.0,
    "saLow": 130.0,
    "zacks": 158.36,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CVS": {
    "saWallStreet": 115.8,
    "saHigh": 148.0,
    "saLow": 103.0,
    "zacks": 113.27,
    "zacksHigh": null,
    "zacksLow": null
  },
  "CVX": {
    "saWallStreet": 216.96,
    "saHigh": 236.0,
    "saLow": 175.0,
    "zacks": 216.42,
    "zacksHigh": null,
    "zacksLow": null
  },
  "D": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 70.45,
    "zacksHigh": null,
    "zacksLow": null
  },
  "DANOY": {
    "saWallStreet": 18.82,
    "saHigh": 21.3,
    "saLow": 16.5,
    "zacks": 20.7,
    "zacksHigh": null,
    "zacksLow": null
  },
  "DE": {
    "saWallStreet": 648.03,
    "saHigh": 812.0,
    "saLow": 500.0,
    "zacks": 651.02,
    "zacksHigh": null,
    "zacksLow": null
  },
  "DEO": {
    "saWallStreet": 104.0,
    "saHigh": 136.0,
    "saLow": 76.0,
    "zacks": 101.67,
    "zacksHigh": null,
    "zacksLow": null
  },
  "DHR": {
    "saWallStreet": 227.96,
    "saHigh": 310.0,
    "saLow": 195.0,
    "zacks": 223.55,
    "zacksHigh": null,
    "zacksLow": null
  },
  "DUK": {
    "saWallStreet": 137.74,
    "saHigh": 147.0,
    "saLow": 129.0,
    "zacks": 138.6,
    "zacksHigh": null,
    "zacksLow": null
  },
  "EADSY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 63.01,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ECL": {
    "saWallStreet": 324.67,
    "saHigh": 360.0,
    "saLow": 295.0,
    "zacks": 323.41,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ED": {
    "saWallStreet": 111.21,
    "saHigh": 130.0,
    "saLow": 94.0,
    "zacks": 112.62,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ELV": {
    "saWallStreet": 449.1,
    "saHigh": 492.0,
    "saLow": 393.0,
    "zacks": 447.85,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ENB": {
    "saWallStreet": 52.21,
    "saHigh": 59.71,
    "saLow": 45.36,
    "zacks": 56.98,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ENGIY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 33.79,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ENLAY": {
    "saWallStreet": 11.62,
    "saHigh": 11.66,
    "saLow": 11.58,
    "zacks": 11.57,
    "zacksHigh": null,
    "zacksLow": null
  },
  "EOG": {
    "saWallStreet": 158.81,
    "saHigh": 196.0,
    "saLow": 127.0,
    "zacks": 157.96,
    "zacksHigh": null,
    "zacksLow": null
  },
  "EONGY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 22.74,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ERO": {
    "saWallStreet": 40.07,
    "saHigh": 44.0,
    "saLow": 33.0,
    "zacks": 37.71,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ETN": {
    "saWallStreet": 471.47,
    "saHigh": 534.0,
    "saLow": 333.0,
    "zacks": 480.91,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ETR": {
    "saWallStreet": 123.88,
    "saHigh": 139.0,
    "saLow": 91.0,
    "zacks": 125.23,
    "zacksHigh": null,
    "zacksLow": null
  },
  "EXC": {
    "saWallStreet": 49.33,
    "saHigh": 58.0,
    "saLow": 41.0,
    "zacks": 49.94,
    "zacksHigh": null,
    "zacksLow": null
  },
  "EXEL": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 51.94,
    "zacksHigh": null,
    "zacksLow": null
  },
  "FCX": {
    "saWallStreet": 71.73,
    "saHigh": 82.0,
    "saLow": 30.0,
    "zacks": 72.74,
    "zacksHigh": null,
    "zacksLow": null
  },
  "GE": {
    "saWallStreet": 404.9,
    "saHigh": 455.0,
    "saLow": 347.0,
    "zacks": 397.43,
    "zacksHigh": null,
    "zacksLow": null
  },
  "GEV": {
    "saWallStreet": 1226.42,
    "saHigh": 1450.0,
    "saLow": 836.0,
    "zacks": 1260.78,
    "zacksHigh": null,
    "zacksLow": null
  },
  "GILD": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 158.86,
    "zacksHigh": null,
    "zacksLow": null
  },
  "GLNCY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 17.33,
    "zacksHigh": null,
    "zacksLow": null
  },
  "HALO": {
    "saWallStreet": 97.33,
    "saHigh": 115.0,
    "saLow": 70.0,
    "zacks": 86.89,
    "zacksHigh": null,
    "zacksLow": null
  },
  "HIMS": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 30.25,
    "zacksHigh": null,
    "zacksLow": null
  },
  "HTHIY": {
    "saWallStreet": 38.71,
    "saHigh": 38.71,
    "saLow": 38.71,
    "zacks": 38.7,
    "zacksHigh": null,
    "zacksLow": null
  },
  "HWM": {
    "saWallStreet": 328.93,
    "saHigh": 375.0,
    "saLow": 256.56,
    "zacks": 312.45,
    "zacksHigh": null,
    "zacksLow": null
  },
  "IBDRY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 97.02,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ILMN": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 196.28,
    "zacksHigh": null,
    "zacksLow": null
  },
  "INCY": {
    "saWallStreet": 124.96,
    "saHigh": 155.0,
    "saLow": 86.0,
    "zacks": 126.73,
    "zacksHigh": null,
    "zacksLow": null
  },
  "INSM": {
    "saWallStreet": 200.5,
    "saHigh": 243.0,
    "saLow": 169.0,
    "zacks": 196.18,
    "zacksHigh": null,
    "zacksLow": null
  },
  "IONQ": {
    "saWallStreet": 69.25,
    "saHigh": 100.0,
    "saLow": 49.0,
    "zacks": 69.25,
    "zacksHigh": null,
    "zacksLow": null
  },
  "IREN": {
    "saWallStreet": 77.84,
    "saHigh": 131.0,
    "saLow": 43.0,
    "zacks": 78.62,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ISRG": {
    "saWallStreet": 477.25,
    "saHigh": 685.0,
    "saLow": 324.0,
    "zacks": 480.87,
    "zacksHigh": null,
    "zacksLow": null
  },
  "JAPAY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 26.5,
    "zacksHigh": null,
    "zacksLow": null
  },
  "JNJ": {
    "saWallStreet": 272.5,
    "saHigh": 305.0,
    "saLow": 190.0,
    "zacks": 275.83,
    "zacksHigh": null,
    "zacksLow": null
  },
  "KMI": {
    "saWallStreet": 35.62,
    "saHigh": 43.0,
    "saLow": 31.0,
    "zacks": 36.15,
    "zacksHigh": null,
    "zacksLow": null
  },
  "KO": {
    "saWallStreet": 94.7,
    "saHigh": 104.0,
    "saLow": 75.0,
    "zacks": 95.67,
    "zacksHigh": null,
    "zacksLow": null
  },
  "KTOS": {
    "saWallStreet": 104.2,
    "saHigh": 150.0,
    "saLow": 60.0,
    "zacks": 105.45,
    "zacksHigh": null,
    "zacksLow": null
  },
  "LHX": {
    "saWallStreet": 340.62,
    "saHigh": 405.0,
    "saLow": 269.0,
    "zacks": 367.94,
    "zacksHigh": null,
    "zacksLow": null
  },
  "LIN": {
    "saWallStreet": 548.0,
    "saHigh": 612.0,
    "saLow": 400.0,
    "zacks": 550.82,
    "zacksHigh": null,
    "zacksLow": null
  },
  "LLY": {
    "saWallStreet": 1292.53,
    "saHigh": 1600.0,
    "saLow": 850.0,
    "zacks": 1290.52,
    "zacksHigh": null,
    "zacksLow": null
  },
  "LMT": {
    "saWallStreet": 637.84,
    "saHigh": 756.0,
    "saLow": 503.0,
    "zacks": 650.65,
    "zacksHigh": null,
    "zacksLow": null
  },
  "LRLCY": {
    "saWallStreet": 99.33,
    "saHigh": 101.0,
    "saLow": 97.0,
    "zacks": 105.5,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MDGL": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 675.65,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MDLZ": {
    "saWallStreet": 69.13,
    "saHigh": 77.0,
    "saLow": 55.0,
    "zacks": 68.9,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MDT": {
    "saWallStreet": 98.44,
    "saHigh": 121.0,
    "saLow": 78.0,
    "zacks": 97.04,
    "zacksHigh": null,
    "zacksLow": null
  },
  "META": {
    "saWallStreet": 756.95,
    "saHigh": 1000.0,
    "saLow": 580.0,
    "zacks": 754.58,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MNST": {
    "saWallStreet": 98.13,
    "saHigh": 113.0,
    "saLow": 70.0,
    "zacks": 97.09,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MO": {
    "saWallStreet": 70.55,
    "saHigh": 82.0,
    "saLow": 59.0,
    "zacks": 70.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MPC": {
    "saWallStreet": 316.61,
    "saHigh": 376.0,
    "saLow": 186.0,
    "zacks": 317.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MRK": {
    "saWallStreet": 136.85,
    "saHigh": 155.0,
    "saLow": 105.0,
    "zacks": 137.08,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MRNA": {
    "saWallStreet": 50.84,
    "saHigh": 79.0,
    "saLow": 25.0,
    "zacks": 52.25,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MSFT": {
    "saWallStreet": 563.05,
    "saHigh": 870.0,
    "saLow": 400.0,
    "zacks": 545.85,
    "zacksHigh": null,
    "zacksLow": null
  },
  "MTZ": {
    "saWallStreet": 505.25,
    "saHigh": 581.0,
    "saLow": 453.0,
    "zacks": 503.67,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NBIX": {
    "saWallStreet": 210.76,
    "saHigh": 253.0,
    "saLow": 164.0,
    "zacks": 210.14,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NEE": {
    "saWallStreet": 98.53,
    "saHigh": 116.0,
    "saLow": 55.0,
    "zacks": 97.63,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NEM": {
    "saWallStreet": 132.87,
    "saHigh": 170.0,
    "saLow": 67.0,
    "zacks": 133.27,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NGG": {
    "saWallStreet": 90.89,
    "saHigh": 99.5,
    "saLow": 71.0,
    "zacks": 88.88,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NGLOY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 26.5,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NOC": {
    "saWallStreet": 648.05,
    "saHigh": 815.0,
    "saLow": 538.0,
    "zacks": 663.45,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NOW": {
    "saWallStreet": 142.97,
    "saHigh": 248.0,
    "saLow": 72.0,
    "zacks": 146.16,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NSRGY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 105.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NUE": {
    "saWallStreet": 283.56,
    "saHigh": 305.0,
    "saLow": 231.0,
    "zacks": 282.6,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NVO": {
    "saWallStreet": 47.17,
    "saHigh": 63.6,
    "saLow": 40.29,
    "zacks": 47.87,
    "zacksHigh": null,
    "zacksLow": null
  },
  "NVS": {
    "saWallStreet": 155.37,
    "saHigh": 180.0,
    "saLow": 123.0,
    "zacks": 148.05,
    "zacksHigh": null,
    "zacksLow": null
  },
  "OKE": {
    "saWallStreet": 96.29,
    "saHigh": 108.0,
    "saLow": 88.0,
    "zacks": 96.29,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ONDS": {
    "saWallStreet": 19.42,
    "saHigh": 25.0,
    "saLow": 13.0,
    "zacks": 19.42,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ORCL": {
    "saWallStreet": 239.1,
    "saHigh": 400.0,
    "saLow": 110.0,
    "zacks": 251.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PAAS": {
    "saWallStreet": 65.25,
    "saHigh": 94.0,
    "saLow": 49.0,
    "zacks": 65.17,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PCG": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 22.93,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PEG": {
    "saWallStreet": 86.97,
    "saHigh": 97.0,
    "saLow": 75.0,
    "zacks": 88.61,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PEP": {
    "saWallStreet": 155.0,
    "saHigh": 183.0,
    "saLow": 124.0,
    "zacks": 155.29,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PFE": {
    "saWallStreet": 28.64,
    "saHigh": 35.75,
    "saLow": 25.0,
    "zacks": 28.83,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PG": {
    "saWallStreet": 160.7,
    "saHigh": 186.0,
    "saLow": 145.0,
    "zacks": 161.67,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PH": {
    "saWallStreet": 1133.59,
    "saHigh": 1358.0,
    "saLow": 680.0,
    "zacks": 1050.26,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PM": {
    "saWallStreet": 207.27,
    "saHigh": 230.0,
    "saLow": 175.0,
    "zacks": 207.23,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PR": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 24.74,
    "zacksHigh": null,
    "zacksLow": null
  },
  "PSX": {
    "saWallStreet": 214.26,
    "saHigh": 255.0,
    "saLow": 138.0,
    "zacks": 209.16,
    "zacksHigh": null,
    "zacksLow": null
  },
  "QBTS": {
    "saWallStreet": 35.24,
    "saHigh": 43.0,
    "saLow": 22.0,
    "zacks": 35.73,
    "zacksHigh": null,
    "zacksLow": null
  },
  "REGN": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 842.11,
    "zacksHigh": null,
    "zacksLow": null
  },
  "RHHBY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 57.77,
    "zacksHigh": null,
    "zacksLow": null
  },
  "RIO": {
    "saWallStreet": 105.85,
    "saHigh": 125.0,
    "saLow": 88.0,
    "zacks": 104.64,
    "zacksHigh": null,
    "zacksLow": null
  },
  "RTX": {
    "saWallStreet": 232.27,
    "saHigh": 265.0,
    "saLow": 183.98,
    "zacks": 232.91,
    "zacksHigh": null,
    "zacksLow": null
  },
  "RVMD": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 209.41,
    "zacksHigh": null,
    "zacksLow": null
  },
  "RWEOY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 80.1,
    "zacksHigh": null,
    "zacksLow": null
  },
  "RYCEY": {
    "saWallStreet": 22.94,
    "saHigh": 24.62,
    "saLow": 20.5,
    "zacks": 24.62,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SAFRY": {
    "saWallStreet": 113.74,
    "saHigh": 123.18,
    "saLow": 104.3,
    "zacks": 123.18,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SBGSY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 78.7,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SHECY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 6.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SHEL": {
    "saWallStreet": 98.03,
    "saHigh": 120.6,
    "saLow": 81.6,
    "zacks": 99.32,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SHW": {
    "saWallStreet": 390.1,
    "saHigh": 420.0,
    "saLow": 340.0,
    "zacks": 389.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SIEGY": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 177.0,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SLB": {
    "saWallStreet": 61.97,
    "saHigh": 71.0,
    "saLow": 43.0,
    "zacks": 63.59,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SO": {
    "saWallStreet": 100.67,
    "saHigh": 114.0,
    "saLow": 79.0,
    "zacks": 101.93,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SRE": {
    "saWallStreet": 104.64,
    "saHigh": 118.0,
    "saLow": 93.0,
    "zacks": 105.47,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SU": {
    "saWallStreet": 70.68,
    "saHigh": 75.48,
    "saLow": 67.73,
    "zacks": 74.87,
    "zacksHigh": null,
    "zacksLow": null
  },
  "SYK": {
    "saWallStreet": 382.04,
    "saHigh": 465.0,
    "saLow": 315.0,
    "zacks": 379.81,
    "zacksHigh": null,
    "zacksLow": null
  },
  "TGT": {
    "saWallStreet": 137.9,
    "saHigh": 170.0,
    "saLow": 92.0,
    "zacks": 137.63,
    "zacksHigh": null,
    "zacksLow": null
  },
  "TMO": {
    "saWallStreet": 631.42,
    "saHigh": 750.0,
    "saLow": 520.0,
    "zacks": 635.29,
    "zacksHigh": null,
    "zacksLow": null
  },
  "TRGP": {
    "saWallStreet": 298.9,
    "saHigh": 335.0,
    "saLow": 257.0,
    "zacks": 296.86,
    "zacksHigh": null,
    "zacksLow": null
  },
  "TRP": {
    "saWallStreet": 66.36,
    "saHigh": 72.51,
    "saLow": 57.77,
    "zacks": 72.53,
    "zacksHigh": null,
    "zacksLow": null
  },
  "TSM": {
    "saWallStreet": 551.26,
    "saHigh": 700.0,
    "saLow": 440.0,
    "zacks": 514.14,
    "zacksHigh": null,
    "zacksLow": null
  },
  "TTE": {
    "saWallStreet": 95.0,
    "saHigh": 107.0,
    "saLow": 81.0,
    "zacks": 91.75,
    "zacksHigh": null,
    "zacksLow": null
  },
  "UBER": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 103.93,
    "zacksHigh": null,
    "zacksLow": null
  },
  "UL": {
    "saWallStreet": 73.11,
    "saHigh": 76.37,
    "saLow": 69.24,
    "zacks": 73.75,
    "zacksHigh": null,
    "zacksLow": null
  },
  "UNH": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 481.52,
    "zacksHigh": null,
    "zacksLow": null
  },
  "UNP": {
    "saWallStreet": 329.25,
    "saHigh": 375.0,
    "saLow": 245.0,
    "zacks": 334.18,
    "zacksHigh": null,
    "zacksLow": null
  },
  "USAR": {
    "saWallStreet": 37.5,
    "saHigh": 45.0,
    "saLow": 30.0,
    "zacks": 37.14,
    "zacksHigh": null,
    "zacksLow": null
  },
  "UTHR": {
    "saWallStreet": 656.15,
    "saHigh": 738.0,
    "saLow": 515.0,
    "zacks": 670.15,
    "zacksHigh": null,
    "zacksLow": null
  },
  "VALE": {
    "saWallStreet": 16.8,
    "saHigh": 21.0,
    "saLow": 12.0,
    "zacks": 16.44,
    "zacksHigh": null,
    "zacksLow": null
  },
  "VLO": {
    "saWallStreet": 309.79,
    "saHigh": 365.0,
    "saLow": 190.0,
    "zacks": 314.17,
    "zacksHigh": null,
    "zacksLow": null
  },
  "VRT": {
    "saWallStreet": 338.15,
    "saHigh": 427.0,
    "saLow": 236.0,
    "zacks": 338.87,
    "zacksHigh": null,
    "zacksLow": null
  },
  "VRTX": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 559.08,
    "zacksHigh": null,
    "zacksLow": null
  },
  "VST": {
    "saWallStreet": 222.11,
    "saHigh": 313.0,
    "saLow": 106.0,
    "zacks": 222.81,
    "zacksHigh": null,
    "zacksLow": null
  },
  "WMB": {
    "saWallStreet": 84.7,
    "saHigh": 99.0,
    "saLow": 69.0,
    "zacks": 84.68,
    "zacksHigh": null,
    "zacksLow": null
  },
  "WMT": {
    "saWallStreet": 137.97,
    "saHigh": 155.0,
    "saLow": 81.0,
    "zacks": 140.45,
    "zacksHigh": null,
    "zacksLow": null
  },
  "WPM": {
    "saWallStreet": 172.35,
    "saHigh": 215.0,
    "saLow": 145.0,
    "zacks": 165.84,
    "zacksHigh": null,
    "zacksLow": null
  },
  "XEL": {
    "saWallStreet": 92.39,
    "saHigh": 102.0,
    "saLow": 74.0,
    "zacks": 93.72,
    "zacksHigh": null,
    "zacksLow": null
  },
  "XOM": {
    "saWallStreet": 168.32,
    "saHigh": 185.0,
    "saLow": 142.0,
    "zacks": 162.8,
    "zacksHigh": null,
    "zacksLow": null
  },
  "ZBRA": {
    "saWallStreet": null,
    "saHigh": null,
    "saLow": null,
    "zacks": 343.29,
    "zacksHigh": null,
    "zacksLow": null
  }
}
