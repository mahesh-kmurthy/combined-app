# VantagePier Tracker & Analyzer

VantagePier is a comprehensive stock portfolio tracking and fundamental analysis web application. It combines real-time financial data fetching, secure cloud persistence (via Supabase), and interactive data visualization.

## Architecture

This project is built using a modern, lightweight tech stack designed for speed, simplicity, and serverless deployment:

- **Frontend:** Vanilla JavaScript, HTML5, and CSS3. 
  - Uses modern CSS (glassmorphism design, CSS variables).
  - Uses ES6 Modules (`type="module"`) to organize logic cleanly into `portfolio.js`, `fundamental.js`, `storage.js`, and `api.js`.
  - Uses `Chart.js` for dynamic portfolio allocation charts.

- **Backend:** Python + FastAPI (Serverless).
  - The backend resides in `api/index.py` and is fully configured for **Vercel Serverless Functions** (via `vercel.json`).
  - It fetches financial data from **Yahoo Finance** (via `yfinance`) and **Finnhub** (using `FINNHUB_API_KEY` if provided).
  - Handles generating Excel exports for fundamental data and processing autocomplete searches.

- **Authentication & Storage:** Supabase (PostgreSQL) + Google Cloud OAuth.
  - Users authenticate via Google OAuth, which is handled securely by Supabase Auth.
  - Transactions are securely stored in a cloud-hosted Supabase PostgreSQL database under the `transactions` table.
  - The database is protected by Row Level Security (RLS) policies to ensure users can only view and modify their own portfolio data.
  - Falls back to local device storage (`localStorage`) if the app is used without logging in.

## Deployment to Vercel

This app is natively configured for Vercel deployment.

1. Create a new project in Vercel and import this repository.
2. Vercel will automatically detect `vercel.json` and map all traffic starting with `/api/` to the Python backend (`api/index.py`), while natively hosting the frontend files on its Edge CDN.
3. Add the `FINNHUB_API_KEY` to Vercel's Environment Variables if you want to use the premium data source.
4. **Important**: Remember to update the **Site URL** and **Redirect URLs** in your Supabase dashboard to point to your new Vercel production domain!

## Running Locally

Because the frontend uses ES6 modules (`<script type="module">`), modern web browsers will block the app from loading if you try to open `index.html` directly (e.g. `file:///Users/.../index.html`) due to strict CORS rules.

To run the app locally, you must start the Python server:

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Start the FastAPI Server:**
   ```bash
   uvicorn api.index:app --port 8000
   ```
3. Open your web browser and navigate to: **http://localhost:8000**

## Supabase Database Setup

If you deploy this to a new Supabase project, you must initialize the database schema in the Supabase SQL Editor:

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT NOT NULL,
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  qty NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  account TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);
```

## Features

- **Multi-Currency Support:** Automatically detects Canadian tickers (`.TO`, `.V`, `.NE`) and converts values to USD using live DLR/DLR-U.TO exchange rates to ensure portfolio returns are calculated correctly in a unified currency.
- **Advanced Metrics:** Calculates Internal Rate of Return (IRR) via XIRR mathematics.
- **S&P 500 Benchmarking:** Simulates your exact trading history against the S&P 500 (VOO) to show if you are outperforming the market.
- **Fundamental Analysis:** Deep dive into 5 years of financials, automatically extracting Income Statements, Balance Sheets, and Cash Flows.
- **Valuation Models:** Real-time P/E Forecasting and Discounted Cash Flow (DCF) intrinsic value modeling.
- **Excel Export:** Download all financial data directly into an Excel file.
