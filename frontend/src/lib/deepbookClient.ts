import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { AggregatorClient } from "@cetusprotocol/aggregator-sdk";

const suiEnv = "mainnet";

export const suiClient = new SuiClient({
  url: getFullnodeUrl(suiEnv),
});

export interface TradingPairInfo {
  id: string;
  name: string;
  baseCoin: string;
  baseCoinId: string;
  quoteCoin: string;
  quoteCoinId: string;
  pair: string;
}

export interface MarketDataInfo {
  price: number;
  volume24h: number;
  marketCap: number;
  change24h: number;
  volatility: number;
  liquidity: number;
  poolId: string;
}

export interface OrderInfo {
  orderId: string;
  isBid: boolean;
  normalized_price: number;
  quantity: number;
  filled_quantity: number;
}

let tradingPairsCache: TradingPairInfo[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 600000; // 1 hour cache

/**
 * Get all available trading pairs from DeepBook
 * @returns Array of trading pairs
 */
export async function getAllTradingPairs(): Promise<TradingPairInfo[]> {
  const now = Date.now();

  if (tradingPairsCache.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return tradingPairsCache;
  }

  try {
    const network = suiEnv === "mainnet" ? "mainnet" : "testnet";
    const poolsUrl = `https://deepbook-indexer.${network}.mystenlabs.com/get_pools`;
    const poolsResponse = await fetch(poolsUrl);
    const poolsData = await poolsResponse.json();
    console.log("Fetched pools data:", poolsData);

    const tradingPairs = poolsData.map((pool: any) => {
      return {
        id: pool.pool_id,
        name: pool.pool_name,
        baseCoin: pool.base_asset_symbol,
        baseCoinId: pool.base_asset_id,
        quoteCoin: pool.quote_asset_symbol,
        quoteCoinId: pool.quote_asset_id,
        pair: `${pool.base_asset_symbol}/${pool.quote_asset_symbol}`,
      };
    });

    tradingPairsCache = tradingPairs;
    lastFetchTime = now;

    return tradingPairs;
  } catch (error) {
    console.error("Error fetching trading pairs:", error);
    return [];
  }
}

export interface MarketSummary {
  lowest_ask: number;
  base_currency: string;
  quote_volume: number;
  trading_pairs: string;
  highest_bid: number;
  base_volume: number;
  highest_price_24h: number;
  quote_currency: string;
  price_change_percent_24h: number;
  last_price: number;
  lowest_price_24h: number;
}

/**
 * Fetch market data from DeepBook indexer
 * @returns Raw market data from the indexer
 */
export async function fetchMarketData(): Promise<MarketSummary[]> {
  const network = suiEnv === "mainnet" ? "mainnet" : "testnet";
  const tickerUrl = `https://deepbook-indexer.${network}.mystenlabs.com/summary`;

  const tickerResponse = await fetch(tickerUrl);
  return tickerResponse.json();
}

/**
 * Get market data for a specific trading pair
 * @param poolName The pool Name of the trading pair
 * @returns Market data including price, volume, etc.
 */
export async function getMarketData(
  poolName: string,
  tickerData: MarketSummary[]
): Promise<MarketDataInfo> {
  try {
    const tickerInfo = tickerData.find((t: any) =>
      t.trading_pairs.includes(poolName)
    );
    if (!tickerInfo) {
      throw new Error(`Ticker info for pool ${poolName} not found`);
    }

    const price = Number(tickerInfo.last_price) || 0;
    const volume24h = Number(tickerInfo.quote_volume) || 0;
    // const baseVolume = Number(tickerInfo.base_volume) || 0;
    const change24h = Number(tickerInfo.price_change_percent_24h) || 0;

    // Calculate liquidity score based on bid-ask spread
    const highestBid = Number(tickerInfo.highest_bid) || 0;
    const lowestAsk = Number(tickerInfo.lowest_ask) || 0;
    const spreadPercentage =
      lowestAsk > 0 ? (lowestAsk - highestBid) / lowestAsk : 1;
    const liquidityScore = Math.max(0, Math.min(1, 1 - spreadPercentage));

    return {
      price,
      volume24h,
      marketCap: volume24h * price, // More accurate market cap calculation
      change24h,
      volatility: Math.abs(change24h / 100),
      liquidity: liquidityScore,
      poolId: poolName,
    };
  } catch (error) {
    console.error("Error fetching market data:", error);
    throw error;
  }
}

export class OrderBook {
  private client: AggregatorClient;

  constructor(address: string) {
    this.client = new AggregatorClient({
      client: suiClient,
      signer: address,
    });
  }

  async placeOrder(
    txb: Transaction,
    from: string,
    target: string,
    isBid: boolean,
    amount: string
  ) {
    console.log(
      `Placing ${
        isBid ? "buy" : "sell"
      } order for ${from} - ${target} using aggregator`
    );
    const res = await this.client.findRouters({
      from,
      target,
      amount,
      byAmountIn: isBid,
      depth: 3,
    });
    if (!res || !res.routes || res.routes.length === 0) {
      throw new Error("No routes found for the order");
    }
    console.log("Found routes:", res.routes);
    await this.client.fastRouterSwap({
      routers: res.routes,
      byAmountIn: isBid,
      txb,
      slippage: 0.02,
      refreshAllCoins: true,
    });
  }
}
