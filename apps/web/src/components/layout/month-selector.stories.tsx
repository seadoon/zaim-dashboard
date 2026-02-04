import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MonthSelectorClient } from "./month-selector.client";

const mockMonths = ["2026-01", "2025-12", "2025-11", "2025-10", "2025-09", "2025-08"];

const meta = {
  title: "Layout/MonthSelector",
  component: MonthSelectorClient,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/cf/2026-01",
      },
    },
  },
} satisfies Meta<typeof MonthSelectorClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentMonth: "2026-01",
    availableMonths: mockMonths,
    basePath: "/cf",
  },
};

export const MidYear: Story = {
  name: "年の途中",
  args: {
    currentMonth: "2025-10",
    availableMonths: mockMonths,
    basePath: "/cf",
  },
};

export const BSPath: Story = {
  name: "BS ページ用",
  args: {
    currentMonth: "2026-01",
    availableMonths: mockMonths,
    basePath: "/bs",
  },
};
