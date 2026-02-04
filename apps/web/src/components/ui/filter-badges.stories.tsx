import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, expect, userEvent, within } from "storybook/test";
import { FilterBadges } from "./filter-badges";

const meta = {
  title: "UI/FilterBadges",
  component: FilterBadges,
  tags: ["autodocs"],
} satisfies Meta<typeof FilterBadges>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    selectedCategories: [],
    selectedTypes: [],
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onClearAll: fn(),
  },
};

export const WithCategories: Story = {
  args: {
    selectedCategories: ["食費", "交通費"],
    selectedTypes: [],
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onClearAll: fn(),
  },
};

export const WithTypes: Story = {
  args: {
    selectedCategories: [],
    selectedTypes: ["income", "expense"],
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onClearAll: fn(),
  },
};

export const WithDate: Story = {
  args: {
    selectedCategories: [],
    selectedTypes: [],
    selectedDate: "2025-04-15",
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onRemoveDate: fn(),
    onClearAll: fn(),
  },
};

export const WithBoth: Story = {
  args: {
    selectedCategories: ["食費", "日用品"],
    selectedTypes: ["expense"],
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onClearAll: fn(),
  },
};

export const WithAll: Story = {
  args: {
    selectedCategories: ["食費"],
    selectedTypes: ["expense"],
    selectedDate: "2025-04-20",
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onRemoveDate: fn(),
    onClearAll: fn(),
  },
};

export const WithPlayTest: Story = {
  args: {
    selectedCategories: ["食費", "交通費"],
    selectedTypes: ["expense"],
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onClearAll: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click remove button on first category badge
    const badges = canvas.getAllByRole("button", { name: /を削除/ });
    await userEvent.click(badges[0]);

    // Verify onRemoveCategory was called
    await expect(args.onRemoveCategory).toHaveBeenCalled();
  },
};

export const ClearAllTest: Story = {
  args: {
    selectedCategories: ["食費", "交通費"],
    selectedTypes: ["expense"],
    onRemoveCategory: fn(),
    onRemoveType: fn(),
    onClearAll: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click clear all button
    const clearButton = canvas.getByText("すべてクリア");
    await userEvent.click(clearButton);

    // Verify onClearAll was called
    await expect(args.onClearAll).toHaveBeenCalled();
  },
};
