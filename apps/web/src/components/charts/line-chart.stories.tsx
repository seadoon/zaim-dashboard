import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LineChart } from "./line-chart";

const meta = {
  title: "Charts/LineChart",
  component: LineChart,
  tags: ["autodocs"],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "資産推移",
    xAxisKey: "month",
    data: [
      { month: "1月", 総資産: 10000000, 純資産: 8000000 },
      { month: "2月", 総資産: 10200000, 純資産: 8200000 },
      { month: "3月", 総資産: 10500000, 純資産: 8500000 },
      { month: "4月", 総資産: 10300000, 純資産: 8300000 },
      { month: "5月", 総資産: 10800000, 純資産: 8800000 },
      { month: "6月", 総資産: 11000000, 純資産: 9000000 },
    ],
    lines: [
      { dataKey: "総資産", name: "総資産", color: "#3b82f6" },
      { dataKey: "純資産", name: "純資産", color: "#22c55e" },
    ],
  },
};

export const SingleLine: Story = {
  args: {
    title: "月別貯蓄",
    xAxisKey: "month",
    data: [
      { month: "1月", 貯蓄: 500000 },
      { month: "2月", 貯蓄: 520000 },
      { month: "3月", 貯蓄: 480000 },
      { month: "4月", 貯蓄: 550000 },
    ],
    lines: [{ dataKey: "貯蓄", name: "貯蓄", color: "#8b5cf6" }],
  },
};
