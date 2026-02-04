import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NotificationButton } from "./notification-button";

const meta = {
  component: NotificationButton,
  tags: ["autodocs"],
  argTypes: {
    count: {
      control: { type: "number", min: 0, max: 99 },
    },
  },
} satisfies Meta<typeof NotificationButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoBadge: Story = {
  args: {
    count: 0,
  },
};

export const SingleNotification: Story = {
  args: {
    count: 1,
  },
};

export const MultipleNotifications: Story = {
  args: {
    count: 5,
  },
};

export const ManyNotifications: Story = {
  args: {
    count: 15,
  },
};
