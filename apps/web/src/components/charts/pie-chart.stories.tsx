import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PieChart } from "./pie-chart";

const meta = {
  title: "Charts/PieChart",
  component: PieChart,
  tags: ["autodocs"],
} satisfies Meta<typeof PieChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "支出内訳",
    data: [
      { name: "食費", value: 80000 },
      { name: "住居費", value: 120000 },
      { name: "光熱費", value: 20000 },
      { name: "通信費", value: 15000 },
      { name: "交通費", value: 10000 },
      { name: "趣味・娯楽", value: 30000 },
    ],
  },
};

export const WithDefaultColors: Story = {
  args: {
    title: "資産構成",
    useCustomColors: false,
    data: [
      { name: "預金", value: 5000000 },
      { name: "株式", value: 3000000 },
      { name: "投資信託", value: 2000000 },
    ],
  },
};
