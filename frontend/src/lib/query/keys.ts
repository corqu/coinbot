export const queryKeys = {
  market: {
    summary: (symbol: string) => ["market", "summary", symbol] as const,
  },
};
