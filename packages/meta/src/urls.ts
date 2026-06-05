const RF_BASE_URL = "https://robofolio.jp";

export const rfUrls = {
  /** トップページ（ポートフォリオ概要） */
  home: `${RF_BASE_URL}/`,
  /** ログイン */
  login: `${RF_BASE_URL}/login`,
  /** 保有銘柄一覧 */
  portfolio: `${RF_BASE_URL}/portfolio`,
  /** 資産推移 */
  history: `${RF_BASE_URL}/chart`,
} as const;
