import { useCallback, useEffect, useRef, useState } from "react";
import {
  simulateMonteCarlo,
  type MonteCarloInput,
  type MonteCarloResult,
} from "./simulate-monte-carlo";

export type { MonteCarloInput, MonteCarloResult };

const DEBOUNCE_MS = 300;

export function useMonteCarloSimulator(input: MonteCarloInput): [MonteCarloResult, () => void] {
  const [result, setResult] = useState<MonteCarloResult>(() => simulateMonteCarlo(input));
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isFirstRef = useRef(true);
  const immediateNextRef = useRef(false);
  const inputJson = JSON.stringify(input);

  const requestImmediate = useCallback(() => {
    immediateNextRef.current = true;
  }, []);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }
    clearTimeout(timerRef.current);
    if (immediateNextRef.current) {
      immediateNextRef.current = false;
      setResult(simulateMonteCarlo(input));
    } else {
      timerRef.current = setTimeout(() => {
        setResult(simulateMonteCarlo(input));
      }, DEBOUNCE_MS);
    }
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputJson]);

  return [result, requestImmediate];
}
