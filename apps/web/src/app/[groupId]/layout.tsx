import { getAllGroups } from "@moneyforward-daily-action/db";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const groups = getAllGroups();
  return groups.filter((g) => !g.isCurrent).map((group) => ({ groupId: group.id }));
}

export default async function GroupLayout({ children, params }: LayoutProps<"/[groupId]">) {
  const { groupId } = await params;
  const groups = getAllGroups();
  const group = groups.find((g) => g.id === groupId);

  if (!group) {
    notFound();
  }

  return <>{children}</>;
}
