import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Switch } from "./switch";

const meta = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "aria-label": "スイッチ",
  },
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
    "aria-label": "スイッチ",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    "aria-label": "スイッチ",
  },
};

export const DisabledChecked: Story = {
  name: "無効（チェック済み）",
  args: {
    disabled: true,
    defaultChecked: true,
    "aria-label": "スイッチ",
  },
};
