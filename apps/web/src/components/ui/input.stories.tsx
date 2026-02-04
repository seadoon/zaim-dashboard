import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "テキストを入力...",
    "aria-label": "テキスト入力",
  },
};

export const WithValue: Story = {
  name: "値あり",
  args: {
    defaultValue: "入力されたテキスト",
    "aria-label": "テキスト入力",
  },
};

export const Disabled: Story = {
  name: "無効",
  args: {
    disabled: true,
    placeholder: "入力できません",
    "aria-label": "テキスト入力",
  },
};

export const Password: Story = {
  name: "パスワード",
  args: {
    type: "password",
    placeholder: "パスワードを入力...",
    "aria-label": "パスワード入力",
  },
};

export const Search: Story = {
  name: "検索",
  args: {
    type: "search",
    placeholder: "検索...",
    "aria-label": "検索",
  },
};

export const Number: Story = {
  name: "数値",
  args: {
    type: "number",
    placeholder: "0",
    "aria-label": "数値入力",
  },
};
