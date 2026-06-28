const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Serve static assets from the frontend/dist directory in production
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Helper to get TradeLocker base URL based on account type
function getBaseUrl(accountType) {
  return accountType === 'live' 
    ? 'https://live.tradelocker.com/backend-api' 
    : 'https://demo.tradelocker.com/backend-api';
}

// Proxy endpoint for login
app.post('/api/auth/login', async (req, res) => {
  const { email, password, server, accountType } = req.body;
  if (!email || !password || !server || !accountType) {
    return res.status(400).json({ error: 'Missing required credentials' });
  }

  try {
    const baseUrl = getBaseUrl(accountType);
    const response = await axios.post(`${baseUrl}/auth/jwt/token`, {
      email,
      password,
      server
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Login error:', error.message);
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: 'Failed to connect to TradeLocker' };
    res.status(status).json(data);
  }
});

// Proxy endpoint to get accounts
app.get('/api/accounts', async (req, res) => {
  const { accountType } = req.query;
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required' });
  }

  try {
    const baseUrl = getBaseUrl(accountType);
    const response = await axios.get(`${baseUrl}/auth/jwt/all-accounts`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Fetch accounts error:', error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: 'Failed to fetch accounts' });
  }
});

// Proxy endpoint to get config
app.get('/api/config', async (req, res) => {
  const { accountType, accNum } = req.query;
  const authHeader = req.headers['authorization'];

  try {
    const baseUrl = getBaseUrl(accountType);
    const response = await axios.get(`${baseUrl}/trade/config`, {
      headers: {
        'Authorization': authHeader,
        'accNum': accNum || '0',
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Fetch config error:', error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: 'Failed to fetch config' });
  }
});

// Proxy endpoint to get instruments
app.get('/api/instruments', async (req, res) => {
  const { accountType, accountId, accNum } = req.query;
  const authHeader = req.headers['authorization'];

  try {
    const baseUrl = getBaseUrl(accountType);
    const response = await axios.get(`${baseUrl}/trade/accounts/${accountId}/instruments`, {
      headers: {
        'Authorization': authHeader,
        'accNum': accNum || '0',
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Fetch instruments error:', error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: 'Failed to fetch instruments' });
  }
});

// Proxy endpoint to get history
app.get('/api/history', async (req, res) => {
  const { accountType, resolution, from, to, tradableInstrumentId, accNum } = req.query;
  const authHeader = req.headers['authorization'];

  console.log(`History Request: instrument=${tradableInstrumentId}, res=${resolution}, from=${from}, to=${to}, accNum=${accNum}`);

  try {
    const baseUrl = getBaseUrl(accountType);
    const response = await axios.get(`${baseUrl}/trade/history`, {
      params: {
        resolution,
        from,
        to,
        tradableInstrumentId,
        routeId: 'INFO'
      },
      headers: {
        'Authorization': authHeader,
        'accNum': accNum || '0',
        'Accept': 'application/json'
      }
    });
    console.log(`History Response Status: ${response.status}, Bars count: ${response.data?.d?.barDetails?.length || 0}`);
    res.json(response.data);
  } catch (error) {
    console.error('Fetch history error details:', error.response?.data || error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ 
      error: 'Failed to fetch price history', 
      details: error.response?.data || error.message 
    });
  }
});

// Proxy endpoint to place orders
app.post('/api/orders', async (req, res) => {
  const { accountType, accountId, accNum, qty, side, type, price, tradableInstrumentId, stopLoss, takeProfit } = req.body;
  const authHeader = req.headers['authorization'];

  try {
    const baseUrl = getBaseUrl(accountType);
    const payload = {
      qty,
      routeId: 'TRADE',
      side,
      type,
      validity: type === 'market' ? 'IOC' : 'GTC',
      tradableInstrumentId,
      price: type === 'market' ? 0 : parseFloat(price)
    };

    if (stopLoss) payload.stopLoss = stopLoss;
    if (takeProfit) payload.takeProfit = takeProfit;

    const response = await axios.post(`${baseUrl}/trade/accounts/${accountId}/orders`, payload, {
      headers: {
        'Authorization': authHeader,
        'accNum': accNum || '0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Place order error:', error.message);
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: 'Failed to place order' };
    res.status(status).json(data);
  }
});

// Proxy endpoint to get positions
app.get('/api/positions', async (req, res) => {
  const { accountType, accountId, accNum } = req.query;
  const authHeader = req.headers['authorization'];

  try {
    const baseUrl = getBaseUrl(accountType);
    const response = await axios.get(`${baseUrl}/trade/accounts/${accountId}/positions`, {
      headers: {
        'Authorization': authHeader,
        'accNum': accNum || '0',
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Fetch positions error:', error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: 'Failed to fetch positions' });
  }
});

// Proxy endpoint to get state/balance
app.get('/api/state', async (req, res) => {
  const { accountType, accountId, accNum } = req.query;
  const authHeader = req.headers['authorization'];

  try {
    const baseUrl = getBaseUrl(accountType);
    const response = await axios.get(`${baseUrl}/trade/accounts/${accountId}/state`, {
      headers: {
        'Authorization': authHeader,
        'accNum': accNum || '0',
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Fetch state error:', error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: 'Failed to fetch account state' });
  }
});

// Background Auto-Trading Engine State
let autoTradeJobs = {}; // Map of userId/accountId -> Job parameters & state

app.post('/api/auto-trade/toggle', async (req, res) => {
  const { 
    accountId, 
    accNum, 
    email, 
    password, 
    server, 
    accountType, 
    tradableInstrumentId, 
    symbol, 
    lotSize, 
    tpPips, 
    slPips,
    enabled 
  } = req.body;

  const jobId = `${accountId}_${tradableInstrumentId}`;

  if (!enabled) {
    if (autoTradeJobs[jobId]) {
      clearInterval(autoTradeJobs[jobId].intervalId);
      delete autoTradeJobs[jobId];
    }
    return res.json({ status: 'stopped', jobId });
  }

  // If enabling, create background job
  if (autoTradeJobs[jobId]) {
    clearInterval(autoTradeJobs[jobId].intervalId);
  }

  const job = {
    accountId,
    accNum,
    email,
    password,
    server,
    accountType,
    tradableInstrumentId,
    symbol,
    lotSize: parseFloat(lotSize) || 0.01,
    tpPips: parseFloat(tpPips) || 0,
    slPips: parseFloat(slPips) || 0,
    lastCheckedBarTime: null,
    inTrade: false
  };

  // Run the check function every 10 seconds
  const runCheck = async () => {
    try {
      // 1. Get auth token
      const baseUrl = getBaseUrl(job.accountType);
      const authRes = await axios.post(`${baseUrl}/auth/jwt/token`, {
        email: job.email,
        password: job.password,
        server: job.server
      });
      const token = authRes.data.accessToken;
      const authHeader = `Bearer ${token}`;

      // 2. Fetch history (recent 100 bars of 1m resolution for indicator calculation)
      const nowSeconds = Math.floor(Date.now() / 1000);
      const fromSeconds = nowSeconds - 6000; // 100 minutes
      const historyRes = await axios.get(`${baseUrl}/trade/history`, {
        params: {
          resolution: '1m',
          from: fromSeconds,
          to: nowSeconds,
          tradableInstrumentId: job.tradableInstrumentId,
          routeId: 'INFO'
        },
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      const bars = (historyRes.data.d && historyRes.data.d.barDetails) || historyRes.data.bars || [];
      if (bars.length < 60) return; // Need enough bars for Stochastics

      // Calculate indicators on the backend to trigger trade logic
      // Stochastic logic: Highs, Lows, Closes over window
      const getStoch = (period, kSmoothing, dSmoothing) => {
        const kValues = [];
        for (let i = period; i < bars.length; i++) {
          const slice = bars.slice(i - period + 1, i + 1);
          const currentClose = slice[slice.length - 1].c;
          const lowestLow = Math.min(...slice.map(b => b.l));
          const highestHigh = Math.max(...slice.map(b => b.h));
          const k = ((currentClose - lowestLow) / ((highestHigh - lowestLow) || 1)) * 100;
          kValues.push(k);
        }
        
        // Smooth %K
        const smoothedK = [];
        for (let i = kSmoothing - 1; i < kValues.length; i++) {
          const slice = kValues.slice(i - kSmoothing + 1, i + 1);
          const avgK = slice.reduce((sum, v) => sum + v, 0) / kSmoothing;
          smoothedK.push(avgK);
        }

        // Smooth %D
        const smoothedD = [];
        for (let i = dSmoothing - 1; i < smoothedK.length; i++) {
          const slice = smoothedK.slice(i - dSmoothing + 1, i + 1);
          const avgD = slice.reduce((sum, v) => sum + v, 0) / dSmoothing;
          smoothedD.push(avgD);
        }

        return {
          k: smoothedK[smoothedK.length - 1],
          d: smoothedD[smoothedD.length - 1],
          prevK: smoothedK[smoothedK.length - 2],
          prevD: smoothedD[smoothedD.length - 2]
        };
      };

      const stoch14 = getStoch(14, 3, 3);
      const stoch40 = getStoch(40, 3, 3);
      
      const currentClose = bars[bars.length - 1].c;

      // Simple auto-trade strategy:
      // Buy when Stoch14 crosses above Stoch40 below 20 (oversold region)
      // Sell when Stoch14 crosses below Stoch40 above 80 (overbought region)
      const crossedUp = stoch14.prevK <= stoch40.prevK && stoch14.k > stoch40.k;
      const crossedDown = stoch14.prevK >= stoch40.prevK && stoch14.k < stoch40.k;

      // Fetch positions to ensure we don't open duplicate trades
      const posRes = await axios.get(`${baseUrl}/trade/accounts/${job.accountId}/positions`, {
        headers: {
          'Authorization': authHeader,
          'accNum': job.accNum || '0',
          'Accept': 'application/json'
        }
      });
      const openPositions = posRes.data.positions || [];
      const hasOpenPos = openPositions.some(p => p.tradableInstrumentId === job.tradableInstrumentId);

      if (!hasOpenPos) {
        let side = null;
        if (crossedUp && stoch14.k < 30) {
          side = 'buy';
        } else if (crossedDown && stoch14.k > 70) {
          side = 'sell';
        }

        if (side) {
          // Calculate TP & SL targets
          const pipsMultiplier = 0.0001; // Default for major currency pairs like EURUSD. Adjust as needed.
          const tpPrice = job.tpPips > 0 ? (side === 'buy' ? currentClose + (job.tpPips * pipsMultiplier) : currentClose - (job.tpPips * pipsMultiplier)) : undefined;
          const slPrice = job.slPips > 0 ? (side === 'buy' ? currentClose - (job.slPips * pipsMultiplier) : currentClose + (job.slPips * pipsMultiplier)) : undefined;

          const orderPayload = {
            qty: job.lotSize,
            routeId: 'TRADE',
            side,
            type: 'market',
            validity: 'IOC',
            tradableInstrumentId: job.tradableInstrumentId,
            price: 0
          };

          if (tpPrice) orderPayload.takeProfit = parseFloat(tpPrice.toFixed(5));
          if (slPrice) orderPayload.stopLoss = parseFloat(slPrice.toFixed(5));

          console.log(`Auto Trade: Executing ${side} order for ${job.symbol}`);
          await axios.post(`${baseUrl}/trade/accounts/${job.accountId}/orders`, orderPayload, {
            headers: {
              'Authorization': authHeader,
              'accNum': job.accNum || '0',
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
        }
      }
    } catch (e) {
      console.error('Auto Trade iteration failed:', e.message);
    }
  };

  // Run immediately and then on interval
  runCheck();
  job.intervalId = setInterval(runCheck, 10000);
  autoTradeJobs[jobId] = job;

  res.json({ status: 'running', jobId });
});

// Wildcard handler for React UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TradeLocker Wrapper listening on port ${PORT}`);
});
