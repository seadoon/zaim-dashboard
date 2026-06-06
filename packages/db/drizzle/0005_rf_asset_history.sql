-- 資産タイプ別日次履歴テーブル（ロボフォリオのポートフォリオチャートから取得）
CREATE TABLE `rf_asset_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`asset_type` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rf_asset_history_date_type_idx` ON `rf_asset_history` (`date`, `asset_type`);
