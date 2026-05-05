const API_BASE = "/api/stock";

const elements = {
    tickerInput: document.getElementById('tickerInput'),
    searchBtn: document.getElementById('searchBtn'),
    autocompleteResults: document.getElementById('autocompleteResults'),
    loader: document.getElementById('loader'),
    dashboard: document.getElementById('fund-dashboard'),
    tickerName: document.getElementById('tickerName'),
    currentPrice: document.getElementById('currentPrice'),
    valuationCards: document.getElementById('valuationCards'),
    metricsGrid: document.getElementById('metricsGrid'),
    statementSelect: document.getElementById('statementSelect'),
    statementTableContainer: document.getElementById('statementTableContainer'),
    tabBtns: document.querySelectorAll('.fund-tab-btn'),
    tabContents: document.querySelectorAll('.fund-tab-content'),
    // Valuation Model Elements
    peAvgField: document.getElementById('peAvgField'),
    ttmEpsField: document.getElementById('ttmEpsField'),
    growthRateInput: document.getElementById('growthRateInput'),
    discountRateInput: document.getElementById('discountRateInput'),
    futurePriceTarget: document.getElementById('futurePriceTarget'),
    currentValueTarget: document.getElementById('currentValueTarget'),
    valueCmpRatio: document.getElementById('valueCmpRatio'),
    // Sub tabs
    subTabBtns: document.querySelectorAll('.sub-tab-btn'),
    subTabContents: document.querySelectorAll('.sub-tab-content'),
    // DCF Model Elements
    dcfBaseFcfField: document.getElementById('dcfBaseFcfField'),
    dcfNetDebtField: document.getElementById('dcfNetDebtField'),
    dcfTermGrowthInput: document.getElementById('dcfTermGrowthInput'),
    dcfGrowthRateInput: document.getElementById('dcfGrowthRateInput'),
    dcfDiscountRateInput: document.getElementById('dcfDiscountRateInput'),
    dcfValuePerShare: document.getElementById('dcfValuePerShare'),
    dcfValueCmpRatio: document.getElementById('dcfValueCmpRatio'),
    // Export Elements
    exportTickerLabel: document.getElementById('exportTickerLabel'),
    downloadExcelBtn: document.getElementById('downloadExcelBtn'),
    templateFileInput: document.getElementById('templateFileInput'),
    uploadTemplateBtn: document.getElementById('uploadTemplateBtn'),
    uploadStatus: document.getElementById('uploadStatus')
};

let currentData = null;

// Event Listeners
elements.searchBtn.addEventListener('click', handleSearch);
elements.tickerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.autocompleteResults.style.display = 'none';
        handleSearch();
    }
});

let searchTimeout = null;
elements.tickerInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (!q) {
        elements.autocompleteResults.style.display = 'none';
        return;
    }
    
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            
            if (data.result && data.result.length > 0) {
                elements.autocompleteResults.innerHTML = data.result.map(item => `
                    <div class="autocomplete-item" data-symbol="${item.symbol}">
                        <span class="autocomplete-symbol">${item.symbol}</span>
                        <span class="autocomplete-name">${item.name}</span>
                    </div>
                `).join('');
                elements.autocompleteResults.style.display = 'block';
                
                // Add click handlers
                const items = elements.autocompleteResults.querySelectorAll('.autocomplete-item');
                items.forEach(item => {
                    item.addEventListener('click', () => {
                        elements.tickerInput.value = item.dataset.symbol;
                        elements.autocompleteResults.style.display = 'none';
                        handleSearch();
                    });
                });
            } else {
                elements.autocompleteResults.style.display = 'none';
            }
        } catch (err) {
            console.error("Autocomplete error", err);
        }
    }, 300);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        elements.autocompleteResults.style.display = 'none';
    }
});

elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.tabBtns.forEach(b => b.classList.remove('active'));
        elements.tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

elements.subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.subTabBtns.forEach(b => b.classList.remove('active'));
        elements.subTabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

elements.statementSelect.addEventListener('change', (e) => {
    if (currentData) {
        renderStatementTable(e.target.value);
    }
});

// Valuation Model Auto-Compute
elements.growthRateInput.addEventListener('input', calculatePEModel);
elements.discountRateInput.addEventListener('input', calculatePEModel);

elements.dcfTermGrowthInput.addEventListener('input', calculateDCFModel);
elements.dcfGrowthRateInput.addEventListener('input', calculateDCFModel);
elements.dcfDiscountRateInput.addEventListener('input', calculateDCFModel);

// Export Tab Listeners
elements.downloadExcelBtn.addEventListener('click', () => {
    if (!currentData || !currentData.ticker) {
        alert("Please search for a stock first.");
        return;
    }
    window.location.href = `${API_BASE}/${currentData.ticker}/export`;
});

elements.uploadTemplateBtn.addEventListener('click', async () => {
    const file = elements.templateFileInput.files[0];
    if (!file) {
        elements.uploadStatus.textContent = "Please select a file first.";
        elements.uploadStatus.style.color = "var(--negative)";
        elements.uploadStatus.classList.remove('hidden');
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        elements.uploadStatus.textContent = "Uploading...";
        elements.uploadStatus.style.color = "var(--text-secondary)";
        elements.uploadStatus.classList.remove('hidden');

        const response = await fetch("/api/template/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Upload failed.");
        
        elements.uploadStatus.textContent = "Template uploaded successfully! Future downloads will use this template.";
        elements.uploadStatus.style.color = "var(--positive)";
        elements.templateFileInput.value = ""; // Clear input
    } catch (err) {
        elements.uploadStatus.textContent = err.message;
        elements.uploadStatus.style.color = "var(--negative)";
    }
});

// Formatters
const formatVal = (val, key) => {
    if (val === null || val === undefined || val === "-") return "-";
    if (val === "N/A") return val;
    
    if (key.toLowerCase().includes('dilution')) {
        const perc = val * 100;
        return {
            text: `${perc.toFixed(2)}%`,
            class: perc > 0 ? 'val-negative' : (perc < 0 ? 'val-positive' : '')
        };
    }
    
    if (key.toLowerCase().includes('return')) {
         const perc = val * 100;
         let cl = '';
         if (perc > 15) cl = 'val-positive';
         else if (perc < 0) cl = 'val-negative';
         return { text: `${perc.toFixed(2)}%`, class: cl };
    }

    const isGrowthOrMargin = key.toLowerCase().includes('growth') || key.toLowerCase().includes('margin') || key.toLowerCase().includes('yoy') || key === 'CFO / Net Profit';
    
    if (isGrowthOrMargin) {
        const perc = val * 100;
        return {
            text: `${perc.toFixed(2)}%`,
            class: perc > 0 ? 'val-positive' : (perc < 0 ? 'val-negative' : '')
        };
    }
    
    // Large numbers
    if (Math.abs(val) >= 1e9) {
        return { text: `$${(val / 1e9).toFixed(2)}B`, class: '' };
    }
    if (Math.abs(val) >= 1e6) {
        return { text: `$${(val / 1e6).toFixed(2)}M`, class: '' };
    }
    
    // Regular numbers/ratios
    // Ratios like P/E, Debt/Equity
    if (key.toLowerCase().includes('ratio') || key.toLowerCase().includes('equity') || key.toLowerCase().includes('ev/ebitda') || key.toLowerCase().includes('peg') || key.toLowerCase().includes('price to') || key.toLowerCase().includes('price /')) {
        return { text: val.toFixed(2), class: '' };
    }
    
    // per share amounts
    if (key.toLowerCase().includes('share') || key.toLowerCase().includes('eps') || key.toLowerCase().includes('bvps')) {
        return { text: `$${val.toFixed(2)}`, class: '' };
    }
    
    return { text: val.toLocaleString(undefined, { maximumFractionDigits: 2 }), class: '' };
};

async function handleSearch() {
    const ticker = elements.tickerInput.value.trim().toUpperCase();
    if (!ticker) return;

    elements.autocompleteResults.style.display = 'none';

    // Show loading
    elements.dashboard.classList.add('hidden');
    elements.loader.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE}/${ticker}`);
        if (!response.ok) throw new Error("Ticker not found or API error");
        
        const data = await response.json();
        currentData = data;
        
        renderDashboard(data);
    } catch (err) {
        alert(err.message);
    } finally {
        elements.loader.classList.add('hidden');
    }
}

function renderDashboard(data) {
    elements.tickerName.textContent = data.name ? `${data.ticker} - ${data.name}` : data.ticker;
    elements.currentPrice.textContent = `$${data.current_price.toFixed(2)}`;
    
    renderValuationCards(data.valuation);
    renderMetrics(data.metrics, data.dates);
    renderStatementTable(elements.statementSelect.value);
    initValuationModels(data);
    
    if (elements.exportTickerLabel) {
        elements.exportTickerLabel.textContent = data.ticker;
    }
    
    elements.dashboard.classList.remove('hidden');
}

function initValuationModels(data) {
    // P/E Model Init
    const avgPe = data.valuation["Average 5Y P/E"];
    const ttmEps = data.model_params.ttm_eps;
    const avg3yGrowth = data.model_params.avg_3y_sales_growth * 100;
    
    elements.peAvgField.value = avgPe !== "-" ? avgPe.toFixed(2) : "N/A";
    elements.ttmEpsField.value = ttmEps ? ttmEps.toFixed(2) : "0.00";
    elements.growthRateInput.value = avg3yGrowth ? avg3yGrowth.toFixed(2) : "0.00";
    
    // DCF Model Init
    const recentDate = data.dates[0];
    
    const ocf = data.financials.cash_flow["Operating Cash Flow"]?.[recentDate] || 0;
    const capex = data.financials.cash_flow["Capital Expenditure"]?.[recentDate] || 0;
    const baseFcf = ocf - Math.abs(capex);
    
    const totalDebt = data.financials.balance_sheet["Total Debt"]?.[recentDate] || 0;
    const cash = data.financials.balance_sheet["Cash And Cash Equivalents"]?.[recentDate] || 0;
    const netDebt = totalDebt - cash;

    // Display formatted (in millions for readability)
    elements.dcfBaseFcfField.dataset.rawFcf = baseFcf;
    elements.dcfNetDebtField.dataset.rawDebt = netDebt;
    
    elements.dcfBaseFcfField.value = `$${(baseFcf / 1e6).toFixed(2)} M`;
    elements.dcfNetDebtField.value = `$${(netDebt / 1e6).toFixed(2)} M`;
    
    elements.dcfGrowthRateInput.value = avg3yGrowth ? avg3yGrowth.toFixed(2) : "0.00";

    calculatePEModel();
    calculateDCFModel();
}

function calculatePEModel() {
    if (!currentData) return;
    
    const peAvgStr = elements.peAvgField.value;
    if (peAvgStr === "N/A" || peAvgStr === "-") {
        elements.futurePriceTarget.textContent = "N/A";
        elements.currentValueTarget.textContent = "N/A";
        elements.valueCmpRatio.textContent = "N/A";
        elements.valueCmpRatio.style.color = "var(--text-primary)";
        return;
    }
    
    const peAvg = parseFloat(peAvgStr);
    const ttmEps = parseFloat(elements.ttmEpsField.value);
    const growthRate = parseFloat(elements.growthRateInput.value) / 100;
    const discountRate = parseFloat(elements.discountRateInput.value) / 100;
    
    const futureEps = ttmEps * Math.pow(1 + growthRate, 5);
    const futurePrice = futureEps * peAvg;
    const currentValue = futurePrice / Math.pow(1 + discountRate, 5);
    const cmp = currentData.current_price;
    const ratio = currentValue / cmp;
    
    elements.futurePriceTarget.textContent = `$${futurePrice.toFixed(2)}`;
    elements.currentValueTarget.textContent = `$${currentValue.toFixed(2)}`;
    
    elements.valueCmpRatio.textContent = ratio.toFixed(2);
    elements.valueCmpRatio.style.color = ratio > 1 ? 'var(--positive)' : 'var(--negative)';
}

function calculateDCFModel() {
    if (!currentData) return;

    const baseFcf = parseFloat(elements.dcfBaseFcfField.dataset.rawFcf) || 0;
    const netDebt = parseFloat(elements.dcfNetDebtField.dataset.rawDebt) || 0;
    
    let currentGr = parseFloat(elements.dcfGrowthRateInput.value) / 100;
    const termGr = parseFloat(elements.dcfTermGrowthInput.value) / 100;
    const discRate = parseFloat(elements.dcfDiscountRateInput.value) / 100;
    
    let sumPvFcf = 0;
    let prevFcf = baseFcf;

    // Years 1-10
    for (let i = 1; i <= 10; i++) {
        const yearFcf = prevFcf * (1 + currentGr);
        const pvFcf = yearFcf / Math.pow(1 + discRate, i);
        sumPvFcf += pvFcf;
        
        prevFcf = yearFcf;
        // Decay growth rate by 3% each year
        currentGr = currentGr * 0.97;
    }

    // Terminal Value
    // FCF_10 is prevFcf
    const terminalValue = (prevFcf * (1 + termGr) / (discRate - termGr));
    const pvTerminalValue = terminalValue / Math.pow(1 + discRate, 10);
    
    const totalPv = sumPvFcf + pvTerminalValue;
    
    // Equity Value = PV - Net Debt
    const equityValue = totalPv - netDebt;
    
    // Shares Out
    const recentDate = currentData.dates[0];
    let sharesOut = currentData.financials.balance_sheet["Ordinary Shares Number"]?.[recentDate] || 
                    currentData.financials.balance_sheet["Share Issued"]?.[recentDate] || 1;
    
    const dcfPerShare = equityValue / sharesOut;
    const cmp = currentData.current_price;
    const ratio = dcfPerShare / cmp;
    
    elements.dcfValuePerShare.textContent = `$${dcfPerShare.toFixed(2)}`;
    elements.dcfValueCmpRatio.textContent = ratio.toFixed(2);
    elements.dcfValueCmpRatio.style.color = ratio > 1 ? 'var(--positive)' : 'var(--negative)';
}

function renderValuationCards(valuation) {
    elements.valuationCards.innerHTML = '';
    for (const [key, val] of Object.entries(valuation)) {
        const formatted = val === 0 ? "-" : val.toFixed(2);
        const card = document.createElement('div');
        card.className = 'val-card';
        card.innerHTML = `
            <div class="val-title">${key}</div>
            <div class="val-val">${formatted}</div>
        `;
        elements.valuationCards.appendChild(card);
    }
}

function renderMetrics(metricsData, allDates) {
    elements.metricsGrid.innerHTML = '';
    
    // Exclude 'year' from categories
    const categories = Object.keys(metricsData[0]).filter(k => k !== 'year');
    
    // Note: metricsData is an array of years. We want columns to be Years, rows to be metrics.
    // metricsData is descending order [2024, 2023, 2022, 2021]
    
    const displayDates = metricsData.map(m => m.year);
    
    categories.forEach(category => {
        const section = document.createElement('div');
        section.className = 'metrics-section';
        
        let html = `<h3>${category}</h3><table><thead><tr><th>Metric</th>`;
        displayDates.forEach(date => {
            html += `<th>${date}</th>`;
        });
        html += `</tr></thead><tbody>`;
        
        // Get keys for this category from the first year
        const metricKeys = Object.keys(metricsData[0][category]);
        
        metricKeys.forEach(metricKey => {
            html += `<tr><td class="row-label">${metricKey}</td>`;
            
            displayDates.forEach((_, i) => {
                const rawVal = metricsData[i][category][metricKey];
                const formatted = formatVal(rawVal, metricKey);
                html += `<td class="${formatted.class}">${formatted.text}</td>`;
            });
            
            html += `</tr>`;
        });
        
        html += `</tbody></table>`;
        section.innerHTML = html;
        elements.metricsGrid.appendChild(section);
    });
}

function renderStatementTable(type) {
    if (!currentData || !currentData.financials[type]) return;
    
    const statement = currentData.financials[type];
    const dates = currentData.dates; // All available dates (up to 5)
    
    let html = `<table><thead><tr><th>Line Item</th>`;
    dates.forEach(d => { html += `<th>${d}</th>`; });
    html += `</tr></thead><tbody>`;
    
    for (const [rowName, rowVals] of Object.entries(statement)) {
        html += `<tr><td class="row-label">${rowName}</td>`;
        dates.forEach(d => {
            const val = rowVals[d];
            let text = "-";
            if (val !== null && val !== undefined) {
                // Formatting statement values
                if (Math.abs(val) >= 1e9) {
                    text = `${(val / 1e9).toFixed(2)}B`;
                } else if (Math.abs(val) >= 1e6) {
                    text = `${(val / 1e6).toFixed(2)}M`;
                } else {
                    text = val.toLocaleString();
                }
            }
            html += `<td>${text}</td>`;
        });
        html += `</tr>`;
    }
    
    html += `</tbody></table>`;
    elements.statementTableContainer.innerHTML = html;
}
