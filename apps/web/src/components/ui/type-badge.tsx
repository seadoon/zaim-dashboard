import { Badge } from "./badge";

interface TypeBadgeProps {
  type: string;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  switch (type) {
    case "income":
      return <Badge variant="success">収入</Badge>;
    case "payment":
      return <Badge variant="destructive">支出</Badge>;
    case "transfer":
      return <Badge variant="outline">振替</Badge>;
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
}
