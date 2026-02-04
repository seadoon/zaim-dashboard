import type { Metadata } from "next";
import { BSContent } from "../../bs/page";

export const metadata: Metadata = {
  title: "資産",
};

export default async function GroupBSPage({ params }: PageProps<"/[groupId]/bs">) {
  const { groupId } = await params;

  return <BSContent groupId={groupId} />;
}
