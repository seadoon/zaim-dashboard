import { CFContent } from "../../cf/page";

export { metadata } from "../../cf/page";

export default async function GroupCFPage({ params }: PageProps<"/[groupId]/cf">) {
  const { groupId } = await params;

  return <CFContent groupId={groupId} />;
}
