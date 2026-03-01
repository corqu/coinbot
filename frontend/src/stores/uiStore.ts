import { create } from "zustand";

type UiStore = {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  selectedSymbol: "BTC-KRW",
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
}));
