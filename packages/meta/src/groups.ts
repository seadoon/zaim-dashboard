/**
 * グループ関連の定数
 */

/** 「グループ選択なし」を表す特別なID */
export const NO_GROUP_ID = "0";

/** グループ選択なしかどうかを判定 */
export function isNoGroup(groupId: string): boolean {
  return groupId === NO_GROUP_ID;
}
