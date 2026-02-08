import type { Metadata } from "next";
import { SimulatorContent } from "../../simulator/page";

export const metadata: Metadata = {
  title: "シミュレーター",
};

export default async function GroupSimulatorPage({ params }: PageProps<"/[groupId]/simulator">) {
  const { groupId } = await params;

  return <SimulatorContent groupId={groupId} />;
}
