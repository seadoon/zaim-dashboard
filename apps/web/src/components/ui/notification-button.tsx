import { Bell } from "lucide-react";
import { cn } from "../../lib/utils";

interface NotificationButtonProps {
  count: number;
  onClick?: () => void;
}

export function NotificationButton({ count, onClick }: NotificationButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-2 rounded-lg hover:bg-muted hover:opacity-100 transition-colors cursor-pointer",
      )}
      aria-label={count > 0 ? `通知 ${count}件` : "通知"}
      type="button"
    >
      <Bell className="h-4.5 w-4.5" />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-700 text-xs font-bold text-white flex items-center justify-center"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </button>
  );
}
