import { formatCurrency, formatPercent } from "../../lib/format";
import { cn } from "../../lib/utils";

type AmountType = "income" | "expense" | "balance" | "neutral";

interface GetAmountColorClassOptions {
  /** 値（balance タイプで正負判定に使用） */
  value: number;
  /** 色のタイプ */
  type: AmountType;
  /**
   * 色を反転するか（type="balance" の場合のみ有効）
   * - false（デフォルト）: 正が緑、負が赤
   * - true: 正が赤、負が緑（支出の減少は良いこと）
   */
  inverse?: boolean;
}

/**
 * 金額表示用の色クラスを取得
 * AmountDisplay と同じ色ロジックを外部で使用可能
 */
function getAmountColorClass({
  value,
  type,
  inverse = false,
}: GetAmountColorClassOptions): string | undefined {
  if (type === "income") return "text-income";
  if (type === "expense") return "text-expense";
  if (type === "balance") {
    const isPositive = value >= 0;
    if (inverse) {
      return isPositive ? "text-balance-negative" : "text-balance-positive";
    }
    return isPositive ? "text-balance-positive" : "text-balance-negative";
  }
  return undefined;
}

interface AmountDisplayProps {
  amount: number;
  /**
   * - income/expense: 実際の収入・支出額
   * - balance: 差額や評価損益（正負で色分け）
   * - neutral: 色なし
   */
  type?: AmountType;
  /** +/- 記号を表示するか */
  showSign?: boolean;
  /** 単位（円）を表示するか（デフォルト: true） */
  showUnit?: boolean;
  /**
   * 色を反転するか（type="balance" の場合のみ有効）
   * - false（デフォルト）: 正が緑、負が赤
   * - true: 正が赤、負が緑（支出の減少は良いこと）
   */
  inverse?: boolean;
  /** サイズ（デフォルト: md） */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** フォントウェイト（デフォルト: medium） */
  weight?: "medium" | "semibold" | "bold";
  /** パーセント表示（オプション）- 渡された場合のみ表示 */
  percentage?: number;
  /** パーセントの小数桁数（デフォルト: 1） */
  percentageDecimals?: number;
  /**
   * 金額とパーセンテージに固定幅を適用してリスト内で揃える
   * - 金額: min-w-28, text-right
   * - パーセンテージ: min-w-14, text-right
   */
  fixedWidth?: boolean;
  /** パーセント部分に適用する追加クラス */
  percentageClassName?: string;
  className?: string;
}

const sizeClasses = {
  sm: "text-sm",
  md: "",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
} as const;

const weightClasses = {
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

function AmountDisplay({
  amount,
  type = "neutral",
  showSign = false,
  showUnit = true,
  inverse = false,
  size = "md",
  weight = "medium",
  percentage,
  percentageDecimals = 1,
  fixedWidth = false,
  percentageClassName,
  className,
}: AmountDisplayProps) {
  const colorClass = getAmountColorClass({ value: amount, type, inverse });

  const sign = showSign && amount > 0 ? "+" : "";

  const formattedAmount = showUnit ? formatCurrency(amount) : amount.toLocaleString("ja-JP");

  const percentageColorClass = type === "neutral" ? "text-muted-foreground" : colorClass;

  const amountContent = (
    <>
      {sign}
      {formattedAmount}
    </>
  );

  return (
    <span
      className={cn(
        "tabular-nums",
        sizeClasses[size],
        weightClasses[weight],
        colorClass,
        className,
      )}
    >
      {fixedWidth ? (
        <span className="inline-block min-w-28 text-right">{amountContent}</span>
      ) : (
        amountContent
      )}
      {percentage !== undefined && (
        <span
          className={cn(
            "ml-1 tabular-nums",
            fixedWidth && "inline-block min-w-14 text-right",
            percentageColorClass,
            percentageClassName,
          )}
        >
          {formatPercent(percentage, percentageDecimals)}
        </span>
      )}
    </span>
  );
}

export { AmountDisplay, getAmountColorClass };
