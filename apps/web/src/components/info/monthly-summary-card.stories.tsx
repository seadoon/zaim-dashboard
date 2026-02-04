import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MonthlySummaryCard } from "./monthly-summary-card";

const meta = {
  title: "Info/MonthlySummaryCard",
  component: MonthlySummaryCard,
  tags: ["autodocs"],
} satisfies Meta<typeof MonthlySummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    month: "2026-01",
    totalIncome: 520110,
    totalExpense: 300295,
  },
};

export const HighSavingsRate: Story = {
  args: {
    month: "2026-02",
    totalIncome: 500000,
    totalExpense: 150000,
  },
};

export const Deficit: Story = {
  args: {
    month: "2026-03",
    totalIncome: 200000,
    totalExpense: 280000,
  },
};

export const BreakEven: Story = {
  args: {
    month: "2026-04",
    totalIncome: 300000,
    totalExpense: 300000,
  },
};

export const NoIncome: Story = {
  args: {
    month: "2026-05",
    totalIncome: 0,
    totalExpense: 50000,
  },
};
