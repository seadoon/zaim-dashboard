// Storybook mock for @moneyforward-daily-action/db
// Prevents better-sqlite3 (native addon) from being loaded in the browser
import { fn } from "storybook/test";

// Core exports
export const getDb = fn();
export const closeDb = fn();
export const initDb = fn();
export const isDatabaseAvailable = fn(() => true);
export const schema = {};

// Shared utilities - utils
export const generateMonthRange = fn(() => []);

// Shared utilities - transfer
export const transformTransferToIncome = fn((tx: unknown) => tx);

// Query modules - transaction
export const getTransactions = fn(() => []);
export const getTransactionsByMonth = fn(() => []);
export const getTransactionsByAccountId = fn(() => []);

// Query modules - summary
export const buildIncludedTransactionCondition = fn();
export const buildOutsideTransferCondition = fn();
export const buildRegularIncomeSum = fn();
export const getDeduplicatedTransferIncome = fn(() => 0);
export const buildExpenseSum = fn();
export const getLatestMonthlySummary = fn(() => null);
export const getMonthlySummaries = fn(() => []);
export const getAvailableMonths = fn(() => []);
export const getMonthlySummaryByMonth = fn(() => null);
export const getMonthlyCategoryTotals = fn(() => []);
export const getYearToDateSummary = fn(() => null);
export const getDailyTotals = fn(() => []);

// Query modules - account (robofolio)
export const getRfBrokers = fn(() => []);
export const getRfHoldingsByBrokerId = fn(() => []);

// Query modules - asset
export const parseDateString = fn();
export const toDateString = fn();
export const calculateTargetDate = fn();
export const getAssetBreakdownByCategory = fn(() => []);
export const getLiabilityBreakdownByCategory = fn(() => []);
export const getAssetHistoryWithCategories = fn(() => []);
export const getLatestTotalAssets = fn(() => null);
export const getDailyAssetChange = fn(() => null);
export const getCategoryChangesForPeriod = fn(() => null);

// Query modules - holding (robofolio)
export const getLatestSnapshot = fn(() => undefined);
export const getHoldingsWithLatestValues = fn(() => []);
export const getHoldingsWithDailyChange = fn(() => []);
export const hasInvestmentHoldings = fn(() => false);
export const getRfSecuritiesTotalByBroker = fn(() => []);
export const getRfSecuritiesTotalByType = fn(() => []);
export const getRfSecuritiesTotal = fn(() => 0);
export const getRfSecuritiesDailyChange = fn(() => null);

// Query modules - zaim
export const getZaimBankTotal = fn(() => 0);
export const getZaimBankItems = fn(() => []);
export const getZaimDailyBankTotal = fn(() => 0);
export const getZaimBankHistory = fn(() => []);
