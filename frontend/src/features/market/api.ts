import type { MarketSummary } from "@/features/market/types";

export async function getMarketSummary(symbol: string): Promise<MarketSummary> {
  // TODO: backend endpoint 연결 시 이 함수 내부를 교체
  await new Promise((resolve) => setTimeout(resolve, 150));

  return {
    symbol,
    currentPrice: 151230000,
    changeRate: 2.34,
  };
}
