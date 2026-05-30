// app.js
import { getTransactions, saveTransaction, deleteTransaction, getTransactionById, updateTransaction, getHoldings, simulateBenchmark, deleteAllTransactions, getCachedHistory, saveCachedHistory, getHistoryAgeDays, importTransactions, supabase } from './storage.js';
import { fetchQuotes, fetchHistory } from './api.js';
import { xirr } from './math.js';

// DOM Elements
const addTxnBtn = document.getElementById('add-transaction-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');
const importCsvBtn = document.getElementById('import-csv-btn');
const csvUploadInput = document.getElementById('csv-upload-input');
const txnModal = document.getElementById('transaction-modal');
const navTabs = document.querySelectorAll('.nav-tab');
const closeBtns = document.querySelectorAll('[data-close]');
const txnForm = document.getElementById('transaction-form');

let portfolioChart = null;
let currentChartType = 'asset';
let currentEnrichedHoldings = [];
let currentTransactions = [];
let currentUsdRate = 1;
let currentLivePrices = {};

const historyBody = document.getElementById('history-body');
const holdingsBody = document.getElementById('holdings-body');

const SAMPLE_PORTFOLIO = [
  { type: 'BUY', ticker: 'AAPL', date: '2022-01-15', qty: 50, price: 150, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'MSFT', date: '2022-02-10', qty: 30, price: 280, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'NFLX', date: '2022-03-05', qty: 25, price: 350, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'DUOL', date: '2022-04-20', qty: 80, price: 90, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'CHWY', date: '2022-05-15', qty: 100, price: 40, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'DHR', date: '2022-06-10', qty: 40, price: 250, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'DKNG', date: '2022-07-05', qty: 150, price: 20, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'JPM', date: '2022-08-15', qty: 60, price: 120, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'PEP', date: '2022-09-10', qty: 45, price: 160, account: 'Sample', notes: 'Sample Transaction' },
  { type: 'BUY', ticker: 'KO', date: '2022-10-05', qty: 80, price: 55, account: 'Sample', notes: 'Sample Transaction' }
];

let isAuthenticated = false;

const overviewTotalValue = document.getElementById('overview-total-value');
const overviewTotalCost = document.getElementById('overview-total-cost');
const overviewTotalReturn = document.getElementById('overview-total-return');
const overviewReturnPct = document.getElementById('overview-return-pct');
const overviewVooValue = document.getElementById('overview-voo-value');
const overviewVooDiff = document.getElementById('overview-voo-diff');

// Formatting Helpers
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatPct = (val) => new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);

// Initialize app
async function init() {
  bindEvents();
  await renderHistory();
  await renderDashboard();
  
  const authBtn = document.getElementById('auth-btn');
  const aboutLoginBtn = document.getElementById('about-login-btn');

  if (authBtn) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      isAuthenticated = true;
      const name = data.session.user.user_metadata?.full_name || data.session.user.email || 'User';
      // Use just the first name if available
      const firstName = name.split(' ')[0];
      authBtn.textContent = `Logout (${firstName})`;
    } else {
      isAuthenticated = false;
    }
    
    // Always render with auth state context
    await renderHistory();
    await renderDashboard();
    renderHomePieChart();
    
    authBtn.addEventListener('click', async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        await supabase.auth.signOut();
        isAuthenticated = false;
        authBtn.textContent = 'Login';
        await renderHistory();
        await renderDashboard();
        // Route back to About upon logout
        document.querySelector('[data-target="about-view"]')?.click();
      } else {
        document.getElementById('auth-modal').classList.remove('hidden');
      }
    });
  }

  // Bind the big Get Started button on the About page
  if (aboutLoginBtn) {
    aboutLoginBtn.addEventListener('click', () => {
      document.getElementById('auth-modal').classList.remove('hidden');
    });
  }
}

// Modals Setup
function openModal(modal) {
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  modal.classList.add('hidden');
}

function bindEvents() {
  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (e.target.id === 'auth-btn') return; // Auth button handled separately
      
      const isSubTab = e.target.classList.contains('sub-tab-btn');
      const tabsGroup = isSubTab ? e.target.closest('.sub-tabs').querySelectorAll('.sub-tab-btn') : navTabs;
      
      tabsGroup.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      
      const targetId = e.target.getAttribute('data-target');
      if (!targetId) return;

      if (isSubTab) {
          const parentView = e.target.closest('.view-section');
          parentView.querySelectorAll('.sub-tab-content').forEach(v => v.classList.add('hidden'));
          const targetContent = document.getElementById(targetId);
          if (targetContent) {
              targetContent.classList.remove('hidden');
              targetContent.classList.add('active');
          }
      } else {
          document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
          if (document.getElementById(targetId)) {
            document.getElementById(targetId).classList.remove('hidden');
          }
      }
    });
  });

  addTxnBtn.addEventListener('click', () => {
    txnForm.reset();
    document.getElementById('txn-id').value = '';
    document.getElementById('transaction-modal-title').textContent = 'Add Transaction';
    document.getElementById('txn-date').valueAsDate = new Date();
    openModal(txnModal);
  });
  
  deleteAllBtn.addEventListener('click', async () => {
    if (confirm("Are you incredibly sure you want to delete EVERY transaction? This cannot be undone!")) {
      await deleteAllTransactions();
      await renderHistory();
      await renderDashboard();
    }
  });
  importCsvBtn.addEventListener('click', () => csvUploadInput.click());
  
  csvUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n|\r/);
      let importCount = 0;
      let failedLines = [];
      let newTxns = [];
      
      // Assumes row 0 is headers: Date,Type,Ticker,Quantity,Price
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Smart split that ignores commas inside quotes (handles "1,000.00")
        const colsMatches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
        const cols = colsMatches ? colsMatches.map(c => c.replace(/^"|"$/g, '').trim()) : line.split(',').map(c => c.trim());
        
        if (cols.length >= 5) {
          const rawDate = cols[0];
          const account = cols[5] ? cols[5].trim() : '';
          const notes = cols[6] ? cols[6].trim() : '';
          let dateObj = new Date(rawDate);
          
          if (isNaN(dateObj.getTime())) {
            // Attempt to parse Euro/regional DD-MM-YYYY
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
                dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
          }

          if (isNaN(dateObj.getTime())) {
            failedLines.push(`Row ${i+1}: Invalid Date (${rawDate})`);
            continue; 
          }
          
          const date = dateObj.toISOString().split('T')[0]; 
          const type = cols[1].toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
          const ticker = cols[2].toUpperCase();
          
          // Remove internal commas from quantities or prices string outputs
          const rawQty = cols[3].replace(/,/g, '');
          const rawPrice = cols[4].replace(/,/g, '');
          
          const qty = parseFloat(rawQty);
          const price = parseFloat(rawPrice);
          
          if (!ticker) {
              failedLines.push(`Row ${i+1}: Missing Ticker Symbol`);
          } else if (isNaN(qty) || qty <= 0) {
              failedLines.push(`Row ${i+1}: Invalid Quantity (${cols[3]})`);
          } else if (isNaN(price) || price < 0) {
              failedLines.push(`Row ${i+1}: Invalid Price (${cols[4]})`);
          } else {
            const uniqueId = Date.now().toString() + "-" + i;
            importCount++;
            newTxns.push({ type, ticker, date, qty, price, account, notes });
          }
        } else {
            failedLines.push(`Row ${i+1}: Missing columns. Found ${cols.length}, expected 5`);
        }
      }
      
      if (failedLines.length > 0) {
        alert(`Imported ${importCount} transactions.\nFailed on ${failedLines.length} rows:\n\n${failedLines.slice(0, 10).join('\n')}${failedLines.length > 10 ? '\n...and more' : ''}`);
      } else if (importCount > 0) {
        alert(`Successfully imported ${importCount} transactions!`);
      } else {
        alert("No valid transactions found in CSV. Please ensure you are using the precise template format: Date,Type,Ticker,Quantity,Price");
      }
      
      if (importCount > 0) {
        if (newTxns.length > 0) {
            await importTransactions(newTxns);
        }
        await renderHistory();
        await renderDashboard();
      }
    } catch(err) {
      alert("Failed to parse CSV file.");
      console.error(err);
    }
    
    // Clear the input so you can re-upload if needed
    e.target.value = '';
  });

  closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.currentTarget.getAttribute('data-close');
      closeModal(document.getElementById(modalId));
    });
  });

  txnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('txn-type').value;
    const ticker = document.getElementById('txn-ticker').value.toUpperCase().trim();
    const date = document.getElementById('txn-date').value;
    const qty = parseFloat(document.getElementById('txn-qty').value);
    const price = parseFloat(document.getElementById('txn-price').value);
    const account = document.getElementById('txn-account').value.trim();
    const notes = document.getElementById('txn-notes').value.trim();

    const id = document.getElementById('txn-id').value;
    
    const txnData = { type, ticker, date, qty, price, account, notes };
    
    if (id) {
       txnData.id = id;
       await updateTransaction(txnData);
    } else {
       await saveTransaction(txnData);
    }
    
    closeModal(txnModal);
    
    await renderHistory();
    await renderDashboard();
  });
  
  // Delegate edit/delete actions
  historyBody.addEventListener('click', async (e) => {
    if (e.target.closest('.delete-txn-btn')) {
      const id = e.target.closest('.delete-txn-btn').getAttribute('data-id');
      if (confirm('Are you sure you want to delete this transaction?')) {
        await deleteTransaction(id);
        await renderHistory();
        await renderDashboard();
      }
    } else if (e.target.closest('.edit-txn-btn')) {
      const id = e.target.closest('.edit-txn-btn').getAttribute('data-id');
      const txn = await getTransactionById(id);
      if (txn) {
        document.getElementById('txn-id').value = txn.id;
        document.getElementById('txn-type').value = txn.type;
        document.getElementById('txn-ticker').value = txn.ticker;
        document.getElementById('txn-date').value = txn.date;
        document.getElementById('txn-qty').value = txn.qty;
        document.getElementById('txn-price').value = txn.price;
        document.getElementById('txn-account').value = txn.account || '';
        document.getElementById('txn-notes').value = txn.notes || '';
        document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
        openModal(txnModal);
      }
    }
  });

  const authError = document.getElementById('auth-error');
  const authGoogleBtn = document.getElementById('auth-google-btn');

  if (authGoogleBtn) {
    authGoogleBtn.addEventListener('click', async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        authError.style.color = '#ef4444';
        authError.textContent = error.message;
        authError.style.display = 'block';
      }
    });
  }

  const chartSelector = document.getElementById('chart-type-selector');
  if (chartSelector) {
    chartSelector.addEventListener('change', (e) => {
      currentChartType = e.target.value;
      renderPieChart(currentEnrichedHoldings, currentTransactions, currentUsdRate, currentLivePrices);
    });
  }
}

async function renderHistory() {
  let transactions = await getTransactions();
  if (!isAuthenticated && transactions.length === 0) {
      transactions = SAMPLE_PORTFOLIO;
  }
  
  if (transactions.length === 0) {
    historyBody.innerHTML = '<tr class="empty-state"><td colspan="9">No transactions found. Add one above.</td></tr>';
    return;
  }

  historyBody.innerHTML = transactions.map(t => {
    const total = t.qty * t.price;
    const typeClass = t.type === 'BUY' ? 'text-positive' : 'text-negative';
    return `
      <tr>
        <td>${t.date}</td>
        <td class="${typeClass} font-bold">${t.type}</td>
        <td><span class="ticker-badge">${t.ticker}</span></td>
        <td>${t.qty}</td>
        <td>${formatCurrency(t.price)}</td>
        <td>${formatCurrency(total)}</td>
        <td>${t.account || '-'}</td>
        <td><span title="${t.notes || ''}" style="max-width: 150px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.notes || '-'}</span></td>
        <td>
          <button class="btn small secondary edit-txn-btn" data-id="${t.id}">Edit</button>
          <button class="btn small danger delete-txn-btn" data-id="${t.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function renderDashboard() {
  let transactions = await getTransactions();
  if (!isAuthenticated && transactions.length === 0) {
      transactions = SAMPLE_PORTFOLIO;
  }
  const holdings = getHoldings(transactions);
  
  if (holdings.length === 0) {
    holdingsBody.innerHTML = '<tr class="empty-state"><td colspan="10">No holdings yet. Add a transaction to get started.</td></tr>';
    overviewTotalValue.textContent = '---';
    overviewTotalCost.textContent = '---';
    overviewTotalReturn.textContent = '---';
    overviewTotalReturn.className = 'stat-value';
    overviewReturnPct.textContent = '0.00%';
    overviewReturnPct.className = 'stat-badge';
    if (overviewVooValue) overviewVooValue.textContent = '---';
    if (overviewVooDiff) {
       overviewVooDiff.textContent = '---';
       overviewVooDiff.className = 'stat-badge';
    }
    return;
  }

  // Fetch Live Prices
  const tickers = holdings.map(h => h.ticker);
  
  const fetchTickers = Array.from(new Set([...tickers, 'VOO', 'DLR.TO', 'DLR-U.TO']));
  const livePrices = await fetchQuotes(fetchTickers); // Map of ticker -> { price, change, changesPercentage }

  // Extract Live Exchange Rate
  const dlrCad = livePrices['DLR.TO']?.price || 13.89; // Safe default fallback
  const dlrUsd = livePrices['DLR-U.TO']?.price || 10.14; 
  const usdRate = dlrUsd / dlrCad; 

  const enrichedHoldings = holdings.map(h => {
    const isCAD = h.ticker.endsWith('.TO') || h.ticker.endsWith('.V') || h.ticker.endsWith('.NE');
    const conversionRate = isCAD ? usdRate : 1;

    const nativeAvgCost = h.totalCost / h.shares;
    const currentPriceData = livePrices[h.ticker];
    
    // Fallbacks if price is missing
    const nativeCurrentPrice = currentPriceData?.price || 0;
    const dailyChangePct = currentPriceData?.changesPercentage || 0;
    const industry = currentPriceData?.industry || 'N/A';
    const marketCap = currentPriceData?.marketCap || 0;
    const name = currentPriceData?.name || '';

    let marketCapCat = 'N/A';
    if (marketCap > 0) {
        if (marketCap >= 10000000000) marketCapCat = 'Large Cap';
        else if (marketCap >= 2000000000) marketCapCat = 'Mid Cap';
        else if (marketCap >= 300000000) marketCapCat = 'Small Cap';
        else marketCapCat = 'Micro Cap';
    }

    const usdTotalCost = h.totalCost * conversionRate;
    const usdTotalValue = (h.shares * nativeCurrentPrice) * conversionRate;
    const returnVal = usdTotalValue - usdTotalCost;
    const returnPct = usdTotalCost > 0 ? (returnVal / usdTotalCost) * 100 : 0;
    
    return {
        ...h,
        isCAD,
        nativeAvgCost,
        nativeCurrentPrice,
        dailyChangePct,
        industry,
        marketCapCat,
        usdTotalCost,
        usdTotalValue,
        returnVal,
        returnPct,
        name
    };
  });

  // Sort Descending by Total USD Value
  enrichedHoldings.sort((a, b) => b.usdTotalValue - a.usdTotalValue);

  let sumCost = 0;
  let sumValue = 0;

  const rowsHtml = enrichedHoldings.map(h => {
    sumCost += h.usdTotalCost;
    sumValue += h.nativeCurrentPrice > 0 ? h.usdTotalValue : h.usdTotalCost; // if no prices, fallback to cost so it doesn't drop to 0

    const returnClass = h.returnVal >= 0 ? 'text-positive' : 'text-negative';
    const fmtNative = (val) => h.isCAD ? `C$${val.toFixed(2)}` : formatCurrency(val);
    
    return `
      <tr>
        <td>
          <span class="ticker-badge">${h.ticker}</span>
          ${h.name ? `<span style="display:block; font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${h.name}</span>` : ''}
        </td>
        <td><span style="font-size: 0.85rem; color: var(--text-muted);">${h.industry}</span></td>
        <td><span style="font-size: 0.85rem; color: var(--text-muted);">${h.marketCapCat}</span></td>
        <td>${h.shares.toFixed(4).replace(/\.?0+$/, '')}</td>
        <td>${fmtNative(h.nativeAvgCost)}</td>
        <td>
           ${h.nativeCurrentPrice > 0 ? fmtNative(h.nativeCurrentPrice) : '---'}
           ${h.dailyChangePct !== 0 && h.nativeCurrentPrice > 0 ? `<br><small class="${h.dailyChangePct >= 0 ? 'text-positive' : 'text-negative'}">${h.dailyChangePct >= 0 ? '+' : ''}${h.dailyChangePct.toFixed(2)}% Today</small>` : ''}
        </td>
        <td>${formatCurrency(h.usdTotalCost)}</td>
        <td>${h.nativeCurrentPrice > 0 ? formatCurrency(h.usdTotalValue) : '---'}</td>
        <td class="${returnClass}">${h.nativeCurrentPrice > 0 ? (h.returnVal >= 0 ? '+' : '') + formatCurrency(h.returnVal) : '---'}</td>
        <td class="${returnClass}">${h.nativeCurrentPrice > 0 ? (h.returnPct >= 0 ? '+' : '') + formatPct(h.returnPct) : '---'}</td>
      </tr>
    `;
  }).join('');

  holdingsBody.innerHTML = rowsHtml;
  
  currentEnrichedHoldings = enrichedHoldings;
  currentTransactions = transactions;
  currentUsdRate = usdRate;
  currentLivePrices = livePrices;

  // Render analytical pie chart
  renderPieChart(currentEnrichedHoldings, currentTransactions, currentUsdRate, currentLivePrices);

  // History Loads
  let vooHistory = getCachedHistory('VOO');
  if (!vooHistory || getHistoryAgeDays('VOO') > 1) {
    const newHistory = await fetchHistory('VOO');
    if (newHistory) {
      vooHistory = newHistory;
      saveCachedHistory('VOO', vooHistory);
    }
  }

  let dlrCadHistory = getCachedHistory('DLR.TO');
  if (!dlrCadHistory || getHistoryAgeDays('DLR.TO') > 1) {
    const newHistory = await fetchHistory('DLR.TO');
    if (newHistory) {
      dlrCadHistory = newHistory;
      saveCachedHistory('DLR.TO', dlrCadHistory);
    }
  }

  let dlrUsdHistory = getCachedHistory('DLR-U.TO');
  if (!dlrUsdHistory || getHistoryAgeDays('DLR-U.TO') > 1) {
    const newHistory = await fetchHistory('DLR-U.TO');
    if (newHistory) {
      dlrUsdHistory = newHistory;
      saveCachedHistory('DLR-U.TO', dlrUsdHistory);
    }
  }

  const getHistoricalUsdRate = (txnDate, currentRate) => {
    let dateStr = null;
    let searchDate = new Date(txnDate);
    for (let i = 0; i < 7; i++) {
        dateStr = searchDate.toISOString().split('T')[0];
        if (dlrCadHistory && dlrUsdHistory && dlrCadHistory[dateStr] > 0 && dlrUsdHistory[dateStr] > 0) {
            return dlrUsdHistory[dateStr] / dlrCadHistory[dateStr];
        }
        searchDate.setDate(searchDate.getDate() - 1);
    }
    return currentRate;
  };
  
  // Calculate Portfolio IRR
  const portfolioCashflows = transactions.map(t => {
    const isCAD = t.ticker.endsWith('.TO') || t.ticker.endsWith('.V') || t.ticker.endsWith('.NE');
    const conversionRate = isCAD ? getHistoricalUsdRate(t.date, usdRate) : 1;
    const usdScaledFlow = t.qty * t.price * conversionRate;
    return {
      amount: t.type === 'BUY' ? -usdScaledFlow : usdScaledFlow,
      date: new Date(t.date).getTime()
    };
  });
  if (sumValue > 0) {
    portfolioCashflows.push({ amount: sumValue, date: new Date().getTime() });
  }
  const portfolioIRR = xirr(portfolioCashflows);

  // Update Overview stats
  const totalReturnVal = sumValue - sumCost;

  overviewTotalValue.textContent = sumValue > 0 ? formatCurrency(sumValue) : '---';
  overviewTotalCost.textContent = formatCurrency(sumCost);
  
  overviewTotalReturn.textContent = `${totalReturnVal >= 0 ? '+' : ''}${formatCurrency(totalReturnVal)}`;
  overviewReturnPct.textContent = `${portfolioIRR >= 0 ? '+' : ''}${formatPct(portfolioIRR * 100)}`;
  
  // Set badge and text colors
  if (totalReturnVal >= 0) {
    overviewTotalReturn.className = 'stat-value text-positive';
    overviewReturnPct.className = 'stat-badge bg-positive';
  } else {
    overviewTotalReturn.className = 'stat-value text-negative';
    overviewReturnPct.className = 'stat-badge bg-negative';
  }

  let currentVooPrice = livePrices['VOO']?.price || 0;
  
  // Fallback: If live VOO quote missing, use the most recent historical close price
  if (currentVooPrice === 0 && vooHistory) {
      const dates = Object.keys(vooHistory).sort((a, b) => new Date(b) - new Date(a));
      if (dates.length > 0) {
          currentVooPrice = vooHistory[dates[0]];
      }
  }
  
  if (vooHistory && currentVooPrice > 0 && transactions.length > 0) {
    const vooSim = simulateBenchmark(transactions, vooHistory, currentVooPrice, usdRate, dlrCadHistory, dlrUsdHistory);
    
    if (overviewVooValue) {
      overviewVooValue.textContent = formatCurrency(vooSim.value);
    }
    
    if (overviewVooDiff) {
      const vooCashflows = transactions.map(t => {
        const isCAD = t.ticker.endsWith('.TO') || t.ticker.endsWith('.V') || t.ticker.endsWith('.NE');
        const conversionRate = isCAD ? getHistoricalUsdRate(t.date, usdRate) : 1;
        const usdScaledFlow = t.qty * t.price * conversionRate;
        return {
          amount: t.type === 'BUY' ? -usdScaledFlow : usdScaledFlow,
          date: new Date(t.date).getTime()
        };
      });
      if (vooSim.value > 0) {
        vooCashflows.push({ amount: vooSim.value, date: new Date().getTime() });
      }
      const vooIRR = xirr(vooCashflows);
      
      const outperformanceVal = sumValue - vooSim.value;
      const irrDiff = portfolioIRR - vooIRR;
      
      overviewVooDiff.textContent = `${vooIRR >= 0 ? '+' : ''}${formatPct(vooIRR * 100)} IRR (Diff: ${irrDiff >= 0 ? '+' : ''}${formatPct(irrDiff * 100)})`;
      overviewVooDiff.className = outperformanceVal >= 0 ? 'stat-badge bg-positive' : 'stat-badge bg-negative';
    }
  } else {
    // Debug logic for the user to understand what failed
    let reason = "Add transactions to begin";
    if (transactions.length > 0) {
      if (!vooHistory) reason = "Cannot fetch VOO history from Yahoo server";
      else if (currentVooPrice === 0) reason = "Live VOO Price missing";
      else reason = "Loading...";
    }
    
    if (overviewVooValue) {
      overviewVooValue.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">${reason}</span>`;
    }
    if (overviewVooDiff) {
       overviewVooDiff.textContent = '---';
       overviewVooDiff.className = 'stat-badge';
    }
  }
}

function renderPieChart(enrichedHoldings, transactions, usdRate, livePrices) {
  const chartCanvas = document.getElementById('portfolio-pie-chart');
  if (!chartCanvas) return;
  
  // Wipe old framework instances to prevent stuttering re-draws
  if (portfolioChart) {
    portfolioChart.destroy();
  }
  
  const ctx = chartCanvas.getContext('2d');
  const validHoldings = enrichedHoldings.filter(h => h.usdTotalValue > 0);
  
  if (validHoldings.length === 0) {
      return; // Skip rendering an empty chart implicitly
  }
  
  let labels = [];
  let data = [];
  
  if (currentChartType === 'asset') {
      labels = validHoldings.map(h => h.ticker);
      data = validHoldings.map(h => h.usdTotalValue);
  } else if (currentChartType === 'market-cap') {
      const groups = {};
      validHoldings.forEach(h => {
          groups[h.marketCapCat] = (groups[h.marketCapCat] || 0) + h.usdTotalValue;
      });
      labels = Object.keys(groups);
      data = Object.values(groups);
  } else if (currentChartType === 'industry') {
      const groups = {};
      validHoldings.forEach(h => {
          groups[h.industry] = (groups[h.industry] || 0) + h.usdTotalValue;
      });
      labels = Object.keys(groups);
      data = Object.values(groups);
  } else if (currentChartType === 'account') {
      const groups = {};
      transactions.forEach(t => {
          const accountName = t.account ? t.account : 'Unspecified Account';
          if (!groups[accountName]) {
              groups[accountName] = { shares: {} };
          }
          if (!groups[accountName].shares[t.ticker]) {
              groups[accountName].shares[t.ticker] = 0;
          }
          
          if (t.type === 'BUY') {
              groups[accountName].shares[t.ticker] += parseFloat(t.qty);
          } else if (t.type === 'SELL') {
              groups[accountName].shares[t.ticker] -= parseFloat(t.qty);
          }
      });
      
      const accountValues = {};
      Object.keys(groups).forEach(acc => {
          let totalUsdValue = 0;
          Object.keys(groups[acc].shares).forEach(ticker => {
              const shares = groups[acc].shares[ticker];
              if (shares > 0) {
                  const isCAD = ticker.endsWith('.TO') || ticker.endsWith('.V') || ticker.endsWith('.NE');
                  const conversionRate = isCAD ? usdRate : 1;
                  const price = livePrices[ticker]?.price || 0;
                  totalUsdValue += (shares * price * conversionRate);
              }
          });
          if (totalUsdValue > 0) {
              accountValues[acc] = totalUsdValue;
          }
      });
      
      labels = Object.keys(accountValues);
      data = Object.values(accountValues);
      
      if (labels.length === 0) return;
  }
  
  // Hand-curated glassmorphism thematic colors 
  const backgroundColors = [
    'rgba(96, 165, 250, 0.7)',  // Blue
    'rgba(167, 139, 250, 0.7)', // Purple
    'rgba(52, 211, 153, 0.7)',  // Green
    'rgba(248, 113, 113, 0.7)', // Red
    'rgba(251, 191, 36, 0.7)',  // Yellow
    'rgba(244, 114, 182, 0.7)', // Pink
    'rgba(45, 212, 191, 0.7)',  // Teal
    'rgba(163, 230, 53, 0.7)'   // Lime
  ];
  const borderColors = backgroundColors.map(c => c.replace('0.7', '1'));
  
  // Total mapping for tooltip computations
  const totalPortValue = data.reduce((a, b) => a + b, 0);

  portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e2e8f0', font: { family: 'inherit' } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const pct = ((value / totalPortValue) * 100).toFixed(2);
              return `${context.label}: ${formatCurrency(value)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderHomePieChart() {
  const ctx = document.getElementById('homePieChart')?.getContext('2d');
  if (!ctx) return;
  
  const labels = ['AAPL', 'MSFT', 'NFLX', 'DUOL', 'CHWY', 'DHR', 'DKNG', 'JPM', 'PEP', 'KO'];
  const data = [12, 12, 12, 10, 10, 10, 10, 10, 7, 7]; // Approximate sample weights

  const backgroundColors = [
    'rgba(96, 165, 250, 0.7)',  // Blue
    'rgba(167, 139, 250, 0.7)', // Purple
    'rgba(52, 211, 153, 0.7)',  // Green
    'rgba(248, 113, 113, 0.7)', // Red
    'rgba(251, 191, 36, 0.7)',  // Yellow
    'rgba(244, 114, 182, 0.7)', // Pink
    'rgba(45, 212, 191, 0.7)',  // Teal
    'rgba(163, 230, 53, 0.7)',  // Lime
    'rgba(96, 165, 250, 0.9)',  // Blue darker
    'rgba(167, 139, 250, 0.9)'  // Purple darker
  ];

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(c => c.replace('0.7', '1').replace('0.9', '1')),
        borderWidth: 1,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
