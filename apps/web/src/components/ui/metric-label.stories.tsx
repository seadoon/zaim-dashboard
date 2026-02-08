import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MetricLabel } from "./metric-label";

const meta: Meta<typeof MetricLabel> = {
  component: MetricLabel,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MetricLabel>;

export const WithDescription: Story = {
  args: {
    title: "緊急予備資金",
    description: (
      <div className="space-y-1">
        <div className="font-medium">流動資産 ÷ 月平均支出</div>
        <div>
          収入がゼロになった場合に、現在の流動資産（預金・現金等）で何ヶ月生活できるかを示します。
          一般的に6ヶ月分以上が目安です。
        </div>
      </div>
    ),
  },
};

export const WithoutDescription: Story = {
  args: {
    title: "月平均支出",
  },
};

export const ShortDescription: Story = {
  args: {
    title: "流動性比率",
    description: "流動資産 ÷ 総資産 × 100。すぐに現金化できる資産の割合を示します。",
  },
};
