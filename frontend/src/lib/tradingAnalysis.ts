import { fetchMarketData, getAllTradingPairs, getMarketData } from './deepbookClient';

export interface TradingPair {
  id: string;
  baseCoin: string;
  baseCoinId: string;
  quoteCoin: string;
  quoteCoinId: string;
  pair: string;
  price: number;
  volume24h: number;
  marketCap: number;
  change24h: number;
  volatility: number;
  liquidity: number;
  poolId: string; // Added poolId for DeepBook integration
  poolName: string; // Added poolName for DeepBook integration
}

export interface TransactionData {
  pair: string;
  price: string;
  amount: string;
  total: string;
  transactionType: 'buy' | 'sell';
  poolId: string; // Added poolId for DeepBook integration
  poolName: string; // Added poolName for DeepBook integration
  baseCoinId: string;
  quoteCoinId: string;
}

export interface AnalysisResult {
  pair: string;
  score: number;
  recommendation: string;
  analysis: {
    priceAnalysis: string;
    volumeAnalysis: string;
    volatilityAnalysis: string;
    liquidityAnalysis: string;
  };
  transactionData: TransactionData;
}

// Cache for trading pairs to avoid too many API calls
let tradingPairsCache: Record<string, TradingPair> = {};
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Fetch and update trading pairs from DeepBook
 * @returns Record of trading pairs with market data
 */
export async function fetchTradingPairs(): Promise<Record<string, TradingPair>> {
  const now = Date.now();
  
  // Return cached data if available and not expired
  if (Object.keys(tradingPairsCache).length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return tradingPairsCache;
  }
  
  try {
    // Fetch all trading pairs from DeepBook
    const pools = await getAllTradingPairs();
    const tickerData = await fetchMarketData();

    // Create a temporary object to store the updated pairs
    const updatedPairs: Record<string, TradingPair> = {};
    
    for (const pool of pools) {
      try {
        const marketData = await getMarketData(pool.name, tickerData);
        updatedPairs[pool.pair] = {
          id: pool.id,
          baseCoin: pool.baseCoin,
          baseCoinId: pool.baseCoinId,
          quoteCoin: pool.quoteCoin,
          quoteCoinId: pool.quoteCoinId,
          pair: pool.pair,
          price: marketData.price,
          volume24h: marketData.volume24h,
          marketCap: marketData.marketCap,
          change24h: marketData.change24h,
          volatility: marketData.volatility,
          liquidity: marketData.liquidity,
          poolId: pool.id,
          poolName: pool.name
        };
      } catch (error) {
        console.error(`Error fetching market data for ${pool.pair}:`, error);
      }
    }
    
    // Only update cache if we got at least one pair
    if (Object.keys(updatedPairs).length > 0) {
      tradingPairsCache = updatedPairs;
      lastFetchTime = now;
    }
    
    return updatedPairs;
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    return {};
  }
}

/**
 * Analyze a trading pair using AI algorithms
 * @param pair Trading pair to analyze
 * @returns Analysis result with score, recommendation, and transaction data
 */
export async function analyzeTradingPair(pair: string): Promise<AnalysisResult> {
  const tradingPairs = await fetchTradingPairs();
  if (!tradingPairs[pair]) {
    throw new Error(`Trading pair ${pair} not found`);
  }

  const pairData = tradingPairs[pair];
  
  // Calculate score based on various metrics
  const volumeScore = (pairData.volume24h / 15000000) * 3; // Scale 0-3
  const changeScore = (pairData.change24h / 10) * 3; // Scale 0-3
  const volatilityScore = (1 - Math.abs(pairData.volatility - 0.05) / 0.05) * 2; // Scale 0-2, optimal at 0.05
  const liquidityScore = pairData.liquidity * 2; // Scale 0-2
  
  const rawScore = volumeScore + changeScore + volatilityScore + liquidityScore;
  const score = Math.min(Math.max(Math.round(rawScore), 0), 10);
  
  // Determine recommendation based on score
  let recommendation = "";
  if (score >= 8) {
    recommendation = "Strong Buy";
  } else if (score >= 6) {
    recommendation = "Buy";
  } else if (score >= 4) {
    recommendation = "Hold";
  } else if (score >= 2) {
    recommendation = "Sell";
  } else {
    recommendation = "Strong Sell";
  }
  
  // Generate analysis text
  const analysis = {
    priceAnalysis: `Current price is ${pairData.price} with ${pairData.change24h}% change in 24h`,
    volumeAnalysis: `24h volume is ${pairData.volume24h.toLocaleString()} which is ${
      pairData.volume24h > 10000000 ? "high" : pairData.volume24h > 5000000 ? "moderate" : "low"
    }`,
    volatilityAnalysis: `Volatility is ${pairData.volatility} which is ${
      pairData.volatility > 0.1 ? "high" : pairData.volatility > 0.05 ? "moderate" : "low"
    }`,
    liquidityAnalysis: `Liquidity is ${pairData.liquidity} which is ${
      pairData.liquidity > 0.7 ? "high" : pairData.liquidity > 0.4 ? "moderate" : "low"
    }`
  };
  
  // Prepare transaction data
  const transactionData = {
    pair: pair,
    price: pairData.price.toString(),
    amount: "0", // To be filled by user
    total: "0", // To be calculated in frontend
    transactionType: score >= 5 ? 'buy' as const : 'sell' as const,
    poolId: pairData.poolId, // Add poolId for DeepBook integration
    poolName: pairData.poolName,
    baseCoinId: pairData.baseCoinId,
    quoteCoinId: pairData.quoteCoinId
  };
  
  return {
    pair,
    score,
    recommendation,
    analysis,
    transactionData
  };
}

/**
 * Get all available trading pairs
 * @returns Array of trading pair names
 */
export async function getTradingPairs(): Promise<string[]> {
  const pairs = await fetchTradingPairs();
  return Object.keys(pairs);
}
