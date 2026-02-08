import { useMemo } from "react";
import {
  calculateCompound,
  type CompoundCalculatorInput,
  type YearlyProjection,
} from "./calculate-compound";

export type { CompoundCalculatorInput, YearlyProjection };

export function useCompoundCalculator(input: CompoundCalculatorInput): YearlyProjection[] {
  return useMemo(
    () => calculateCompound(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(input),
  );
}
