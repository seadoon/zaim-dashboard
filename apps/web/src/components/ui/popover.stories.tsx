import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta = {
  title: "UI/Popover",
  component: Popover,
  tags: ["autodocs"],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">ポップオーバーを開く</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          <h4 className="font-medium">ポップオーバー</h4>
          <p className="text-sm text-muted-foreground">これはポップオーバーのコンテンツです。</p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignStart: Story = {
  name: "左揃え",
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">左揃え</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <p className="text-sm">左揃えのポップオーバー</p>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignEnd: Story = {
  name: "右揃え",
  render: () => (
    <div className="flex justify-end">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">右揃え</Button>
        </PopoverTrigger>
        <PopoverContent align="end">
          <p className="text-sm">右揃えのポップオーバー</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const WithForm: Story = {
  name: "フォーム付き",
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">設定を開く</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium">表示設定</h4>
          <div className="space-y-2">
            <label htmlFor="item-count" className="text-sm text-muted-foreground">
              件数
            </label>
            <select id="item-count" className="w-full border rounded px-2 py-1 text-sm">
              <option>10件</option>
              <option>20件</option>
              <option>50件</option>
            </select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
