import { Badge } from "./badge";

interface AccountStatusBadgeProps {
  status: string;
}

export function AccountStatusBadge({ status }: AccountStatusBadgeProps) {
  switch (status) {
    case "ok":
      return <Badge variant="success">正常</Badge>;
    case "updating":
      return <Badge variant="warning">更新中</Badge>;
    case "error":
      return <Badge variant="destructive">エラー</Badge>;
    default:
      return <Badge variant="secondary">不明</Badge>;
  }
}
