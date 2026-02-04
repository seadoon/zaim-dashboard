import type { Metadata } from "next";
import { DashboardContent } from "../page";

export const metadata: Metadata = {
  title: "ダッシュボード",
};

export default async function GroupDashboardPage({ params }: PageProps<"/[groupId]">) {
  const { groupId } = await params;

  return <DashboardContent groupId={groupId} />;
}
