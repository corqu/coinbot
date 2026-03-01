import { useQuery } from "@tanstack/react-query";
import { getActiveStrategies } from "@/features/strategy/api";

export function useActiveStrategies(enabled: boolean) {
  return useQuery({
    queryKey: ["strategies", "active"],
    queryFn: getActiveStrategies,
    enabled,
  });
}
