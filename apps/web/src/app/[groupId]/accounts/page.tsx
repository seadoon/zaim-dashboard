import { AccountsContent } from "../../accounts/page";

export { metadata } from "../../accounts/page";

export default async function GroupAccountsPage({ params }: PageProps<"/[groupId]/accounts">) {
  const { groupId } = await params;

  return <AccountsContent groupId={groupId} />;
}
