export interface TransactionBase {
  type: string;
  transferTargetAccountId: number | null;
  category: string | null;
  subCategory: string | null;
  isTransfer: boolean;
  isExcludedFromCalculation: boolean;
}

/**
 * グループ外からの振替を収入に変換する
 * MoneyForwardではグループによって同じトランザクションの表示が異なる。
 * 「グループ選択なし」では振替だが、特定のグループでは収入として表示される。
 */
export function transformTransferToIncome<T extends TransactionBase>(
  transaction: T,
  groupAccountIds: number[],
): T {
  if (
    transaction.type === "transfer" &&
    transaction.transferTargetAccountId !== null &&
    !groupAccountIds.includes(transaction.transferTargetAccountId)
  ) {
    return {
      ...transaction,
      type: "income" as const,
      category: "収入",
      subCategory: "振替入金",
      isTransfer: false,
      isExcludedFromCalculation: false,
    };
  }
  return transaction;
}
