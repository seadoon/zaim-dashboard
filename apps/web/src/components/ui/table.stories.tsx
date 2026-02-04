import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleData = [
  { id: 1, date: "2025-04-25", description: "スーパー", category: "食費", amount: 3500 },
  { id: 2, date: "2025-04-24", description: "電気料金", category: "水道・光熱費", amount: 12000 },
  { id: 3, date: "2025-04-20", description: "家賃1月分", category: "住宅", amount: 120000 },
  { id: 4, date: "2025-04-15", description: "定期券", category: "交通費", amount: 10000 },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          <TableHead>内容</TableHead>
          <TableHead>カテゴリ</TableHead>
          <TableHead className="text-right">金額</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sampleData.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.date}</TableCell>
            <TableCell>{row.description}</TableCell>
            <TableCell>{row.category}</TableCell>
            <TableCell className="text-right">{row.amount.toLocaleString()}円</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const Empty: Story = {
  name: "空テーブル",
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          <TableHead>内容</TableHead>
          <TableHead>カテゴリ</TableHead>
          <TableHead className="text-right">金額</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
            データがありません
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const Selectable: Story = {
  name: "選択可能",
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          <TableHead>内容</TableHead>
          <TableHead className="text-right">金額</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow data-state="selected">
          <TableCell>2025-04-25</TableCell>
          <TableCell>選択された行</TableCell>
          <TableCell className="text-right">5,000円</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>2025-04-24</TableCell>
          <TableCell>通常の行</TableCell>
          <TableCell className="text-right">3,000円</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
