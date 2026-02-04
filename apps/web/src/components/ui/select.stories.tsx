import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./select";

const meta = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const monthOptions = [
  { value: "2026-01", label: "2026年1月" },
  { value: "2026-02", label: "2026年2月" },
  { value: "2026-03", label: "2026年3月" },
];

const categoryOptions = [
  { value: "food", label: "食費" },
  { value: "housing", label: "住宅" },
  { value: "utility", label: "水道・光熱費" },
  { value: "transport", label: "交通費" },
  { value: "entertainment", label: "趣味・娯楽" },
];

export const Default: Story = {
  args: {
    options: monthOptions,
    "aria-label": "月選択",
  },
};

export const WithDefaultValue: Story = {
  name: "初期値あり",
  args: {
    options: monthOptions,
    defaultValue: "2026-02",
    "aria-label": "月選択",
  },
};

export const Categories: Story = {
  name: "カテゴリー選択",
  args: {
    options: categoryOptions,
    "aria-label": "カテゴリー選択",
  },
};

export const Disabled: Story = {
  name: "無効",
  args: {
    options: monthOptions,
    disabled: true,
    "aria-label": "月選択",
  },
};

export const Centered: Story = {
  name: "中央揃え",
  args: {
    options: monthOptions,
    className: "text-center",
    "aria-label": "月選択",
  },
};
