import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AmountDisplay } from "./amount-display";

const meta = {
  title: "UI/AmountDisplay",
  component: AmountDisplay,
  tags: ["autodocs"],
} satisfies Meta<typeof AmountDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: { amount: 1234567 },
};

export const Income: Story = {
  args: { amount: 500000, type: "income" },
};

export const Expense: Story = {
  args: { amount: 300000, type: "expense" },
};

export const BalancePositive: Story = {
  name: "残高（プラス）",
  args: { amount: 150000, type: "balance" },
};

export const BalanceNegative: Story = {
  name: "残高（マイナス）",
  args: { amount: -50000, type: "balance" },
};

export const WithSign: Story = {
  name: "+記号付き",
  args: { amount: 100000, type: "balance", showSign: true },
};

export const WithSignNegative: Story = {
  name: "-記号付き（マイナス）",
  args: { amount: -30000, type: "balance", showSign: true },
};

// サイズバリエーション
export const SizeSmall: Story = {
  name: "サイズ: sm",
  args: { amount: 500000, type: "income", size: "sm" },
};

export const SizeLarge: Story = {
  name: "サイズ: lg",
  args: { amount: 500000, type: "income", size: "lg" },
};

export const SizeXLarge: Story = {
  name: "サイズ: xl",
  args: { amount: 500000, type: "income", size: "xl" },
};

export const Size2XLarge: Story = {
  name: "サイズ: 2xl",
  args: { amount: 500000, type: "income", size: "2xl" },
};

// ウェイトバリエーション
export const WeightSemibold: Story = {
  name: "ウェイト: semibold",
  args: { amount: 500000, type: "income", weight: "semibold" },
};

export const WeightBold: Story = {
  name: "ウェイト: bold",
  args: { amount: 500000, type: "income", weight: "bold" },
};

// サイズ + ウェイト組み合わせ（実際の使用例）
export const LargeBoldIncome: Story = {
  name: "2xl + bold（累計収入）",
  args: { amount: 5000000, type: "income", size: "2xl", weight: "bold" },
};

export const LargeBoldExpense: Story = {
  name: "2xl + bold（累計支出）",
  args: { amount: 3000000, type: "expense", size: "2xl", weight: "bold" },
};

export const LargeBoldBalance: Story = {
  name: "2xl + bold（累計収支）",
  args: { amount: 2000000, type: "balance", size: "2xl", weight: "bold" },
};

// パーセント付き
export const WithPercentagePositive: Story = {
  name: "パーセント付き（プラス）",
  args: { amount: 50000, type: "balance", percentage: 12.34 },
};

export const WithPercentageNegative: Story = {
  name: "パーセント付き（マイナス）",
  args: { amount: -30000, type: "balance", percentage: -5.67 },
};

export const WithPercentageNeutral: Story = {
  name: "パーセント付き（中立）",
  args: { amount: 100000, type: "neutral", percentage: 8.5 },
};

export const WithPercentageCustomDecimals: Story = {
  name: "パーセント付き（小数桁数: 2）",
  args: { amount: 50000, type: "balance", percentage: 12.345, percentageDecimals: 2 },
};

// 実際の使用例
export const UnrealizedGainExample: Story = {
  name: "含み益の例",
  args: { amount: 150000, type: "balance", showSign: true, percentage: 15.5 },
};

export const UnrealizedLossExample: Story = {
  name: "含み損の例",
  args: { amount: -80000, type: "balance", showSign: true, percentage: -8.2 },
};

// 単位なし
export const WithoutUnit: Story = {
  name: "単位なし",
  args: { amount: 1234567, showUnit: false },
};

export const WithoutUnitBalance: Story = {
  name: "単位なし（残高）",
  args: { amount: 50000, type: "balance", showUnit: false, showSign: true },
};

export const WithoutUnitNegative: Story = {
  name: "単位なし（マイナス）",
  args: { amount: -30000, type: "balance", showUnit: false },
};

// 反転（inverse）- 支出の減少は良いこと
export const InversePositive: Story = {
  name: "反転（プラス→赤）",
  args: { amount: 10000, type: "balance", inverse: true, showSign: true },
};

export const InverseNegative: Story = {
  name: "反転（マイナス→緑）",
  args: { amount: -10000, type: "balance", inverse: true, showSign: true },
};

// 固定幅（fixedWidth）
export const FixedWidthList: StoryObj = {
  name: "固定幅（fixedWidth）",
  render: () => (
    <div className="flex flex-col gap-1">
      <AmountDisplay amount={10900395} type="balance" showSign percentage={77.1} fixedWidth />
      <AmountDisplay amount={2508358} type="balance" showSign percentage={40.2} fixedWidth />
      <AmountDisplay amount={2384901} type="balance" showSign percentage={108.0} fixedWidth />
      <AmountDisplay amount={-702000} type="balance" percentage={-36.8} fixedWidth />
      <AmountDisplay amount={-248200} type="balance" percentage={-42.0} fixedWidth />
      <AmountDisplay amount={-171749} type="balance" percentage={-80.1} fixedWidth />
    </div>
  ),
};
