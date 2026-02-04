import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Command, CommandGroup, CommandItem, CommandList } from "./command";

const meta = {
  title: "UI/Command",
  component: Command,
  tags: ["autodocs"],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Command className="border rounded-lg">
      <CommandList>
        <CommandGroup heading="カテゴリー">
          <CommandItem>食費</CommandItem>
          <CommandItem>住宅</CommandItem>
          <CommandItem>水道・光熱費</CommandItem>
          <CommandItem>交通費</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const MultipleGroups: Story = {
  name: "複数グループ",
  render: () => (
    <Command className="border rounded-lg">
      <CommandList>
        <CommandGroup heading="支出">
          <CommandItem>食費</CommandItem>
          <CommandItem>住宅</CommandItem>
          <CommandItem>水道・光熱費</CommandItem>
        </CommandGroup>
        <CommandGroup heading="収入">
          <CommandItem>給与</CommandItem>
          <CommandItem>副業</CommandItem>
          <CommandItem>配当</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const WithDisabled: Story = {
  name: "無効項目あり",
  render: () => (
    <Command className="border rounded-lg">
      <CommandList>
        <CommandGroup heading="アクション">
          <CommandItem>選択可能な項目</CommandItem>
          <CommandItem disabled>無効な項目</CommandItem>
          <CommandItem>別の選択可能な項目</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
