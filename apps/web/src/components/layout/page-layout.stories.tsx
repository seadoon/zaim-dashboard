import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageLayout } from "./page-layout";

const meta = {
  title: "Layout/PageLayout",
  component: PageLayout,
  tags: ["autodocs"],
} satisfies Meta<typeof PageLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "ダッシュボード",
    children: (
      <div className="p-4 border rounded-lg bg-muted/50">
        <p>ページコンテンツがここに入ります</p>
      </div>
    ),
  },
};

export const WithLink: Story = {
  args: {
    title: "収支",
    href: "https://example.com",
    children: (
      <div className="p-4 border rounded-lg bg-muted/50">
        <p>外部リンク付きのページ</p>
      </div>
    ),
  },
};

export const WithOptions: Story = {
  args: {
    title: "連携サービス一覧",
    href: "https://example.com",
    options: (
      <>
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">正常: 5件</span>
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">エラー: 1件</span>
      </>
    ),
    children: (
      <div className="p-4 border rounded-lg bg-muted/50">
        <p>オプション付きのページ</p>
      </div>
    ),
  },
};
