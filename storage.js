// storage.js
// Handles Supabase persistence and fallback LocalStorage

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://zlbbhzxhpvqwljjvxtgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7TfC7NLyEwKQDU_jFiJI9Q_9Y2-3r6Z';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TXN_KEY = 'portfolio_transactions';
const SETTINGS_KEY = 'portfolio_settings';

export async function getTransactions() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (!error && data) return data;
  }
  
  // Fallback to local storage if not logged in
  const data = localStorage.getItem(TXN_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveTransaction(txn) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    txn.id = Date.now().toString();
    txn.user_id = sessionData.session.user.id;
    const { data, error } = await supabase
      .from('transactions')
      .insert([txn])
      .select();
    if (error) console.error("Error saving txn:", error);
    return await getTransactions();
  }
  
  const transactions = await getTransactions();
  txn.id = Date.now().toString();
  transactions.push(txn);
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  localStorage.setItem(TXN_KEY, JSON.stringify(transactions));
  return transactions;
}

export async function importTransactions(txns) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    const user_id = sessionData.session.user.id;
    const mappedTxns = txns.map(t => {
      t.id = Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5);
      t.user_id = user_id;
      return t;
    });
    const { error } = await supabase
      .from('transactions')
      .insert(mappedTxns);
    if (error) console.error("Error importing txns:", error);
    return await getTransactions();
  }
  
  let transactions = await getTransactions();
  txns.forEach(txn => {
    txn.id = Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5);
    transactions.push(txn);
  });
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  localStorage.setItem(TXN_KEY, JSON.stringify(transactions));
  return transactions;
}

export async function updateTransaction(txn) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    const { error } = await supabase
      .from('transactions')
      .update({
        type: txn.type,
        ticker: txn.ticker,
        date: txn.date,
        qty: txn.qty,
        price: txn.price,
        account: txn.account,
        notes: txn.notes
      })
      .eq('id', txn.id);
    if (error) console.error("Error updating txn:", error);
    return await getTransactions();
  }
  
  let transactions = await getTransactions();
  const index = transactions.findIndex(t => t.id === txn.id);
  if (index !== -1) {
    transactions[index] = txn;
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(TXN_KEY, JSON.stringify(transactions));
  }
  return transactions;
}

export async function getTransactionById(id) {
  const transactions = await getTransactions();
  return transactions.find(t => t.id === id);
}

export async function deleteTransaction(id) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    if (error) console.error("Error deleting txn:", error);
    return await getTransactions();
  }

  let transactions = await getTransactions();
  transactions = transactions.filter(t => t.id !== id);
  localStorage.setItem(TXN_KEY, JSON.stringify(transactions));
  return transactions;
}

export async function deleteAllTransactions() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
     await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
     return [];
  }
  localStorage.removeItem(TXN_KEY);
  return [];
}

// Helper to calculate holdings
export function getHoldings(transactions) {
  const holdings = {}; // grouped by ticker

  // Must process in chronological order to calculate running average correctly
  const sortedTxns = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedTxns.forEach(t => {
    // API needs upper case symbols
    const sym = t.ticker.toUpperCase();
    if (!holdings[sym]) {
      holdings[sym] = {
        ticker: sym,
        shares: 0,
        totalCost: 0
      };
    }

    const qty = Math.abs(parseFloat(t.qty)) || 0;
    const price = Math.abs(parseFloat(t.price)) || 0;
    const cost = qty * price;

    if (t.type === 'BUY') {
      holdings[sym].totalCost += cost;
      holdings[sym].shares += qty;
    } else if (t.type === 'SELL') {
      // Calculate average cost to deduct proportionally
      const avgCost = holdings[sym].shares > 0 ? holdings[sym].totalCost / holdings[sym].shares : 0;
      holdings[sym].shares -= qty;
      holdings[sym].totalCost -= (avgCost * qty);
    }
  });

  // Filter out zero-share holdings (or negative due to errors)
  return Object.values(holdings).filter(h => h.shares > 0.0001);
}

// --- VOO Benchmark Helpers ---

const VOO_HISTORY_KEY = 'voo_history_cache';
const VOO_HISTORY_DATE_KEY = 'voo_history_date';

export function getCachedVooHistory() {
  const data = localStorage.getItem(VOO_HISTORY_KEY);
  return data ? JSON.parse(data) : null;
}

export function saveCachedVooHistory(historyMap) {
  localStorage.setItem(VOO_HISTORY_KEY, JSON.stringify(historyMap));
  localStorage.setItem(VOO_HISTORY_DATE_KEY, new Date().toISOString());
}

export function getVooHistoryAgeDays() {
  const dateStr = localStorage.getItem(VOO_HISTORY_DATE_KEY);
  if (!dateStr) return 999;
  const diffTime = Math.abs(new Date() - new Date(dateStr));
  return diffTime / (1000 * 60 * 60 * 24);
}

export function getCachedHistory(ticker) {
  const data = localStorage.getItem(`history_cache_${ticker}`);
  return data ? JSON.parse(data) : null;
}

export function saveCachedHistory(ticker, historyMap) {
  localStorage.setItem(`history_cache_${ticker}`, JSON.stringify(historyMap));
  localStorage.setItem(`history_date_${ticker}`, new Date().toISOString());
}

export function getHistoryAgeDays(ticker) {
  const dateStr = localStorage.getItem(`history_date_${ticker}`);
  if (!dateStr) return 999;
  const diffTime = Math.abs(new Date() - new Date(dateStr));
  return diffTime / (1000 * 60 * 60 * 24);
}

export function simulateBenchmark(transactions, vooHistory, currentVooPrice, usdRate = 1, dlrCadHistory = null, dlrUsdHistory = null) {
  let simulatedShares = 0;
  let simulatedCost = 0;

  // Process oldest to newest
  const sortedTxns = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedTxns.forEach(t => {
    let vooPriceOnDate = null;
    let dlrCadOnDate = null;
    let dlrUsdOnDate = null;
    let searchDate = new Date(t.date);

    for (let i = 0; i < 7; i++) {
        const dateStr = searchDate.toISOString().split('T')[0];
        if (!vooPriceOnDate && vooHistory && vooHistory[dateStr]) vooPriceOnDate = vooHistory[dateStr];
        if (!dlrCadOnDate && dlrCadHistory && dlrCadHistory[dateStr]) dlrCadOnDate = dlrCadHistory[dateStr];
        if (!dlrUsdOnDate && dlrUsdHistory && dlrUsdHistory[dateStr]) dlrUsdOnDate = dlrUsdHistory[dateStr];
        searchDate.setDate(searchDate.getDate() - 1);
    }
    
    const isCAD = t.ticker.endsWith('.TO') || t.ticker.endsWith('.V') || t.ticker.endsWith('.NE');
    let historicalUsdRate = usdRate; // default to today's live rate if histories fail somehow

    if (isCAD && dlrCadOnDate > 0 && dlrUsdOnDate > 0) {
        historicalUsdRate = dlrUsdOnDate / dlrCadOnDate;
    }
    
    const conversionRate = isCAD ? historicalUsdRate : 1;
    const dollarAmount = t.qty * t.price * conversionRate;
    
    // Fallback if not found (e.g. data missing)
    if (!vooPriceOnDate) vooPriceOnDate = currentVooPrice;
    
    if (vooPriceOnDate > 0) {
        if (t.type === 'BUY') {
            const sharesBought = dollarAmount / vooPriceOnDate;
            simulatedShares += sharesBought;
            simulatedCost += dollarAmount;
        } else if (t.type === 'SELL') {
            const avgCost = simulatedShares > 0 ? simulatedCost / simulatedShares : 0;
            const sharesSold = dollarAmount / vooPriceOnDate;
            simulatedShares -= sharesSold;
            simulatedCost -= (avgCost * sharesSold);
        }
    }
  });

  const value = simulatedShares * currentVooPrice;
  return {
    shares: simulatedShares,
    cost: simulatedCost,
    value: value,
    returnVal: value - simulatedCost
  };
}
