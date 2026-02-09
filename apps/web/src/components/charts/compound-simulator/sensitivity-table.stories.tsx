import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SensitivityTable } from "./sensitivity-table";

const meta = {
  title: "Charts/CompoundSimulator/SensitivityTable",
  component: SensitivityTable,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[500px] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SensitivityTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentMonthly: 50_000,
    rows: [
      {
        monthlyContribution: 30_000,
        delta: -20_000,
        depletionProbability: 0.35,
        securityScore: 65,
        medianFinalBalance: 8_000_000,
      },
      {
        monthlyContribution: 40_000,
        delta: -10_000,
        depletionProbability: 0.2,
        securityScore: 80,
        medianFinalBalance: 12_000_000,
      },
      {
        monthlyContribution: 50_000,
        delta: 0,
        depletionProbability: 0.1,
        securityScore: 90,
        medianFinalBalance: 16_000_000,
      },
      {
        monthlyContribution: 60_000,
        delta: 10_000,
        depletionProbability: 0.05,
        securityScore: 95,
        medianFinalBalance: 20_000_000,
      },
      {
        monthlyContribution: 70_000,
        delta: 20_000,
        depletionProbability: 0.02,
        securityScore: 98,
        medianFinalBalance: 24_000_000,
      },
      {
        monthlyContribution: 80_000,
        delta: 30_000,
        depletionProbability: 0.01,
        securityScore: 99,
        medianFinalBalance: 28_000_000,
      },
    ],
  },
};

export const HighRisk: Story = {
  args: {
    currentMonthly: 20_000,
    rows: [
      {
        monthlyContribution: 0,
        delta: -20_000,
        depletionProbability: 0.8,
        securityScore: 20,
        medianFinalBalance: 0,
      },
      {
        monthlyContribution: 10_000,
        delta: -10_000,
        depletionProbability: 0.65,
        securityScore: 35,
        medianFinalBalance: 2_000_000,
      },
      {
        monthlyContribution: 20_000,
        delta: 0,
        depletionProbability: 0.5,
        securityScore: 50,
        medianFinalBalance: 5_000_000,
      },
      {
        monthlyContribution: 30_000,
        delta: 10_000,
        depletionProbability: 0.35,
        securityScore: 65,
        medianFinalBalance: 8_000_000,
      },
      {
        monthlyContribution: 40_000,
        delta: 20_000,
        depletionProbability: 0.2,
        securityScore: 80,
        medianFinalBalance: 12_000_000,
      },
      {
        monthlyContribution: 50_000,
        delta: 30_000,
        depletionProbability: 0.1,
        securityScore: 90,
        medianFinalBalance: 16_000_000,
      },
    ],
  },
};
