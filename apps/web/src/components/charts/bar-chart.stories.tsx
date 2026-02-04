import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BarChart } from "./bar-chart";

const meta = {
  title: "Charts/BarChart",
  component: BarChart,
  tags: ["autodocs"],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "月別支出",
    xAxisKey: "month",
    data: [
      { month: "1月", 食費: 80000, 住居費: 120000, 光熱費: 20000 },
      { month: "2月", 食費: 75000, 住居費: 120000, 光熱費: 25000 },
      { month: "3月", 食費: 85000, 住居費: 120000, 光熱費: 18000 },
      { month: "4月", 食費: 90000, 住居費: 120000, 光熱費: 15000 },
      { month: "5月", 食費: 78000, 住居費: 120000, 光熱費: 12000 },
      { month: "6月", 食費: 82000, 住居費: 120000, 光熱費: 18000 },
    ],
    bars: [
      { dataKey: "食費", name: "食費", color: "#ef4444", stackId: "stack" },
      { dataKey: "住居費", name: "住居費", color: "#3b82f6", stackId: "stack" },
      { dataKey: "光熱費", name: "光熱費", color: "#f59e0b", stackId: "stack" },
    ],
  },
};

export const SingleBar: Story = {
  args: {
    title: "月別収入",
    xAxisKey: "month",
    data: [
      { month: "1月", 収入: 400000 },
      { month: "2月", 収入: 420000 },
      { month: "3月", 収入: 380000 },
      { month: "4月", 収入: 450000 },
    ],
    bars: [{ dataKey: "収入", name: "収入", color: "#22c55e" }],
  },
};
