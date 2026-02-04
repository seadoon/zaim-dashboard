import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./checkbox";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "aria-label": "チェックボックス",
  },
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
    "aria-label": "チェックボックス",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    "aria-label": "チェックボックス",
  },
};

export const DisabledChecked: Story = {
  name: "無効（チェック済み）",
  args: {
    disabled: true,
    defaultChecked: true,
    "aria-label": "チェックボックス",
  },
};

export const WithLabel: Story = {
  name: "ラベル付き",
  args: {
    "aria-label": "利用規約に同意する",
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" {...args} />
      <label htmlFor="terms" className="text-sm">
        利用規約に同意する
      </label>
    </div>
  ),
};
