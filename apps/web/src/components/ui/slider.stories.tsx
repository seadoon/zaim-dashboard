import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Slider } from "./slider";

const meta = {
  title: "UI/Slider",
  component: Slider,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-64 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 50,
    min: 0,
    max: 100,
    step: 1,
    "aria-label": "スライダー",
  },
};

export const WithValue: Story = {
  name: "値指定",
  render: () => {
    const [value, setValue] = useState(30);
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">値: {value}</div>
        <Slider value={value} onValueChange={setValue} min={0} max={100} aria-label="スライダー" />
      </div>
    );
  },
};

export const Percentage: Story = {
  name: "パーセンテージ",
  render: () => {
    const [value, setValue] = useState(5);
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">利回り: {value}%</div>
        <Slider
          value={value}
          onValueChange={setValue}
          min={0}
          max={15}
          step={0.5}
          aria-label="想定利回り"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>15%</span>
        </div>
      </div>
    );
  },
};

export const Disabled: Story = {
  name: "無効",
  args: {
    defaultValue: 40,
    disabled: true,
    "aria-label": "スライダー",
  },
};
