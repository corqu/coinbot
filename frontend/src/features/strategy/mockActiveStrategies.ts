import type { StrategySummary } from "@/features/strategy/types";

const maCrossSchema = {
  properties: {
    short_period: { type: "integer", title: "Short Period", default: 9, minimum: 2, maximum: 100 },
    long_period: { type: "integer", title: "Long Period", default: 21, minimum: 3, maximum: 200 },
    trade_qty: { type: "number", title: "Trade Qty", default: 0.01, minimum: 0.001, maximum: 10 },
    enabled: { type: "boolean", title: "Enabled", default: true },
  },
};

const fibonacciCircleSchema = {
  properties: {
    center: { type: "object", title: "center" },
    edge: { type: "object", title: "edge" },
    ratios: { type: "array", title: "ratios", default: [0.382, 0.5, 0.618, 1.0, 1.618] },
  },
};

const fibonacciChannelSchema = {
  properties: {
    a: { type: "object", title: "a" },
    b: { type: "object", title: "b" },
    c: { type: "object", title: "c" },
    ratios: { type: "array", title: "ratios", default: [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0] },
  },
};

export const mockActiveStrategies: StrategySummary[] = [
  {
    id: 9001,
    code: "moving_average_cross_v1",
    name: "이동평균 교차",
    alias: "MA Cross",
    source: "app.strategy.applied_startegy.ma_rsi_volume_strategy",
    parameterSchemaJson: JSON.stringify(maCrossSchema),
    isActive: true,
    version: "mock-1.0.0",
  },
  {
    id: 9002,
    code: "fibonacci_circles_v1",
    name: "피보나치 원",
    alias: "Fibonacci Circles",
    source: "app.strategy.applied_startegy.fibonacci.fibonacci_circles_strategy",
    parameterSchemaJson: JSON.stringify(fibonacciCircleSchema),
    isActive: true,
    version: "mock-1.0.0",
  },
  {
    id: 9003,
    code: "fibonacci_channel_v1",
    name: "피보나치 채널",
    alias: "Fibonacci Channel",
    source: "app.strategy.applied_startegy.fibonacci.fibonacci_channel_strategy",
    parameterSchemaJson: JSON.stringify(fibonacciChannelSchema),
    isActive: true,
    version: "mock-1.0.0",
  },
];
