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

## AI Leverage & System Architecture

VantagePier was built using advanced AI-assisted development methodologies, showcasing how natural language prompting can be used to construct a full-stack financial application.

### Prompting Strategy
The application was built iteratively through a series of structured prompts:
1. **Foundation First**: Initial prompts focused purely on the frontend structure (HTML/CSS layout) and establishing the glassmorphism design system without any logic.
2. **Logic Integration**: Subsequent prompts instructed the AI to build `portfolio.js` to handle internal state (IRR, cost basis) using mock data.
3. **External Systems**: Finally, complex prompts were used to integrate Supabase auth and connect to the Python/FastAPI backend for real-time market data.

### Structured Logical Constraints
To ensure the AI produced reliable and maintainable code, strict architectural constraints were enforced during prompting:
- **Separation of Concerns**: The AI was explicitly instructed to split logic into `portfolio.js` (UI/State), `storage.js` (Database/Persistence), and `api.js` (External Data).
- **Graceful Degradation**: A constraint was set that the app *must* work without a database connection. The AI successfully built a dual-storage system in `storage.js` that falls back to `localStorage` (or a Sample Portfolio) if the user is unauthenticated.

### Handling Error Corrections
During development, AI-generated code required guided corrections for complex edge cases:
- **CORS & Local Execution**: When modern ES6 modules caused local CORS issues, the AI was prompted to generate a lightweight Python Server (`api/index.py`) to bypass browser restrictions.
- **API Rate Limiting**: When hitting Yahoo Finance API limits, the AI was instructed to build a caching mechanism (`history_cache`) using `localStorage` to save historical benchmark data and prevent redundant network calls.

### Data Ingestion Management
Ingesting user data and market data required robust AI-designed solutions:
- **CSV Parsing**: The AI generated a custom CSV parser capable of handling various date formats (US vs Euro) and ignoring commas within quoted numbers (e.g., `"1,000.00"`).
- **Currency Normalization**: To handle the ingestion of Canadian stocks, the AI was tasked with fetching live exchange rates (DLR/DLR-U.TO) and normalizing all portfolio metrics to USD in real-time.
