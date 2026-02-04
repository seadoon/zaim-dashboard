import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrendDisplay } from "./trend-display";

const meta = {
  title: "UI/TrendDisplay",
  component: TrendDisplay,
  tags: ["autodocs"],
} satisfies Meta<typeof TrendDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Positive: Story = {
  args: { value: 50000, label: "前日比" },
};

export const Negative: Story = {
  args: { value: -30000, label: "前月比" },
};

export const Inverse: Story = {
  args: { value: 10000, label: "支出増", inverse: true },
};
