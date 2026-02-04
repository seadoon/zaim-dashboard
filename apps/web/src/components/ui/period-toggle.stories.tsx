import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, expect, userEvent, within } from "storybook/test";
import { PeriodToggle } from "./period-toggle";

const meta = {
  title: "UI/PeriodToggle",
  component: PeriodToggle,
  tags: ["autodocs"],
} satisfies Meta<typeof PeriodToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

const periodOptions = [
  { value: "1m", label: "1ヶ月" },
  { value: "3m", label: "3ヶ月" },
  { value: "6m", label: "6ヶ月" },
  { value: "1y", label: "1年" },
  { value: "all", label: "全期間" },
];

export const Default: Story = {
  args: {
    options: periodOptions,
    value: "6m",
    onChange: fn(),
  },
};

export const WithPlayTest: Story = {
  args: {
    options: periodOptions,
    value: "6m",
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByText("1ヶ月");
    await userEvent.click(button);
    await expect(args.onChange).toHaveBeenCalledWith("1m");
  },
};
