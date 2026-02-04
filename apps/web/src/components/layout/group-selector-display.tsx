import { formatDateTime } from "../../lib/format";

interface GroupSelectorDisplayProps {
  name: string;
  lastScrapedAt: string | null;
}

export function GroupSelectorDisplay({ name, lastScrapedAt }: GroupSelectorDisplayProps) {
  return (
    <>
      <span className="truncate max-w-32 sm:max-w-40">{name}</span>
      {lastScrapedAt && (
        <span className="text-[11px] text-muted-foreground truncate max-w-32 sm:max-w-40">
          {formatDateTime(lastScrapedAt)}
        </span>
      )}
    </>
  );
}

// 共通のコンテナスタイル
export const groupSelectorContainerClassName =
  "flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium";
