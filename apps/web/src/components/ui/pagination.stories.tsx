import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Pagination } from "./pagination";

const meta = {
  title: "UI/Pagination",
  component: Pagination,
  tags: ["autodocs"],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {
  args: {
    currentPage: 0,
    totalPages: 5,
    pageSize: 50,
    totalItems: 230,
    onPageChange: fn(),
  },
};

export const MiddlePage: Story = {
  args: {
    currentPage: 2,
    totalPages: 5,
    pageSize: 50,
    totalItems: 230,
    onPageChange: fn(),
  },
};

export const LastPage: Story = {
  args: {
    currentPage: 4,
    totalPages: 5,
    pageSize: 50,
    totalItems: 230,
    onPageChange: fn(),
  },
};

export const SinglePage: Story = {
  args: {
    currentPage: 0,
    totalPages: 1,
    pageSize: 50,
    totalItems: 10,
    onPageChange: fn(),
  },
};

export const NextPageTest: Story = {
  args: {
    currentPage: 2,
    totalPages: 5,
    pageSize: 50,
    totalItems: 230,
    onPageChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const nextButton = canvas.getByLabelText("次のページ");
    await userEvent.click(nextButton);
    await expect(args.onPageChange).toHaveBeenCalledWith(3);
  },
};

export const PreviousPageTest: Story = {
  args: {
    currentPage: 2,
    totalPages: 5,
    pageSize: 50,
    totalItems: 230,
    onPageChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const prevButton = canvas.getByLabelText("前のページ");
    await userEvent.click(prevButton);
    await expect(args.onPageChange).toHaveBeenCalledWith(1);
  },
};

export const WithScrollTarget: Story = {
  args: {
    currentPage: 2,
    totalPages: 5,
    pageSize: 50,
    totalItems: 230,
    onPageChange: fn(),
  },
  render: (args) => {
    const ScrollTargetWrapper = () => {
      const scrollTargetRef = useRef<HTMLDivElement>(null);
      return (
        <div style={{ height: "300px", overflow: "auto" }}>
          <div ref={scrollTargetRef} style={{ padding: "16px", background: "#f0f0f0" }}>
            スクロールターゲット（ページ切り替え時にここにスクロール）
          </div>
          <div style={{ height: "500px", padding: "16px" }}>スクロール可能なコンテンツエリア</div>
          <Pagination {...args} scrollTargetRef={scrollTargetRef} />
        </div>
      );
    };
    return <ScrollTargetWrapper />;
  },
};
