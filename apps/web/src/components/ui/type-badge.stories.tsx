import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TypeBadge } from "./type-badge";

const meta = {
  title: "UI/TypeBadge",
  component: TypeBadge,
  tags: ["autodocs"],
  args: {
    type: "expense",
    isTransfer: false,
  },
} satisfies Meta<typeof TypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Income: Story = {
  args: { type: "income", isTransfer: false },
};

export const Expense: Story = {
  args: { type: "expense", isTransfer: false },
};

export const Transfer: Story = {
  args: { type: "transfer", isTransfer: true },
};

export const UnknownType: Story = {
  args: { type: "other", isTransfer: false },
};
