import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChartTooltipContent } from "./chart-tooltip";

const meta = {
  title: "Charts/ChartTooltip",
  component: ChartTooltipContent,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartTooltipContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <div className="font-medium">2026年1月</div>
        <div className="text-muted-foreground">支出: 150,000円</div>
      </>
    ),
  },
};

export const WithMultipleLines: Story = {
  name: "複数行",
  args: {
    children: (
      <>
        <div className="font-medium mb-1">2026年1月の収支</div>
        <div className="space-y-0.5">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">収入</span>
            <span className="text-income">350,000円</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">支出</span>
            <span className="text-expense">250,000円</span>
          </div>
          <div className="flex justify-between gap-4 border-t pt-1 mt-1">
            <span className="font-medium">収支</span>
            <span className="text-balance-positive font-medium">100,000円</span>
          </div>
        </div>
      </>
    ),
  },
};

export const CategoryBreakdown: Story = {
  name: "カテゴリ内訳",
  args: {
    children: (
      <>
        <div className="font-medium mb-1">食費</div>
        <div className="text-muted-foreground">80,000円（32%）</div>
      </>
    ),
  },
};
