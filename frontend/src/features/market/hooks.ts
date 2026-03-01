import { useQuery } from "@tanstack/react-query";
import { getMarketSummary } from "@/features/market/api";
import { queryKeys } from "@/lib/query/keys";

export function useMarketSummary(symbol: string) {
  return useQuery({
    queryKey: queryKeys.market.summary(symbol),
    queryFn: () => getMarketSummary(symbol),
    refetchInterval: 5000,
  });
}
