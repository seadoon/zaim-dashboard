"use client";

import { Calculator } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "../../../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { MetricLabel } from "../../ui/metric-label";
import { NumberField } from "../../ui/number-field";
import { Slider } from "../../ui/slider";
import { Switch } from "../../ui/switch";
import { chartTooltipStyle } from "../chart-tooltip";
import {
  getLabelMap,
  selectMilestones,
  computeSummaryYear,
  computeMonthlyWithdrawalForSummary,
  computeMcDrawdownEndValue,
  computeTotalWithdrawalAmount,
  buildFanChartData,
  computeTotalYears,
  computeWithdrawalMilestones,
} from "./compound-simulator-utils";
import { generateSummary } from "./generate-summary";
import { useCompoundCalculator } from "./use-compound-calculator";
import { useMonteCarloSimulator } from "./use-monte-carlo-simulator";

interface PortfolioContext {
  initialAmountSource?: string;
  monthlyContributionSource?: string;
  annualReturnRateSource?: string;
  currentTotalAssets?: number;
  savingsRate?: number;
}

type WithdrawalMode = "rate" | "amount";

interface CompoundSimulatorProps {
  defaultInitialAmount?: number;
  defaultMonthlyContribution?: number;
  defaultAnnualReturnRate?: number;
  defaultInflationRate?: number;
  defaultWithdrawalMode?: WithdrawalMode;
  defaultWithdrawalRate?: number;
  defaultMonthlyWithdrawal?: number;
  defaultWithdrawalYears?: number;
  title?: string;
  portfolioContext?: PortfolioContext;
}

type PhaseType = "contribution" | "idle" | "withdrawal" | "overlap";

function buildTimelineSegments(
  contributionYears: number,
  withdrawalStartYear: number,
  withdrawalYears: number,
): Array<{ type: PhaseType; start: number; end: number }> {
  const withdrawalEnd = withdrawalStartYear + withdrawalYears;
  const totalYears = Math.max(contributionYears, withdrawalEnd);
  const segments: Array<{ type: PhaseType; start: number; end: number }> = [];

  for (let y = 0; y < totalYears; y++) {
    const isContrib = y < contributionYears;
    const isWithdraw = withdrawalYears > 0 && y >= withdrawalStartYear && y < withdrawalEnd;

    let type: PhaseType;
    if (isContrib && isWithdraw) type = "overlap";
    else if (isContrib) type = "contribution";
    else if (isWithdraw) type = "withdrawal";
    else type = "idle";

    const last = segments.at(-1);
    if (last && last.type === type) {
      last.end = y + 1;
    } else {
      segments.push({ type, start: y, end: y + 1 });
    }
  }

  return segments;
}

const phaseChipStyles: Record<PhaseType, string> = {
  contribution: "bg-primary/10 text-primary",
  idle: "bg-muted-foreground/10",
  withdrawal: "bg-destructive/10 text-destructive",
  overlap: "bg-purple-600/10 text-purple-600",
};

const phaseLabels: Record<PhaseType, string> = {
  contribution: "積立",
  idle: "据え置き",
  withdrawal: "切り崩し",
  overlap: "積立+切り崩し",
};

function TimelinePhaseChips({
  contributionYears,
  withdrawalStartYear,
  withdrawalYears,
  currentYear,
}: {
  contributionYears: number;
  withdrawalStartYear: number;
  withdrawalYears: number;
  currentYear: number;
}) {
  const segments = buildTimelineSegments(contributionYears, withdrawalStartYear, withdrawalYears);
  if (segments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {segments.map((seg, i) => (
        <Fragment key={`${seg.type}-${seg.start}`}>
          {i > 0 && <span>→</span>}
          <span className={`rounded px-2 py-0.5 font-medium ${phaseChipStyles[seg.type]}`}>
            {phaseLabels[seg.type]} {seg.end - seg.start}年
            <span className="ml-1 text-muted-foreground">
              ({currentYear + seg.start}〜{currentYear + seg.end})
            </span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

type DragHandle = "contribution" | "withdrawalStart" | "withdrawalEnd";

function InteractiveTimelineBar({
  contributionYears,
  withdrawalStartYear,
  withdrawalYears,
  onContributionYearsChange,
  onWithdrawalStartYearChange,
  onWithdrawalYearsChange,
}: {
  contributionYears: number;
  withdrawalStartYear: number;
  withdrawalYears: number;
  onContributionYearsChange: (v: number) => void;
  onWithdrawalStartYearChange: (v: number) => void;
  onWithdrawalYearsChange: (v: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<DragHandle | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragHandle | null>(null);

  const displayMax = 70;
  const currentYear = new Date().getFullYear();
  const withdrawalEnd = withdrawalStartYear + withdrawalYears;
  const totalYears = Math.max(contributionYears, withdrawalEnd);

  const yearToPercent = (year: number) => (year / displayMax) * 100;

  function getYearFromClientX(clientX: number) {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * displayMax);
  }

  const segments = buildTimelineSegments(contributionYears, withdrawalStartYear, withdrawalYears);

  const barColorMap: Record<PhaseType, string> = {
    contribution: "bg-blue-700",
    withdrawal: "bg-orange-700",
    overlap: "bg-purple-700",
    idle: "bg-gray-600",
  };

  const handles: Array<{ id: DragHandle; pos: number; color: string }> = [
    { id: "contribution", pos: contributionYears, color: "bg-blue-700" },
    { id: "withdrawalStart", pos: withdrawalStartYear, color: "bg-orange-700" },
    { id: "withdrawalEnd", pos: withdrawalEnd, color: "bg-orange-700" },
  ];

  function handlePointerDown(e: React.PointerEvent) {
    if (!barRef.current) return;
    const year = getYearFromClientX(e.clientX);

    let closest = handles[0];
    for (const h of handles) {
      if (Math.abs(year - h.pos) < Math.abs(year - closest.pos)) {
        closest = h;
      }
    }

    e.preventDefault();
    barRef.current.setPointerCapture(e.pointerId);
    draggingRef.current = closest.id;
    setActiveDrag(closest.id);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const year = getYearFromClientX(e.clientX);

    switch (draggingRef.current) {
      case "contribution":
        onContributionYearsChange(Math.max(0, Math.min(displayMax, year)));
        break;
      case "withdrawalStart":
        onWithdrawalStartYearChange(Math.max(0, Math.min(displayMax - 5, year)));
        break;
      case "withdrawalEnd": {
        const newYears = year - withdrawalStartYear;
        onWithdrawalYearsChange(Math.max(5, Math.min(displayMax - withdrawalStartYear, newYears)));
        break;
      }
    }
  }

  function handlePointerUp() {
    draggingRef.current = null;
    setActiveDrag(null);
  }

  return (
    <div className="space-y-1">
      <div
        ref={barRef}
        className={`relative h-9 w-full overflow-hidden rounded-md bg-muted select-none touch-none ${activeDrag ? "cursor-col-resize" : "cursor-pointer"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="タイムライン設定"
      >
        {segments.map((seg) => {
          const widthPercent = yearToPercent(seg.end - seg.start);
          const years = seg.end - seg.start;
          return (
            <div
              key={`${seg.type}-${seg.start}`}
              className={`absolute top-0 h-full flex items-center justify-center text-xs font-medium text-white ${barColorMap[seg.type]}`}
              style={{
                left: `${yearToPercent(seg.start)}%`,
                width: `${widthPercent}%`,
              }}
            >
              {widthPercent > 12 ? `${phaseLabels[seg.type]} ${years}年` : ""}
            </div>
          );
        })}
        {handles.map((h) => (
          <div
            key={h.id}
            className="absolute top-0 h-full pointer-events-none"
            style={{ left: `${yearToPercent(h.pos)}%` }}
          >
            <div
              className={`absolute -translate-x-1/2 top-0 h-full ${activeDrag === h.id ? "w-1" : "w-0.5"} ${h.color} transition-[width]`}
            />
            <div
              className={`absolute -translate-x-1/2 top-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${activeDrag === h.id ? "h-4 w-4" : "h-3 w-3"} ${h.color} transition-[width,height]`}
            />
          </div>
        ))}
      </div>
      <div className="relative h-5 text-xs text-muted-foreground">
        <span className="absolute left-0">{currentYear}年</span>
        {handles.map((h) => {
          const pct = yearToPercent(h.pos);
          if (pct < 3 || pct > 97) return null;
          return (
            <span
              key={h.id}
              className="absolute -translate-x-1/2 font-medium"
              style={{ left: `${pct}%` }}
            >
              {currentYear + h.pos}年
            </span>
          );
        })}
        <span className="absolute right-0">{currentYear + displayMax}年</span>
      </div>
      <TimelinePhaseChips
        contributionYears={contributionYears}
        withdrawalStartYear={withdrawalStartYear}
        withdrawalYears={withdrawalYears}
        currentYear={currentYear}
      />
    </div>
  );
}

export function CompoundSimulator({
  defaultInitialAmount = 0,
  defaultMonthlyContribution = 0,
  defaultAnnualReturnRate = 5,
  defaultInflationRate = 2,
  defaultWithdrawalMode = "amount",
  defaultWithdrawalRate = 4,
  defaultMonthlyWithdrawal = 200000,
  defaultWithdrawalYears = 30,
  title = "複利シミュレーター",
  portfolioContext,
}: CompoundSimulatorProps) {
  const [initialAmount, setInitialAmount] = useState(defaultInitialAmount);
  const [monthlyContribution, setMonthlyContribution] = useState(defaultMonthlyContribution);
  const [annualReturnRate, setAnnualReturnRate] = useState(defaultAnnualReturnRate);
  const [expenseRatio, setExpenseRatio] = useState(0.1);
  const [inflationRate, setInflationRate] = useState(defaultInflationRate);
  const [contributionYears, setContributionYears] = useState(30);
  const [withdrawalStartYear, setWithdrawalStartYear] = useState(30);
  const [withdrawalYears, setWithdrawalYears] = useState(defaultWithdrawalYears);
  const [volatility, setVolatility] = useState(15);
  const [taxFree, setTaxFree] = useState(false);
  const [withdrawalMode, setWithdrawalMode] = useState<WithdrawalMode>(defaultWithdrawalMode);
  const [withdrawalRate, setWithdrawalRate] = useState(defaultWithdrawalRate);
  const [fixedMonthlyWithdrawal, setFixedMonthlyWithdrawal] = useState(defaultMonthlyWithdrawal);
  const [inflationAdjustedWithdrawal, setInflationAdjustedWithdrawal] = useState(false);
  const [monthlyPensionIncome, setMonthlyPensionIncome] = useState(0);
  const [drawdownPercentile, setDrawdownPercentile] = useState<
    "p10" | "p25" | "p50" | "p75" | "p90"
  >("p50");

  const projections = useCompoundCalculator({
    initialAmount,
    monthlyContribution,
    annualReturnRate,
    contributionYears,
    withdrawalStartYear,
    withdrawalYears,
    taxFree,
    ...(withdrawalMode === "rate"
      ? { annualWithdrawalRate: withdrawalRate }
      : { monthlyWithdrawal: fixedMonthlyWithdrawal }),
    expenseRatio,
    inflationRate,
    inflationAdjustedWithdrawal: withdrawalMode === "amount" ? inflationAdjustedWithdrawal : false,
    monthlyPensionIncome,
  });

  const currentYear = new Date().getFullYear();
  const summaryYear = computeSummaryYear(contributionYears, withdrawalStartYear, withdrawalYears);
  const contributionEnd =
    projections.find((p) => p.year === summaryYear) ?? projections.find((p) => p.year === 0);

  const [monteCarlo, requestImmediateMC] = useMonteCarloSimulator({
    initialAmount,
    monthlyContribution,
    annualReturnRate,
    volatility,
    inflationRate,
    contributionYears,
    withdrawalStartYear,
    withdrawalYears,
    taxFree,
    ...(withdrawalMode === "rate"
      ? { annualWithdrawalRate: withdrawalRate }
      : { monthlyWithdrawal: fixedMonthlyWithdrawal }),
    expenseRatio,
    inflationAdjustedWithdrawal: withdrawalMode === "amount" ? inflationAdjustedWithdrawal : false,
    monthlyPensionIncome,
  });

  const fanChartData = buildFanChartData(monteCarlo.yearlyData);

  const labelMap = getLabelMap(taxFree);

  const mcDrawdownEndValue = computeMcDrawdownEndValue(
    withdrawalYears,
    monteCarlo.yearlyData,
    drawdownPercentile,
  );

  const monthlyWithdrawalForSummary = computeMonthlyWithdrawalForSummary(
    withdrawalMode,
    projections,
    withdrawalStartYear,
    fixedMonthlyWithdrawal,
  );

  const withdrawalMilestones =
    withdrawalMode === "rate"
      ? computeWithdrawalMilestones(withdrawalYears, withdrawalStartYear, projections)
      : undefined;

  const summary = contributionEnd
    ? generateSummary({
        initialAmount,
        monthlyContribution,
        annualReturnRate,
        contributionYears,
        withdrawalStartYear,
        withdrawalYears,
        finalTotal: contributionEnd.total,
        finalPrincipal: contributionEnd.principal,
        finalInterest: contributionEnd.interest,
        monthlyWithdrawal: monthlyWithdrawalForSummary,
        drawdownFinalTotal: mcDrawdownEndValue,
        depletionProbability: monteCarlo.depletionProbability,
        taxFree,
        withdrawalMode,
        withdrawalRate,
        expenseRatio,
        withdrawalMilestones,
      })
    : null;

  const milestones = selectMilestones(contributionEnd?.total ?? 0);

  const totalWithdrawalAmount = computeTotalWithdrawalAmount(withdrawalYears, projections);

  const totalYears = computeTotalYears(contributionYears, withdrawalStartYear, withdrawalYears);

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={Calculator}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4 space-y-4">
          <InteractiveTimelineBar
            contributionYears={contributionYears}
            withdrawalStartYear={withdrawalStartYear}
            withdrawalYears={withdrawalYears}
            onContributionYearsChange={setContributionYears}
            onWithdrawalStartYearChange={setWithdrawalStartYear}
            onWithdrawalYearsChange={setWithdrawalYears}
          />

          <div>
            <span className="text-sm font-medium">積立設定</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-2">
              <MetricLabel title="初期投資額" />
              <NumberField
                id="initial-amount"
                value={initialAmount}
                onValueChange={(v) => setInitialAmount(v ?? 0)}
                min={0}
                step={10000}
                largeStep={100000}
                suffix="円"
                aria-label="初期投資額"
              />
            </div>

            <div className="space-y-2">
              <MetricLabel title="月額積立額" />
              <NumberField
                id="monthly-contribution"
                value={monthlyContribution}
                onValueChange={(v) => setMonthlyContribution(v ?? 0)}
                min={0}
                step={1000}
                largeStep={10000}
                suffix="円"
                aria-label="月額積立額"
                disabled={contributionYears === 0}
              />
              {portfolioContext?.monthlyContributionSource && (
                <p className="text-xs text-muted-foreground">
                  {portfolioContext.monthlyContributionSource}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <MetricLabel
                  title="想定利回り"
                  description={
                    <div className="space-y-1.5">
                      <p>配当再投資込みのトータルリターン（年率）を入力してください。</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-1 text-left font-medium">指数</th>
                            <th className="pb-1 text-right font-medium">過去平均</th>
                          </tr>
                        </thead>
                        <tbody className="tabular-nums">
                          <tr>
                            <td>S&amp;P500（配当込み）</td>
                            <td className="text-right">約10%</td>
                          </tr>
                          <tr>
                            <td>全世界株式（配当込み）</td>
                            <td className="text-right">約7〜8%</td>
                          </tr>
                          <tr>
                            <td>バランス型（株60/債40）</td>
                            <td className="text-right">約5〜6%</td>
                          </tr>
                          <tr>
                            <td>債券中心</td>
                            <td className="text-right">約2〜4%</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-xs text-muted-foreground">
                        ※過去実績であり将来を保証するものではありません
                      </p>
                    </div>
                  }
                />
                <span className="text-sm font-semibold text-primary">{annualReturnRate}%</span>
              </div>
              <Slider
                value={annualReturnRate}
                onValueChange={setAnnualReturnRate}
                min={0}
                max={15}
                step={0.5}
                aria-label="想定利回り"
                ticks={[
                  { value: 0, label: "0%" },
                  { value: 5, label: "5%" },
                  { value: 10, label: "10%" },
                  { value: 15, label: "15%" },
                ]}
              />
              {portfolioContext?.annualReturnRateSource && (
                <p className="text-xs text-muted-foreground">
                  {portfolioContext.annualReturnRateSource}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <MetricLabel
                  title="信託報酬"
                  description={
                    <div className="space-y-1.5">
                      <p>
                        投資信託の年間運用コスト。想定利回りから差し引かれて実質リターンを計算します。
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-1 text-left font-medium">ファンド</th>
                            <th className="pb-1 text-right font-medium">信託報酬</th>
                          </tr>
                        </thead>
                        <tbody className="tabular-nums">
                          <tr>
                            <td>eMAXIS Slim 全世界株式</td>
                            <td className="text-right">0.05775%</td>
                          </tr>
                          <tr>
                            <td>eMAXIS Slim S&amp;P500</td>
                            <td className="text-right">0.0814%</td>
                          </tr>
                          <tr>
                            <td>SBI・V・S&amp;P500</td>
                            <td className="text-right">0.0938%</td>
                          </tr>
                          <tr>
                            <td>たわらノーロード 先進国株式</td>
                            <td className="text-right">0.0989%</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-xs text-muted-foreground">※税込、2026年時点</p>
                    </div>
                  }
                />
                <span className="text-sm text-right">
                  <span className="font-semibold text-primary">{expenseRatio}%</span>
                  <span className="text-xs text-muted-foreground">
                    （実質 {(annualReturnRate - expenseRatio).toFixed(1)}%）
                  </span>
                </span>
              </div>
              <Slider
                value={expenseRatio}
                onValueChange={setExpenseRatio}
                min={0}
                max={3}
                step={0.01}
                aria-label="信託報酬"
                ticks={[
                  { value: 0, label: "0%" },
                  { value: 1, label: "1%" },
                  { value: 2, label: "2%" },
                  { value: 3, label: "3%" },
                ]}
              />
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">切り崩し設定</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-2">
              {withdrawalMode === "rate" ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <MetricLabel
                      title="年間引出率"
                      description="切り崩し開始時の資産×X%で年間引出額を決定し、以降毎年同額を取り崩す定額方式（4%ルール/トリニティ・スタディ準拠）。モンテカルロの結果はインフレ調整済み（実質値）で表示されます"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          requestImmediateMC();
                          setWithdrawalMode("amount");
                        }}
                      >
                        金額指定
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground"
                        onClick={() => {
                          requestImmediateMC();
                          setWithdrawalMode("rate");
                        }}
                      >
                        %指定
                      </button>
                    </div>
                  </div>
                  <NumberField
                    id="withdrawal-rate"
                    value={withdrawalRate}
                    onValueChange={(v) => setWithdrawalRate(v ?? 0)}
                    min={0}
                    max={20}
                    step={0.5}
                    suffix="%"
                    aria-label="年間引出率"
                  />
                  <p className="text-xs text-muted-foreground">
                    年額
                    <span className="font-semibold">
                      約{formatCurrency(monthlyWithdrawalForSummary * 12)}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <MetricLabel title="月額引出額" />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground"
                        onClick={() => {
                          requestImmediateMC();
                          setWithdrawalMode("amount");
                        }}
                      >
                        金額指定
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          requestImmediateMC();
                          setWithdrawalMode("rate");
                        }}
                      >
                        %指定
                      </button>
                    </div>
                  </div>
                  <NumberField
                    id="monthly-withdrawal"
                    value={fixedMonthlyWithdrawal}
                    onValueChange={(v) => setFixedMonthlyWithdrawal(v ?? 0)}
                    min={0}
                    step={10000}
                    largeStep={50000}
                    suffix="円"
                    aria-label="月額引出額"
                  />
                  <p className="text-xs text-muted-foreground">
                    年額 {formatCurrency(fixedMonthlyWithdrawal * 12)}
                  </p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <MetricLabel
                title="年金等の月収"
                description="厚生年金の平均受給額は約14.6万円/月、国民年金のみの場合は約5.6万円/月が目安です（2025年度実績）"
              />
              <NumberField
                id="pension-income"
                value={monthlyPensionIncome}
                onValueChange={(v) => setMonthlyPensionIncome(v ?? 0)}
                min={0}
                step={10000}
                largeStep={50000}
                suffix="円"
                aria-label="年金等の月収"
              />
              <p className="text-xs text-muted-foreground">引出額から差し引かれます</p>
            </div>
            <div className="flex items-center gap-3 self-center">
              <Switch
                checked={!taxFree}
                onCheckedChange={(v) => {
                  requestImmediateMC();
                  setTaxFree(!v);
                }}
                aria-label="税金を含めて計算"
              />
              <MetricLabel
                title="税金を含めて計算"
                description="運用益にかかる税金（20.315%）を含めてシミュレーション"
              />
            </div>
            {withdrawalMode === "amount" && (
              <div className="flex items-center gap-3 self-center">
                <Switch
                  checked={inflationAdjustedWithdrawal}
                  onCheckedChange={(v) => {
                    requestImmediateMC();
                    setInflationAdjustedWithdrawal(v);
                  }}
                  aria-label="引出額をインフレ調整"
                />
                <MetricLabel
                  title="引出額をインフレ調整"
                  description={`毎年インフレ率（${inflationRate}%）分だけ引出額を増加させます`}
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 space-y-4">
          {/* Timeline header */}
          <TimelinePhaseChips
            contributionYears={contributionYears}
            withdrawalStartYear={withdrawalStartYear}
            withdrawalYears={withdrawalYears}
            currentYear={currentYear}
          />

          {/* Accumulation results */}
          <div
            className={`grid gap-4 grid-cols-2 ${taxFree ? "md:grid-cols-3" : "md:grid-cols-4"}`}
          >
            <div>
              <MetricLabel title="元本合計" description="初期投資額 + 月額積立額の合計" />
              <div className="text-lg font-semibold">
                {formatCurrency(contributionEnd?.principal ?? 0)}
              </div>
            </div>
            <div>
              <MetricLabel
                title={taxFree ? "運用益" : "運用益（税引後）"}
                description={
                  taxFree
                    ? "複利で得られる利益（非課税）"
                    : "複利で得られる利益から税金を差し引いた額"
                }
              />
              <div className="text-lg font-semibold text-balance-positive">
                {formatCurrency(contributionEnd?.interest ?? 0)}
              </div>
            </div>
            {!taxFree && (
              <div>
                <MetricLabel
                  title="税金"
                  description={
                    <>
                      運用益 × 20.315%
                      <br />
                      （所得税15.315% + 住民税5%）
                    </>
                  }
                />
                <div className="text-lg font-semibold text-expense">
                  {formatCurrency(contributionEnd?.tax ?? 0)}
                </div>
              </div>
            )}
            <div>
              <MetricLabel
                title={taxFree ? "合計" : "手取り合計"}
                description={taxFree ? "元本合計 + 運用益" : "元本合計 + 運用益（税引後）"}
              />
              <div className="text-lg font-semibold">
                {formatCurrency(contributionEnd?.total ?? 0)}
              </div>
            </div>
          </div>

          {/* Drawdown results */}
          {withdrawalYears > 0 && (
            <>
              <div className="border-t pt-4" />
              <div className="flex items-center justify-end gap-1">
                <span className="mr-1 text-xs text-muted-foreground">悲観</span>
                {(["p10", "p25", "p50", "p75", "p90"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDrawdownPercentile(p)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      drawdownPercentile === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <span className="ml-1 text-xs text-muted-foreground">楽観</span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <MetricLabel
                    title="切り崩し後の残額"
                    description="5,000回モンテカルロ・シミュレーションの結果。選択したパーセンタイルに応じた残額を表示します"
                  />
                  <div className="text-lg font-semibold">
                    {formatCurrency(mcDrawdownEndValue ?? 0)}
                  </div>
                </div>
                <div>
                  <MetricLabel title="総引出額" description="月額引出額 × 12ヶ月 × 切り崩し年数" />
                  <div className="text-lg font-semibold text-expense">
                    {formatCurrency(totalWithdrawalAmount)}
                  </div>
                </div>
                <div>
                  <MetricLabel
                    title="元本割れ確率"
                    description="5,000回シミュレーションのうち、シミュレーション終了時に総額が元本を下回ったシナリオの割合"
                  />
                  <div
                    className={`text-lg font-semibold ${
                      monteCarlo.failureProbability > 0.2
                        ? "text-expense"
                        : monteCarlo.failureProbability > 0.05
                          ? "text-amber-700"
                          : "text-balance-positive"
                    }`}
                  >
                    {(monteCarlo.failureProbability * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <MetricLabel
                    title="枯渇確率"
                    description="5,000回シミュレーションのうち、切り崩し期間中に資金がゼロになったシナリオの割合"
                  />
                  <div
                    className={`text-lg font-semibold ${
                      monteCarlo.depletionProbability > 0.2
                        ? "text-expense"
                        : monteCarlo.depletionProbability > 0.05
                          ? "text-amber-700"
                          : "text-balance-positive"
                    }`}
                  >
                    {(monteCarlo.depletionProbability * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              {monteCarlo.distribution.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    シミュレーション終了時の資産分布（5,000パス）
                  </p>
                  <div
                    key={monteCarlo.distribution.map((b) => b.count).join(",")}
                    className="space-y-0.5"
                  >
                    {(() => {
                      const bins = monteCarlo.distribution.filter((b) => b.count > 0);
                      const maxCount = Math.max(...bins.map((b) => b.count));
                      const selectedVal = mcDrawdownEndValue ?? 0;
                      const formatBin = (v: number) =>
                        v >= 100_000_000
                          ? `${(v / 100_000_000).toFixed(1)}億`
                          : `${Math.round(v / 10_000).toLocaleString("ja-JP")}万`;
                      // Find which bin the selected percentile falls into
                      let activeBinIdx = -1;
                      for (let idx = 0; idx < bins.length; idx++) {
                        const b = bins[idx];
                        if (b.isDepleted && selectedVal <= 0) {
                          activeBinIdx = idx;
                          break;
                        }
                        if (!b.isDepleted) {
                          const prevEnd =
                            idx > 0 && !bins[idx - 1].isDepleted ? bins[idx - 1].rangeEnd : 0;
                          if (selectedVal > prevEnd && selectedVal <= b.rangeEnd) {
                            activeBinIdx = idx;
                            break;
                          }
                        }
                      }
                      // If not found (value exceeds last bin), highlight last bin
                      if (activeBinIdx === -1 && bins.length > 0) {
                        activeBinIdx = bins.length - 1;
                      }
                      return bins.map((bin, i) => {
                        const pct = (bin.count / 5000) * 100;
                        const isActive = i === activeBinIdx;
                        const label = bin.isDepleted ? "0円(枯渇)" : `〜${formatBin(bin.rangeEnd)}`;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span
                              className={`w-20 shrink-0 text-right tabular-nums ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                            >
                              {label}
                            </span>
                            <div className="h-3.5 flex-1 overflow-hidden rounded-sm bg-muted/30">
                              <div
                                className={`h-full origin-left rounded-sm ${
                                  bin.isDepleted
                                    ? "bg-destructive"
                                    : isActive
                                      ? "bg-primary"
                                      : "bg-primary/40"
                                }`}
                                style={{
                                  width: `${maxCount > 0 ? (bin.count / maxCount) * 100 : 0}%`,
                                  animation: `grow-bar 0.6s ease-out ${i * 40}ms both`,
                                }}
                              />
                            </div>
                            <span
                              className={`w-10 shrink-0 text-right tabular-nums ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                            >
                              {pct >= 1 ? `${pct.toFixed(0)}%` : pct > 0 ? "<1%" : "0%"}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {summary && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">{summary}</div>
        )}

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={projections} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}年`}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(value as number),
                labelMap[name as string] ?? name,
              ]}
              labelFormatter={(label) => {
                const entry = projections.find((p) => p.year === label);
                if (entry?.isContributing && entry?.isWithdrawing)
                  return `${label}年後（積立+切り崩し）`;
                if (entry?.isWithdrawing) return `${label}年後（切り崩し）`;
                return `${label}年後`;
              }}
              contentStyle={chartTooltipStyle}
            />
            <Legend formatter={(value) => labelMap[value] ?? value} />
            <Area
              type="monotone"
              dataKey="principal"
              stackId="1"
              stroke="var(--color-chart-1)"
              fill="color-mix(in oklch, var(--color-chart-1) 30%, transparent)"
              name="principal"
            />
            <Area
              type="monotone"
              dataKey="interest"
              stackId="1"
              stroke="var(--color-chart-2)"
              fill="color-mix(in oklch, var(--color-chart-2) 40%, transparent)"
              name="interest"
            />
            <Area
              type="monotone"
              dataKey="tax"
              stackId="1"
              stroke="var(--color-chart-4)"
              fill="color-mix(in oklch, var(--color-chart-4) 35%, transparent)"
              name="tax"
            />
            {contributionYears > 0 && contributionYears < withdrawalStartYear && (
              <ReferenceLine
                x={contributionYears}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: "積立終了",
                  position: "top",
                  fontSize: 11,
                  fill: "var(--color-muted-foreground)",
                }}
              />
            )}
            {withdrawalYears > 0 && withdrawalStartYear < totalYears && (
              <ReferenceLine
                x={withdrawalStartYear}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: "切り崩し開始",
                  position: "top",
                  fontSize: 11,
                  fill: "var(--color-muted-foreground)",
                }}
              />
            )}
            {milestones.map((m) => (
              <ReferenceLine
                key={m}
                y={m}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: `${(m / 10_000).toLocaleString("ja-JP")}万円`,
                  position: "right",
                  fontSize: 11,
                  fill: "var(--color-muted-foreground)",
                }}
              />
            ))}
            {portfolioContext?.currentTotalAssets != null && (
              <ReferenceLine
                y={portfolioContext.currentTotalAssets}
                stroke="var(--color-primary)"
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                label={{
                  value: "現在の総資産",
                  position: "insideBottomLeft",
                  fontSize: 11,
                  fill: "var(--color-primary)",
                  offset: 6,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Monte Carlo section */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-semibold">モンテカルロ・シミュレーション</h3>
              <p className="text-xs text-muted-foreground">
                5,000通りのシナリオに基づく将来予測（インフレ調整済み
                {taxFree ? " / 非課税" : ""}
                {withdrawalYears > 0 && !taxFree ? " / 切り崩し: 税引後" : ""}）
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:flex md:items-center md:gap-4">
              <div className="space-y-1 md:w-32">
                <div className="flex items-center justify-between">
                  <MetricLabel
                    title="インフレ率"
                    description="物価上昇による実質リターンの目減り分。モンテカルロのドリフト項から差し引かれます"
                  />
                  <span className="text-xs font-semibold text-primary">{inflationRate}%</span>
                </div>
                <Slider
                  value={inflationRate}
                  onValueChange={setInflationRate}
                  min={0}
                  max={10}
                  step={0.5}
                  aria-label="インフレ率"
                  ticks={[
                    { value: 0, label: "0%" },
                    { value: 5, label: "5%" },
                    { value: 10, label: "10%" },
                  ]}
                />
              </div>
              <div className="space-y-1 md:w-40">
                <div className="flex items-center justify-between">
                  <MetricLabel
                    title="ボラティリティ"
                    description={
                      <div className="space-y-1.5">
                        <p>年率の価格変動幅。値が大きいほどリターンのばらつきが大きくなります。</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="pb-1 text-left font-medium">資産クラス</th>
                              <th className="pb-1 text-right font-medium">目安</th>
                            </tr>
                          </thead>
                          <tbody className="tabular-nums">
                            <tr>
                              <td>全世界株式 (MSCI ACWI)</td>
                              <td className="text-right">14〜17%</td>
                            </tr>
                            <tr>
                              <td>先進国株式 (S&amp;P500等)</td>
                              <td className="text-right">15〜19%</td>
                            </tr>
                            <tr>
                              <td>バランス型 (株60/債40)</td>
                              <td className="text-right">8〜11%</td>
                            </tr>
                            <tr>
                              <td>債券中心</td>
                              <td className="text-right">3〜8%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    }
                  />
                  <span className="text-xs font-semibold text-primary">{volatility}%</span>
                </div>
                <Slider
                  value={volatility}
                  onValueChange={setVolatility}
                  min={5}
                  max={30}
                  step={1}
                  aria-label="ボラティリティ"
                  ticks={[
                    { value: 5, label: "5%" },
                    { value: 10, label: "10%" },
                    { value: 20, label: "20%" },
                    { value: 30, label: "30%" },
                  ]}
                />
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={fanChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}年`}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
              />
              <Tooltip content={<FanChartTooltip />} />
              {/* Stacked bands: base (invisible) → outer lower → inner lower → inner upper → outer upper */}
              <Area type="monotone" dataKey="base" stackId="fan" fill="transparent" stroke="none" />
              <Area
                type="monotone"
                dataKey="band_outer_lower"
                stackId="fan"
                fill="var(--color-chart-5)"
                fillOpacity={0.12}
                stroke="none"
              />
              <Area
                type="monotone"
                dataKey="band_inner_lower"
                stackId="fan"
                fill="var(--color-chart-5)"
                fillOpacity={0.22}
                stroke="none"
              />
              <Area
                type="monotone"
                dataKey="band_inner_upper"
                stackId="fan"
                fill="var(--color-chart-5)"
                fillOpacity={0.22}
                stroke="none"
              />
              <Area
                type="monotone"
                dataKey="band_outer_upper"
                stackId="fan"
                fill="var(--color-chart-5)"
                fillOpacity={0.12}
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="p50"
                stroke="var(--color-chart-5)"
                strokeWidth={2}
                dot={false}
                name="中央値"
              />
              <Line
                type="monotone"
                dataKey="principal"
                stroke="var(--color-muted-foreground)"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                name="元本"
              />
              {contributionYears > 0 && contributionYears < withdrawalStartYear && (
                <ReferenceLine
                  x={contributionYears}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: "積立終了",
                    position: "top",
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
              )}
              {withdrawalYears > 0 && withdrawalStartYear < totalYears && (
                <ReferenceLine
                  x={withdrawalStartYear}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: "切り崩し開始",
                    position: "top",
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function FanChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, number | string | boolean> }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const rows = [
    { label: "90%タイル", value: data.p90 as number },
    { label: "75%タイル", value: data.p75 as number },
    { label: "中央値", value: data.p50 as number },
    { label: "25%タイル", value: data.p25 as number },
    { label: "10%タイル", value: data.p10 as number },
    { label: "元本", value: data.principal as number },
  ];

  const isContributing = data.isContributing as boolean;
  const isWithdrawing = data.isWithdrawing as boolean;

  let labelText: string;
  if (isContributing && isWithdrawing) {
    labelText = `${label}年後（積立+切り崩し）`;
  } else if (isWithdrawing) {
    labelText = `${label}年後（切り崩し）`;
  } else {
    labelText = `${label}年後`;
  }

  const depletionRate = data.depletionRate as number | undefined;

  return (
    <div style={chartTooltipStyle} className="rounded-md border p-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{labelText}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-medium">{formatCurrency(row.value)}</span>
        </div>
      ))}
      {depletionRate != null && depletionRate > 0 && (
        <div className="mt-1 flex justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">枯渇率</span>
          <span className="font-medium text-expense">{(depletionRate * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
