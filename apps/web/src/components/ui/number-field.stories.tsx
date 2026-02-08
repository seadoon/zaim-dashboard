import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NumberField } from "./number-field";

const meta = {
  title: "UI/NumberField",
  component: NumberField,
  tags: ["autodocs"],
  parameters: {
    a11y: {
      config: {
        rules: [
          // base-ui generates internal IDs for aria-controls that axe cannot resolve in test environments
          { id: "aria-valid-attr-value", enabled: false },
        ],
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[200px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 100000,
    step: 10000,
    min: 0,
    "aria-label": "金額",
    suffix: "円",
  },
};

export const WithFormat: Story = {
  args: {
    defaultValue: 1500000,
    step: 10000,
    min: 0,
    "aria-label": "金額",
    suffix: "円",
  },
};

export const Percentage: Story = {
  args: {
    defaultValue: 5,
    step: 0.5,
    min: 0,
    max: 100,
    "aria-label": "利率",
    suffix: "%",
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: 50000,
    disabled: true,
    "aria-label": "金額",
    suffix: "円",
  },
};

export const WithLargeStep: Story = {
  args: {
    defaultValue: 100000,
    step: 10000,
    largeStep: 100000,
    min: 0,
    "aria-label": "金額",
    suffix: "円",
  },
};
