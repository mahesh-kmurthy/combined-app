export async function fetchQuotes(tickers) {
  if (!tickers || tickers.length === 0) return {};
  
  const queryParam = tickers.join(',');
  const url = `/api/quotes?tickers=${queryParam}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API responded with status ${response.status}`);
    const data = await response.json();
    
    // Yahoo format returns quoteResponse.result
    const priceMap = {};
    if (data.quoteResponse && data.quoteResponse.result) {
      data.quoteResponse.result.forEach(item => {
        priceMap[item.symbol] = {
          price: item.regularMarketPrice || 0,
          change: item.regularMarketChange || 0,
          changesPercentage: item.regularMarketChangePercent || 0,
          industry: item.industry || 'N/A',
          marketCap: item.marketCap || 0
        };
      });
    }
    return priceMap;
    
  } catch (error) {
    console.error("Error fetching stock quotes via proxy:", error);
    return {};
  }
}

export async function fetchHistory(ticker = 'VOO') {
  const url = `/api/history?ticker=${ticker}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API responded with status ${response.status}`);
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    
    if (!result.indicators || !result.indicators.quote || result.indicators.quote.length === 0) {
       return null;
    }
    const closes = result.indicators.quote[0].close;
    
    const historyMap = {};
    if (timestamps && closes) {
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] !== null) {
          // Convert unix timestamp to YYYY-MM-DD
          const date = new Date(timestamps[i] * 1000);
          const dateString = date.toISOString().split('T')[0];
          historyMap[dateString] = closes[i];
        }
      }
    }
    
    return historyMap;

  } catch (error) {
    console.error("Error fetching VOO history via proxy:", error);
    return null;
  }
}
