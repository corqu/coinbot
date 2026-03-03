import { useQuery } from "@tanstack/react-query";
import { getActiveStrategies, getStrategyCatalog } from "@/features/strategy/api";

export function useActiveStrategies(enabled: boolean) {
  return useQuery({
    queryKey: ["strategies", "active"],
    queryFn: getActiveStrategies,
    enabled,
  });
}

export function useStrategyCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ["strategies", "catalog"],
    queryFn: getStrategyCatalog,
    enabled,
  });
}
