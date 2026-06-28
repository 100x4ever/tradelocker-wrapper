import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { 
  TrendingUp, 
  Lock, 
  Settings, 
  Activity, 
  CheckCircle, 
  Play, 
  Square,
  TrendingDown,
  Layers,
  BarChart3,
  MousePointerClick
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('HeroFX-Demo');
  const [accountType, setAccountType] = useState('demo');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  
  // Account & Config Information
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountState, setAccountState] = useState(null);
  const [config, setConfig] = useState(null);
  
  // Trade Setup
  const [instruments, setInstruments] = useState([]);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resolution, setResolution] = useState('5m');
  const [lotSize, setLotSize] = useState('0.01');
  
  // Order Type & Price
  const [orderType, setOrderType] = useState('market'); // 'market' or 'limit'
  const [limitPrice, setLimitPrice] = useState('');
  
  // TP & SL Settings
  const [tpSlMode, setTpSlMode] = useState('price'); // 'price' (Absolute USD price), 'usd_amount' ($ profit/loss), 'pips'
  const [tpValue, setTpValue] = useState('');
  const [slValue, setSlValue] = useState('');
  
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);
  const [positions, setPositions] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  
  // Interactivity Dragging State
  const [draggingLine, setDraggingLine] = useState(null); // { type: 'tp' | 'sl', initialPrice: number }

  // Log / Message Feed
  const [logs, setLogs] = useState([]);
  
  // DOM References for charts
  const mainChartContainerRef = useRef(null);
  const bottomChartContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const bottomChartRef = useRef(null);

  // Series References
  const candleSeriesRef = useRef(null);
  const vwapSeriesRef = useRef(null);
  const sessionHighSeriesRef = useRef(null);
  const sessionLowSeriesRef = useRef(null);
  const fib236SeriesRef = useRef(null);
  const fib500SeriesRef = useRef(null);
  const fib618SeriesRef = useRef(null);

  // Position Price Lines Refs
  const entryPriceLineRef = useRef(null);
  const tpPriceLineRef = useRef(null);
  const slPriceLineRef = useRef(null);

  // Bottom Series References
  const volumeSeriesRef = useRef(null);
  const stoch14SeriesRef = useRef(null);
  const stoch40SeriesRef = useRef(null);
  const stoch60SeriesRef = useRef(null);
  const overboughtSeriesRef = useRef(null);
  const oversoldSeriesRef = useRef(null);

  // Load saved credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('tl_email') || '';
    const savedServer = localStorage.getItem('tl_server') || 'HeroFX-Demo';
    const savedAccountType = localStorage.getItem('tl_account_type') || 'demo';
    
    setEmail(savedEmail);
    setServer(savedServer);
    setAccountType(savedAccountType);
  }, []);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  // Perform login
  const handleLogin = async (e) => {
    e.preventDefault();
    addLog('Attempting to authenticate with TradeLocker...');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, server, accountType })
      });
      const data = await res.json();
      
      if (res.ok && data.accessToken) {
        setToken(data.accessToken);
        setIsLoggedIn(true);
        addLog('Authentication successful!');
        
        // Save fields
        localStorage.setItem('tl_email', email);
        localStorage.setItem('tl_server', server);
        localStorage.setItem('tl_account_type', accountType);

        // Fetch config first, then accounts
        await fetchConfig(data.accessToken);
      } else {
        addLog(`Authentication failed: ${data.message || 'Check credentials'}`);
      }
    } catch (err) {
      addLog(`Error connecting to server proxy: ${err.message}`);
    }
  };

  // Fetch TradeLocker Config
  const fetchConfig = async (jwtToken) => {
    try {
      const res = await fetch(`/api/config?accountType=${accountType}&accNum=0`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (data && data.accountDetailsConfig) {
        setConfig(data);
        addLog('System configuration loaded.');
      }
      fetchAccounts(jwtToken, data);
    } catch (err) {
      addLog(`Failed to fetch config: ${err.message}`);
    }
  };

  // Fetch accounts list
  const fetchAccounts = async (jwtToken, currentConfig) => {
    try {
      const res = await fetch(`/api/accounts?accountType=${accountType}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (data.accounts && data.accounts.length > 0) {
        setAccounts(data.accounts);
        const firstAccount = data.accounts[0];
        setSelectedAccount(firstAccount);
        addLog(`Loaded accounts. Selected: #${firstAccount.id}`);
        fetchState(jwtToken, firstAccount, currentConfig || config);
        fetchInstruments(jwtToken, firstAccount);
        fetchPositions(jwtToken, firstAccount);
      } else {
        addLog('No accounts found.');
      }
    } catch (err) {
      addLog(`Failed to fetch accounts: ${err.message}`);
    }
  };

  // Fetch account details/state and map indices
  const fetchState = async (jwtToken, account, currentConfig) => {
    try {
      const res = await fetch(`/api/state?accountType=${accountType}&accountId=${account.id}&accNum=${account.accNum || '0'}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      
      const activeConfig = currentConfig || config;
      if (data && data.d && data.d.accountDetailsData) {
        const arr = data.d.accountDetailsData;
        const mappedState = {
          balance: arr[0] !== undefined ? arr[0] : 0,
          equity: arr[1] !== undefined ? arr[1] : 0,
          openPnL: arr[22] !== undefined ? arr[22] : (arr[5] !== undefined ? arr[5] : 0)
        };

        if (activeConfig && activeConfig.accountDetailsConfig) {
          const cols = activeConfig.accountDetailsConfig.columns;
          cols.forEach((col, index) => {
            if (arr[index] !== undefined) {
              mappedState[col.name] = arr[index];
            }
          });
        }
        setAccountState(mappedState);
      } else {
        setAccountState(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch active positions
  const fetchPositions = async (jwtToken, account) => {
    try {
      const res = await fetch(`/api/positions?accountType=${accountType}&accountId=${account.id}&accNum=${account.accNum || '0'}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (data && data.d && data.d.positions) {
        const parsedPositions = data.d.positions.map(posArr => {
          const instId = posArr[1];
          const instrumentObj = instruments.find(inst => 
            String(inst.tradableInstrumentId) === String(instId) || String(inst.id) === String(instId)
          );
          const symbolName = instrumentObj ? instrumentObj.name : `Instrument #${instId}`;

          return {
            id: posArr[0],
            tradableInstrumentId: instId,
            symbol: symbolName,
            side: posArr[3],
            qty: posArr[4],
            price: parseFloat(posArr[5]),
            stopLoss: posArr[6] ? parseFloat(posArr[6]) : null,
            takeProfit: posArr[7] ? parseFloat(posArr[7]) : null,
            time: posArr[8],
            pnl: posArr[9]
          };
        });
        setPositions(parsedPositions);
      } else {
        setPositions([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch instruments list
  const fetchInstruments = async (jwtToken, account) => {
    try {
      const res = await fetch(`/api/instruments?accountType=${accountType}&accountId=${account.id}&accNum=${account.accNum || '0'}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      const instList = data.instruments || (data.d && data.d.instruments);
      if (instList) {
        setInstruments(instList);
        const defaultPair = instList.find(inst => inst.name.includes('EURUSD') || inst.name.includes('GBPUSD') || inst.name.includes('QQQ') || inst.name.includes('NAS100'));
        if (defaultPair) {
          setSelectedInstrument(defaultPair);
          addLog(`Default instrument selected: ${defaultPair.name}`);
        } else if (instList.length > 0) {
          setSelectedInstrument(instList[0]);
          addLog(`Instrument selected: ${instList[0].name}`);
        }
      }
    } catch (err) {
      addLog(`Failed to fetch instruments: ${err.message}`);
    }
  };

  // Helper to calculate TP & SL prices based on mode
  const calculateTpSlPrices = (side, entryPrice) => {
    let tpPrice = null;
    let slPrice = null;

    if (!entryPrice) return { tpPrice, slPrice };

    if (tpSlMode === 'price') {
      if (tpValue) tpPrice = parseFloat(tpValue);
      if (slValue) slPrice = parseFloat(slValue);
    } 
    else if (tpSlMode === 'usd_amount') {
      const isForex = selectedInstrument?.name.includes('/') || selectedInstrument?.name.length === 6;
      const contractSize = isForex ? 100000 : 1; 
      const parsedLot = parseFloat(lotSize) || 0.01;
      
      const priceDiffTp = tpValue ? (parseFloat(tpValue) / (parsedLot * contractSize)) : null;
      const priceDiffSl = slValue ? (parseFloat(slValue) / (parsedLot * contractSize)) : null;

      if (priceDiffTp) {
        tpPrice = side === 'buy' ? entryPrice + priceDiffTp : entryPrice - priceDiffTp;
      }
      if (priceDiffSl) {
        slPrice = side === 'buy' ? entryPrice - priceDiffSl : entryPrice + priceDiffSl;
      }
    }
    else if (tpSlMode === 'pips') {
      const pipSize = selectedInstrument?.name.includes('JPY') ? 0.01 : 0.0001;
      const priceDiffTp = tpValue ? (parseFloat(tpValue) * pipSize) : null;
      const priceDiffSl = slValue ? (parseFloat(slValue) * pipSize) : null;

      if (priceDiffTp) {
        tpPrice = side === 'buy' ? entryPrice + priceDiffTp : entryPrice - priceDiffTp;
      }
      if (priceDiffSl) {
        slPrice = side === 'buy' ? entryPrice - priceDiffSl : entryPrice + priceDiffSl;
      }
    }

    return {
      tpPrice: tpPrice ? parseFloat(tpPrice.toFixed(5)) : undefined,
      slPrice: slPrice ? parseFloat(slPrice.toFixed(5)) : undefined
    };
  };

  // Toggle Auto-Trading
  const toggleAutoTrade = async () => {
    if (!selectedAccount || !selectedInstrument) return;
    const nextState = !autoTradeEnabled;
    setAutoTradeEnabled(nextState);
    
    addLog(`Auto-Trading toggle: ${nextState ? 'ON' : 'OFF'} for ${selectedInstrument.name}`);

    try {
      const res = await fetch('/api/auto-trade/toggle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accountId: selectedAccount.id,
          accNum: selectedAccount.accNum,
          email,
          password,
          server,
          accountType,
          tradableInstrumentId: selectedInstrument.id,
          symbol: selectedInstrument.name,
          lotSize,
          tpPips: tpSlMode === 'pips' ? tpValue : 0,
          slPips: tpSlMode === 'pips' ? slValue : 0,
          enabled: nextState
        })
      });
      const data = await res.json();
      addLog(`Auto-Trading engine response: ${data.status}`);
    } catch (err) {
      addLog(`Error toggling Auto-Trading: ${err.message}`);
      setAutoTradeEnabled(false);
    }
  };

  // Execute manual trades
  const executeManualTrade = async (side) => {
    if (!selectedAccount || !selectedInstrument) {
      addLog('Select account and instrument first');
      return;
    }

    const priceToUse = orderType === 'market' ? currentPrice : parseFloat(limitPrice);
    if (!priceToUse) {
      addLog('No current price available. Wait for chart to load.');
      return;
    }

    const { tpPrice, slPrice } = calculateTpSlPrices(side, priceToUse);

    addLog(`Submitting ${orderType.toUpperCase()} ${side.toUpperCase()} order for ${lotSize} lots...`);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accountType,
          accountId: selectedAccount.id,
          accNum: selectedAccount.accNum,
          qty: parseFloat(lotSize),
          side,
          type: orderType,
          price: orderType === 'market' ? 0 : priceToUse,
          tradableInstrumentId: selectedInstrument.tradableInstrumentId || selectedInstrument.id,
          routeId: selectedInstrument.routes?.find(r => r.type === 'TRADE')?.id || 0,
          takeProfit: tpPrice,
          stopLoss: slPrice
        })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`Order placed successfully! ID: ${data.orderId || 'submitted'}`);
        fetchPositions(token, selectedAccount);
        fetchState(token, selectedAccount);
      } else {
        addLog(`Order failed: ${data.message || JSON.stringify(data)}`);
      }
    } catch (err) {
      addLog(`Error executing order: ${err.message}`);
    }
  };

  // Indicator Calculations
  const calculateIndicators = (bars) => {
    if (!bars || bars.length === 0) return null;

    let sessionHigh = -Infinity;
    let sessionLow = Infinity;
    
    const calculatedVWAP = [];
    let cumVolume = 0;
    let cumPriceVolume = 0;

    const dataWithIndicators = bars.map(bar => {
      const time = bar.t;
      const typicalPrice = (bar.h + bar.l + bar.c) / 3;
      const volume = bar.v || 0;

      cumVolume += volume;
      cumPriceVolume += typicalPrice * volume;

      const vwapVal = cumVolume > 0 ? (cumPriceVolume / cumVolume) : bar.c;
      calculatedVWAP.push({ time, value: vwapVal });

      if (bar.h > sessionHigh) sessionHigh = bar.h;
      if (bar.l < sessionLow) sessionLow = bar.l;

      return {
        time,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume
      };
    });

    const range = sessionHigh - sessionLow;
    const fib236 = sessionHigh - 0.236 * range;
    const fib500 = sessionHigh - 0.500 * range;
    const fib618 = sessionHigh - 0.618 * range;

    const sessionHighData = bars.map(b => ({ time: b.t, value: sessionHigh }));
    const sessionLowData = bars.map(b => ({ time: b.t, value: sessionLow }));
    const fib236Data = bars.map(b => ({ time: b.t, value: fib236 }));
    const fib500Data = bars.map(b => ({ time: b.t, value: fib500 }));
    const fib618Data = bars.map(b => ({ time: b.t, value: fib618 }));

    // Stochastics
    const getStochasticData = (period, kSmoothing, dSmoothing) => {
      const kValues = [];
      for (let i = 0; i < bars.length; i++) {
        if (i < period - 1) {
          kValues.push({ time: bars[i].t, value: 50 });
          continue;
        }
        const slice = bars.slice(i - period + 1, i + 1);
        const currentClose = slice[slice.length - 1].c;
        const lowestLow = Math.min(...slice.map(b => b.l));
        const highestHigh = Math.max(...slice.map(b => b.h));
        const k = ((currentClose - lowestLow) / ((highestHigh - lowestLow) || 1)) * 100;
        kValues.push({ time: bars[i].t, value: k });
      }

      const smoothedK = [];
      for (let i = 0; i < kValues.length; i++) {
        if (i < kSmoothing - 1) {
          smoothedK.push({ time: kValues[i].time, value: kValues[i].value });
          continue;
        }
        const slice = kValues.slice(i - kSmoothing + 1, i + 1);
        const avg = slice.reduce((sum, item) => sum + item.value, 0) / kSmoothing;
        smoothedK.push({ time: kValues[i].time, value: avg });
      }

      const smoothedD = [];
      for (let i = 0; i < smoothedK.length; i++) {
        if (i < dSmoothing - 1) {
          smoothedD.push({ time: smoothedK[i].time, value: smoothedK[i].value });
          continue;
        }
        const slice = smoothedK.slice(i - dSmoothing + 1, i + 1);
        const avg = slice.reduce((sum, item) => sum + item.value, 0) / dSmoothing;
        smoothedD.push({ time: smoothedK[i].time, value: avg });
      }

      return smoothedD;
    };

    const stoch14 = getStochasticData(14, 4, 3);
    const stoch40 = getStochasticData(40, 4, 3);
    const stoch60 = getStochasticData(60, 10, 10);

    const volumeData = bars.map(bar => ({
      time: bar.t,
      value: bar.v || 0,
      color: bar.c >= bar.o ? '#0ea5e9' : '#ef4444'
    }));

    return {
      candles: dataWithIndicators,
      vwap: calculatedVWAP,
      sessionHigh: sessionHighData,
      sessionLow: sessionLowData,
      fib236: fib236Data,
      fib500: fib500Data,
      fib618: fib618Data,
      stoch14,
      stoch40,
      stoch60,
      volume: volumeData
    };
  };

  // Main chart fetching & rendering setup
  useEffect(() => {
    if (!selectedInstrument || !token) return;

    const fetchHistoryAndRender = async () => {
      try {
        const toMs = Date.now();
        const fromMs = toMs - (24 * 60 * 60 * 5 * 1000); // 5 days of history

        const infoRoute = selectedInstrument.routes?.find(r => r.type === 'INFO');
        const routeIdVal = infoRoute ? infoRoute.id : 0;
        const targetInstrumentId = selectedInstrument.tradableInstrumentId || selectedInstrument.id;
        
        const res = await fetch(
          `/api/history?accountType=${accountType}&resolution=${resolution}&from=${fromMs}&to=${toMs}&tradableInstrumentId=${targetInstrumentId}&accNum=${selectedAccount?.accNum || '0'}&routeId=${routeIdVal}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await res.json();
        
        if (!res.ok) {
          addLog(`History Error: ${data.error || 'Failed'} - ${JSON.stringify(data.details || data)}`);
          return;
        }

        const rawBars = (data.d && data.d.barDetails) || data.bars || [];

        if (rawBars.length === 0) {
          addLog(`No bars returned: ${JSON.stringify(data)}`);
          return;
        }

        const calculated = calculateIndicators(rawBars);
        if (!calculated) return;

        const latestClose = calculated.candles[calculated.candles.length - 1].close;
        setCurrentPrice(latestClose);

        // Initialize Charts
        if (!mainChartRef.current && mainChartContainerRef.current) {
          mainChartRef.current = createChart(mainChartContainerRef.current, {
            layout: {
              background: { color: '#0f111a' },
              textColor: '#a0aec0',
            },
            grid: {
              vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
              horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            width: mainChartContainerRef.current.clientWidth,
            height: 400,
          });

          candleSeriesRef.current = mainChartRef.current.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
          });

          vwapSeriesRef.current = mainChartRef.current.addLineSeries({
            color: '#ffffff',
            lineWidth: 2,
            title: 'VWAP'
          });

          sessionHighSeriesRef.current = mainChartRef.current.addLineSeries({
            color: '#10b981',
            lineWidth: 1.5,
            lineStyle: 2,
            title: 'Session High'
          });

          sessionLowSeriesRef.current = mainChartRef.current.addLineSeries({
            color: '#ef4444',
            lineWidth: 1.5,
            lineStyle: 2,
            title: 'Session Low'
          });

          fib236SeriesRef.current = mainChartRef.current.addLineSeries({
            color: '#eab308',
            lineWidth: 1,
            title: 'Fib 0.236'
          });

          fib500SeriesRef.current = mainChartRef.current.addLineSeries({
            color: '#a855f7',
            lineWidth: 1,
            title: 'Fib 0.500'
          });

          fib618SeriesRef.current = mainChartRef.current.addLineSeries({
            color: '#3b82f6',
            lineWidth: 1,
            title: 'Fib 0.618'
          });
        }

        // Initialize Bottom Pane
        if (!bottomChartRef.current && bottomChartContainerRef.current) {
          bottomChartRef.current = createChart(bottomChartContainerRef.current, {
            layout: {
              background: { color: '#0f111a' },
              textColor: '#a0aec0',
            },
            grid: {
              vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
              horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            width: bottomChartContainerRef.current.clientWidth,
            height: 180,
          });

          volumeSeriesRef.current = bottomChartRef.current.addHistogramSeries({
            priceScaleId: 'volume',
          });

          bottomChartRef.current.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
          });

          stoch14SeriesRef.current = bottomChartRef.current.addLineSeries({
            color: '#eab308',
            lineWidth: 1.5,
            title: 'Stoch 14'
          });

          stoch40SeriesRef.current = bottomChartRef.current.addLineSeries({
            color: '#3b82f6',
            lineWidth: 1.5,
            title: 'Stoch 40'
          });

          stoch60SeriesRef.current = bottomChartRef.current.addLineSeries({
            color: '#ffffff',
            lineWidth: 1.5,
            title: 'Stoch 60'
          });

          overboughtSeriesRef.current = bottomChartRef.current.addLineSeries({
            color: 'rgba(255, 255, 255, 0.15)',
            lineWidth: 1,
            lineStyle: 3,
          });

          oversoldSeriesRef.current = bottomChartRef.current.addLineSeries({
            color: 'rgba(255, 255, 255, 0.15)',
            lineWidth: 1,
            lineStyle: 3,
          });
        }

        // Set series data
        candleSeriesRef.current.setData(calculated.candles);
        vwapSeriesRef.current.setData(calculated.vwap);
        sessionHighSeriesRef.current.setData(calculated.sessionHigh);
        sessionLowSeriesRef.current.setData(calculated.sessionLow);
        fib236SeriesRef.current.setData(calculated.fib236);
        fib500SeriesRef.current.setData(calculated.fib500);
        fib618SeriesRef.current.setData(calculated.fib618);

        volumeSeriesRef.current.setData(calculated.volume);
        stoch14SeriesRef.current.setData(calculated.stoch14);
        stoch40SeriesRef.current.setData(calculated.stoch40);
        stoch60SeriesRef.current.setData(calculated.stoch60);

        const boundary80 = calculated.candles.map(c => ({ time: c.time, value: 80 }));
        const boundary20 = calculated.candles.map(c => ({ time: c.time, value: 20 }));
        overboughtSeriesRef.current.setData(boundary80);
        oversoldSeriesRef.current.setData(boundary20);

        // Sync chart timespans
        let isSyncing = false;
        mainChartRef.current.timeScale().subscribeVisibleTimeRangeChange(range => {
          if (isSyncing || !range) return;
          isSyncing = true;
          bottomChartRef.current.timeScale().setVisibleRange(range);
          isSyncing = false;
        });

        bottomChartRef.current.timeScale().subscribeVisibleTimeRangeChange(range => {
          if (isSyncing || !range) return;
          isSyncing = true;
          mainChartRef.current.timeScale().setVisibleRange(range);
          isSyncing = false;
        });

        addLog(`Rendered charts with Aura Main & Aura Bottom for ${selectedInstrument.name}`);

      } catch (err) {
        addLog(`Chart rendering failed: ${err.message}`);
      }
    };

    fetchHistoryAndRender();

    // Auto-refresh loop
    const stateTimer = setInterval(() => {
      if (selectedAccount) {
        fetchState(token, selectedAccount);
        fetchPositions(token, selectedAccount);
      }
    }, 5000);

    return () => {
      clearInterval(stateTimer);
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }
      if (bottomChartRef.current) {
        bottomChartRef.current.remove();
        bottomChartRef.current = null;
      }
    };
  }, [selectedInstrument, resolution, token]);

  // Effect to draw and manage entry, TP, and SL price lines on the chart
  useEffect(() => {
    if (!selectedInstrument || !candleSeriesRef.current || !mainChartRef.current) return;

    // Find active position for the selected instrument
    const targetId = selectedInstrument.tradableInstrumentId || selectedInstrument.id;
    const activePos = positions.find(p => 
      String(p.tradableInstrumentId) === String(targetId)
    );

    // Clean up old lines first
    if (entryPriceLineRef.current) {
      candleSeriesRef.current.removePriceLine(entryPriceLineRef.current);
      entryPriceLineRef.current = null;
    }
    if (tpPriceLineRef.current) {
      candleSeriesRef.current.removePriceLine(tpPriceLineRef.current);
      tpPriceLineRef.current = null;
    }
    if (slPriceLineRef.current) {
      candleSeriesRef.current.removePriceLine(slPriceLineRef.current);
      slPriceLineRef.current = null;
    }

    if (activePos) {
      // 1. Draw Entry Line
      entryPriceLineRef.current = candleSeriesRef.current.createPriceLine({
        price: activePos.price,
        color: '#3b82f6', // Blue
        lineWidth: 2,
        lineStyle: 2, // Dashed
        title: `Entry: ${activePos.price}`,
        axisLabelVisible: true,
      });

      // 2. Draw Take Profit Line
      if (activePos.takeProfit) {
        tpPriceLineRef.current = candleSeriesRef.current.createPriceLine({
          price: activePos.takeProfit,
          color: '#10b981', // Green
          lineWidth: 2,
          lineStyle: 0, // Solid
          title: `TP: ${activePos.takeProfit} (Drag)`,
          axisLabelVisible: true,
        });
      }

      // 3. Draw Stop Loss Line
      if (activePos.stopLoss) {
        slPriceLineRef.current = candleSeriesRef.current.createPriceLine({
          price: activePos.stopLoss,
          color: '#ef4444', // Red
          lineWidth: 2,
          lineStyle: 0, // Solid
          title: `SL: ${activePos.stopLoss} (Drag)`,
          axisLabelVisible: true,
        });
      }

      // Mark the entry candle
      if (activePos.time) {
        const entryTimeSeconds = Math.floor(parseInt(activePos.time) / 1000);
        candleSeriesRef.current.setMarkers([
          {
            time: entryTimeSeconds,
            position: 'belowBar',
            color: '#eab308', // Yellow
            shape: 'arrowUp',
            text: `Entry`
          }
        ]);
      }
    } else {
      candleSeriesRef.current.setMarkers([]);
    }
  }, [positions, selectedInstrument]);

  // Handle Dragging Logic for TP/SL Lines
  useEffect(() => {
    if (!draggingLine || !selectedInstrument || !selectedAccount || !candleSeriesRef.current) return;

    const targetId = selectedInstrument.tradableInstrumentId || selectedInstrument.id;
    const activePos = positions.find(p => String(p.tradableInstrumentId) === String(targetId));
    if (!activePos) return;

    const handleMouseMove = (e) => {
      const rect = mainChartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const currentPrice = candleSeriesRef.current.coordinateToPrice(y);
      if (!currentPrice) return;

      // Update line position visually in real-time
      if (draggingLine.type === 'tp' && tpPriceLineRef.current) {
        tpPriceLineRef.current.applyOptions({ 
          price: currentPrice, 
          title: `TP: ${currentPrice.toFixed(5)} (Release to save)` 
        });
      } else if (draggingLine.type === 'sl' && slPriceLineRef.current) {
        slPriceLineRef.current.applyOptions({ 
          price: currentPrice, 
          title: `SL: ${currentPrice.toFixed(5)} (Release to save)` 
        });
      }
    };

    const handleMouseUp = async (e) => {
      const rect = mainChartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const finalPrice = parseFloat(candleSeriesRef.current.coordinateToPrice(y).toFixed(5));
      
      setDraggingLine(null);

      if (finalPrice) {
        addLog(`Modifying ${draggingLine.type.toUpperCase()} level to ${finalPrice}...`);
        try {
          const res = await fetch(`/api/positions/${activePos.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              accountType,
              accNum: selectedAccount.accNum,
              takeProfit: draggingLine.type === 'tp' ? finalPrice : activePos.takeProfit,
              stopLoss: draggingLine.type === 'sl' ? finalPrice : activePos.stopLoss
            })
          });
          const data = await res.json();
          if (res.ok) {
            addLog(`${draggingLine.type.toUpperCase()} modified successfully on TradeLocker.`);
            fetchPositions(token, selectedAccount);
          } else {
            addLog(`Failed to modify position: ${data.details?.errmsg || data.error}`);
          }
        } catch (err) {
          addLog(`Error modifying position: ${err.message}`);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingLine, positions, selectedInstrument, selectedAccount]);

  // Hook mouse down event on chart container to initiate drag
  const handleChartMouseDown = (e) => {
    if (!selectedInstrument || !candleSeriesRef.current) return;
    const targetId = selectedInstrument.tradableInstrumentId || selectedInstrument.id;
    const activePos = positions.find(p => String(p.tradableInstrumentId) === String(targetId));
    if (!activePos) return;

    const rect = mainChartContainerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const clickedPrice = candleSeriesRef.current.coordinateToPrice(y);
    if (!clickedPrice) return;

    // Check click proximity (within 1.5% tolerance)
    const tpPrice = activePos.takeProfit;
    const slPrice = activePos.stopLoss;
    const tolerance = clickedPrice * 0.015;

    if (tpPrice && Math.abs(clickedPrice - tpPrice) < tolerance) {
      setDraggingLine({ type: 'tp', initialPrice: tpPrice });
      addLog('Dragging Take Profit (TP) line...');
    } else if (slPrice && Math.abs(clickedPrice - slPrice) < tolerance) {
      setDraggingLine({ type: 'sl', initialPrice: slPrice });
      addLog('Dragging Stop Loss (SL) line...');
    }
  };

  const filteredInstruments = instruments.filter(inst => 
    inst.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-panel m-4 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg">
            ⚡
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-gradient">AURA TRADE</h1>
            <p className="text-xs text-slate-400">TradeLocker Automation Dashboard</p>
          </div>
        </div>
        
        {isLoggedIn && accountState && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">BALANCE</span>
              <span className="font-semibold text-emerald-400">
                ${parseFloat(accountState.balance || accountState.accountBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">EQUITY</span>
              <span className="font-semibold text-indigo-400">
                ${parseFloat(accountState.equity || accountState.accountEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">UNREALIZED PNL</span>
              <span className={`font-semibold ${(accountState.openPnL || accountState.unrealizedPnL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${parseFloat(accountState.openPnL || accountState.unrealizedPnL || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 px-4 pb-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Connection Panel */}
          <div className="glass-panel p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2">
              <Lock size={16} /> CONNECTION CONFIG
            </h2>
            
            {!isLoggedIn ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500" 
                    placeholder="name@email.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500" 
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Server</label>
                  <input 
                    type="text" 
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500" 
                    placeholder="HeroFX-Demo"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Environment</label>
                  <select 
                    value={accountType} 
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
                  >
                    <option value="demo">Demo Environment</option>
                    <option value="live">Live Environment</option>
                  </select>
                </div>
                <button type="submit" className="glow-btn mt-2">Connect Platform</button>
              </form>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm bg-emerald-950/40 border border-emerald-900/60 p-3 rounded">
                  <span className="text-emerald-400 font-medium">Logged In</span>
                  <CheckCircle size={16} className="text-emerald-400" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Account Select</span>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none"
                    value={selectedAccount ? selectedAccount.id : ''}
                    onChange={(e) => {
                      const acc = accounts.find(a => String(a.id) === String(e.target.value));
                      setSelectedAccount(acc);
                      fetchState(token, acc);
                      fetchPositions(token, acc);
                    }}
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        Account #{acc.id} ({acc.currency || 'USD'})
                      </option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => setIsLoggedIn(false)} 
                  className="btn-secondary"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* Trade Parameters & Controls */}
          {isLoggedIn && (
            <div className="glass-panel p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2">
                <Settings size={16} /> TRADING CONTROL
              </h2>
              
              <div className="flex flex-col gap-3">
                {/* Order Type Select */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Order Type</label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded border border-slate-800">
                    <button 
                      onClick={() => setOrderType('market')} 
                      className={`py-1.5 text-xs rounded font-medium transition-all ${orderType === 'market' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Market
                    </button>
                    <button 
                      onClick={() => setOrderType('limit')} 
                      className={`py-1.5 text-xs rounded font-medium transition-all ${orderType === 'limit' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Limit
                    </button>
                  </div>
                </div>

                {orderType === 'limit' && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Limit Price</label>
                    <input 
                      type="number" 
                      step="0.00001"
                      value={limitPrice} 
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder={currentPrice ? `Current: ${currentPrice}` : '0.00000'}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500" 
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Lot Size</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={lotSize} 
                    onChange={(e) => setLotSize(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none" 
                  />
                </div>

                {/* TP / SL Mode Select */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">TP/SL Mode</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded border border-slate-800">
                    <button 
                      onClick={() => setTpSlMode('price')} 
                      className={`py-1 text-[10px] rounded font-medium transition-all ${tpSlMode === 'price' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Price (USD)
                    </button>
                    <button 
                      onClick={() => setTpSlMode('usd_amount')} 
                      className={`py-1 text-[10px] rounded font-medium transition-all ${tpSlMode === 'usd_amount' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      $ Value
                    </button>
                    <button 
                      onClick={() => setTpSlMode('pips')} 
                      className={`py-1 text-[10px] rounded font-medium transition-all ${tpSlMode === 'pips' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Pips
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {tpSlMode === 'price' ? 'TP Price' : tpSlMode === 'usd_amount' ? 'TP Profit ($)' : 'TP Pips'}
                    </label>
                    <input 
                      type="number" 
                      value={tpValue} 
                      onChange={(e) => setTpValue(e.target.value)}
                      placeholder={tpSlMode === 'price' ? 'e.g. 715.00' : 'e.g. 50'}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {tpSlMode === 'price' ? 'SL Price' : tpSlMode === 'usd_amount' ? 'SL Loss ($)' : 'SL Pips'}
                    </label>
                    <input 
                      type="number" 
                      value={slValue} 
                      onChange={(e) => setSlValue(e.target.value)}
                      placeholder={tpSlMode === 'price' ? 'e.g. 700.00' : 'e.g. 25'}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none" 
                    />
                  </div>
                </div>

                <div className="my-2 border-t border-slate-800"></div>

                {/* Auto Trade Toggle */}
                <div className={`p-4 rounded border transition-all ${autoTradeEnabled ? 'auto-trade-active bg-emerald-950/10' : 'bg-slate-900/40 border-slate-800'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-200">AUTO TRADING ENGINE</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${autoTradeEnabled ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  </div>
                  <button 
                    onClick={toggleAutoTrade}
                    className={`w-full py-2.5 rounded font-bold flex items-center justify-center gap-2 transition-all ${
                      autoTradeEnabled 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {autoTradeEnabled ? (
                      <>
                        <Square size={16} /> Disable Auto Trading
                      </>
                    ) : (
                      <>
                        <Play size={16} /> Enable Auto Trading
                      </>
                    )}
                  </button>
                </div>

                {/* Manual Execution Buttons */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button 
                    onClick={() => executeManualTrade('buy')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <TrendingUp size={18} /> BUY / ASK
                  </button>
                  <button 
                    onClick={() => executeManualTrade('sell')}
                    className="bg-red-600 hover:bg-red-700 text-white py-3 rounded font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <TrendingDown size={18} /> SELL / BID
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Central Pane */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="glass-panel p-4 flex flex-col flex-1">
            {/* Chart Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Layers size={16} className="text-indigo-400" />
                <span className="font-semibold text-slate-300">Live Indicator Chart</span>
                
                {isLoggedIn && (
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Search pair..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-44"
                    />
                    {searchQuery && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded shadow-2xl max-h-60 overflow-y-auto z-55">
                        {filteredInstruments.map(inst => (
                          <div 
                            key={inst.id} 
                            onClick={() => {
                              setSelectedInstrument(inst);
                              setSearchQuery('');
                            }}
                            className="p-2 text-xs hover:bg-slate-900 cursor-pointer border-b border-slate-900 text-slate-300"
                          >
                            {inst.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {selectedInstrument && (
                  <span className="text-sm font-bold text-violet-400 bg-violet-950/40 border border-violet-900/60 px-2.5 py-0.5 rounded">
                    {selectedInstrument.name}
                  </span>
                )}
              </div>

              {/* Resolution */}
              <div className="flex items-center gap-1.5">
                {['1m', '5m', '15m', '1h', '4h', '1d'].map(res => (
                  <button 
                    key={res} 
                    onClick={() => setResolution(res)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                      resolution === res 
                        ? 'bg-violet-600 text-white' 
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-full relative bg-[#0f111a] rounded-lg overflow-hidden border border-slate-900">
                <div 
                  ref={mainChartContainerRef} 
                  className="w-full cursor-row-resize"
                  onMouseDown={handleChartMouseDown}
                ></div>
                <div ref={bottomChartContainerRef} className="w-full border-t border-slate-900"></div>

                {!isLoggedIn && (
                  <div className="absolute inset-0 bg-[#0f111a]/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-20">
                    <Activity size={48} className="text-indigo-500 mb-4 animate-pulse" />
                    <h3 className="text-lg font-semibold mb-1">Aura Indicator Workspace</h3>
                    <p className="text-sm text-slate-400 max-w-sm mb-4">Connect to your TradeLocker account using the sidebar to stream live charts with custom indicator calculations.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400 border-t border-slate-900 pt-3">
              <div className="indicator-tag">
                <span className="w-2.5 h-1 bg-white rounded"></span>
                VWAP
              </div>
              <div className="indicator-tag">
                <span className="w-2.5 h-1 bg-emerald-500 rounded"></span>
                Session High
              </div>
              <div className="indicator-tag">
                <span className="w-2.5 h-1 bg-red-500 rounded"></span>
                Session Low
              </div>
              <div className="indicator-tag">
                <span className="w-2.5 h-1 bg-yellow-500 rounded"></span>
                Fib 0.236
              </div>
              <div className="indicator-tag">
                <span className="w-2.5 h-1 bg-purple-500 rounded"></span>
                Fib 0.500
              </div>
              <div className="indicator-tag">
                <span className="w-2.5 h-1 bg-blue-500 rounded"></span>
                Fib 0.618
              </div>
              <div className="indicator-tag">
                <span className="w-2.5 h-1 bg-gradient-to-r from-yellow-500 via-blue-500 to-white rounded"></span>
                Stochastics (14, 40, 60)
              </div>
              <div className="indicator-tag text-indigo-400 font-semibold">
                <MousePointerClick size={12} /> Click & Drag TP / SL Lines to Modify
              </div>
            </div>
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Open Positions */}
            <div className="glass-panel p-4 flex flex-col max-h-64 overflow-y-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <BarChart3 size={14} /> Open Positions
              </h3>
              
              {positions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs py-8">
                  No active positions open.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {positions.map(pos => (
                    <div key={pos.id} className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded border border-slate-800/80 text-xs">
                      <div>
                        <span className={`font-bold mr-1.5 uppercase ${pos.side === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {pos.side}
                        </span>
                        <span className="font-semibold text-slate-200">{pos.symbol || 'Instrument'}</span>
                        <div className="text-[10px] text-slate-500">Qty: {pos.qty} | Price: {pos.price}</div>
                        {(pos.takeProfit || pos.stopLoss) && (
                          <div className="text-[9px] text-violet-400">
                            {pos.takeProfit ? `TP: ${pos.takeProfit}` : ''} {pos.stopLoss ? `| SL: ${pos.stopLoss}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`font-bold ${(pos.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${parseFloat(pos.pnl || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="glass-panel p-4 flex flex-col max-h-64">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                System Log & Feed
              </h3>
              <div className="flex-1 bg-slate-950/80 rounded p-2.5 font-mono text-[10px] text-slate-300 overflow-y-auto flex flex-col-reverse gap-1 border border-slate-900">
                {logs.length === 0 ? (
                  <div className="text-slate-600">Dashboard status active. Connect to start feed...</div>
                ) : (
                  logs.map((log, idx) => <div key={idx}>{log}</div>)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
