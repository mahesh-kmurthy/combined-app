# Zocalo Tracker & Analyzer

Zocalo is a comprehensive stock portfolio tracking and fundamental analysis web application. It combines real-time financial data fetching, secure cloud persistence (via Supabase), and interactive data visualization.

## Architecture

This project uses a modern, lightweight tech stack designed for speed and simplicity:

- **Frontend:** Vanilla JavaScript, HTML5, and CSS3. 
  - Uses modern CSS (glassmorphism design, CSS variables).
  - Uses ES6 Modules (`type="module"`) to organize logic cleanly into `portfolio.js`, `fundamental.js`, `storage.js`, and `api.js`.
  - Uses `Chart.js` for dynamic portfolio allocation charts.

- **Backend:** Python + FastAPI.
  - The `server.py` file serves both as the API proxy and the static file server.
  - It fetches financial data from **Yahoo Finance** (via `yfinance`) and **Finnhub** (using `FINNHUB_API_KEY` if provided).
  - Handles generating Excel exports for fundamental data.

- **Storage:** Supabase & LocalStorage.
  - Transactions are securely stored in a Supabase PostgreSQL database if the user is authenticated.
  - Falls back to `localStorage` automatically if used entirely offline without logging in.

## Why Localhost is Required

You **cannot** open `index.html` directly in your web browser (e.g. `file:///Users/.../index.html`). 

1. **CORS Policies:** The frontend uses ES6 modules (`<script type="module">`). Modern web browsers enforce strict Cross-Origin Resource Sharing (CORS) rules that prevent local files from importing other local files via the `file://` protocol.
2. **API Backend:** The frontend requires the FastAPI backend to be running to fetch live stock quotes, historical data, and autocomplete search results from Yahoo Finance and Finnhub.

You must run the Python server and access the app via `http://localhost:8000`.

## Installation & Setup

1. **Prerequisites:** Make sure you have Python 3 installed.
2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   (Dependencies include: `fastapi`, `uvicorn`, `yfinance`, `pandas`, `requests`, `openpyxl`)

3. **Optional API Key:**
   To use Finnhub for faster and more reliable live market data (especially for non-US stocks), export your API key before running the server:
   ```bash
   export FINNHUB_API_KEY="your_api_key_here"
   ```

## Running the App

Start the FastAPI server from your terminal:

```bash
python server.py
# Alternatively: uvicorn server:app --reload
```

Then, open your web browser and navigate to:
**http://localhost:8000**

## Features

- **Multi-Currency Support:** Automatically detects Canadian tickers (`.TO`, `.V`, `.NE`) and converts values to USD using live DLR/DLR-U.TO exchange rates to ensure portfolio returns are calculated correctly in a unified currency.
- **Advanced Metrics:** Calculates Internal Rate of Return (IRR) via XIRR mathematics.
- **S&P 500 Benchmarking:** Simulates your exact trading history against the S&P 500 (VOO) to show if you are outperforming the market.
- **Fundamental Analysis:** Deep dive into 5 years of financials, automatically extracting Income Statements, Balance Sheets, and Cash Flows.
- **Valuation Models:** Real-time P/E Forecasting and Discounted Cash Flow (DCF) intrinsic value modeling.
- **Excel Export:** Download all financial data directly into an Excel file or upload your own custom spreadsheet template for the backend to inject data into.
