import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TreemapChart } from "./treemap-chart";

const meta = {
  title: "Charts/TreemapChart",
  component: TreemapChart,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "400px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TreemapChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { name: "項目A", value: 5000000, color: "var(--color-chart-1)" },
      { name: "項目B", value: 3000000, color: "var(--color-chart-2)" },
      { name: "項目C", value: 2000000, color: "var(--color-chart-3)" },
      { name: "項目D", value: 500000, color: "var(--color-chart-4)" },
    ],
    height: 200,
  },
};

export const LongNames: Story = {
  name: "長い名前",
  args: {
    data: [
      {
        name: "eMAXIS Slim 全世界株式(オール・カントリー)",
        value: 5000000,
        color: "var(--color-chart-1)",
      },
      {
        name: "楽天・全米株式インデックス・ファンド",
        value: 3000000,
        color: "var(--color-chart-2)",
      },
      { name: "SBI・V・S&P500インデックス", value: 2000000, color: "var(--color-chart-3)" },
    ],
    height: 200,
  },
};

export const ManyItems: Story = {
  name: "多数の項目",
  args: {
    data: [
      { name: "項目A", value: 3000000, color: "var(--color-chart-1)" },
      { name: "項目B", value: 2500000, color: "var(--color-chart-2)" },
      { name: "項目C", value: 2000000, color: "var(--color-chart-3)" },
      { name: "項目D", value: 1500000, color: "var(--color-chart-4)" },
      { name: "項目E", value: 1200000, color: "var(--color-chart-5)" },
      { name: "項目F", value: 1000000, color: "var(--color-chart-1)" },
      { name: "項目G", value: 800000, color: "var(--color-chart-2)" },
      { name: "項目H", value: 600000, color: "var(--color-chart-3)" },
    ],
    height: 250,
  },
};

export const SingleItem: Story = {
  name: "1項目のみ",
  args: {
    data: [{ name: "メイン項目", value: 10000000, color: "var(--color-chart-1)" }],
    height: 200,
  },
};
