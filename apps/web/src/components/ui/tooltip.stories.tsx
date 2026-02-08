import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CircleHelp } from "lucide-react";
import { Tooltip } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
  component: Tooltip,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-1 p-8">
      <span className="text-sm">緊急予備資金</span>
      <Tooltip
        aria-label="緊急予備資金の説明"
        content={
          <div className="space-y-1">
            <div className="font-medium">流動資産 ÷ 月平均支出</div>
            <div>
              収入がゼロになった場合に、現在の流動資産（預金・現金等）で何ヶ月生活できるかを示します。
              一般的に6ヶ月分以上が目安です。
            </div>
          </div>
        }
      >
        <CircleHelp className="h-3.5 w-3.5 text-muted-foreground/60" />
      </Tooltip>
    </div>
  ),
};

export const ShortText: Story = {
  render: () => (
    <div className="p-8">
      <Tooltip content="これはツールチップです">
        <span className="text-sm underline decoration-dotted cursor-help">ホバーしてください</span>
      </Tooltip>
    </div>
  ),
};
