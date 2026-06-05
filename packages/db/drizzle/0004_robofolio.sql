-- MoneyForward テーブルを削除
DROP TABLE IF EXISTS `holding_values`;
--> statement-breakpoint
DROP TABLE IF EXISTS `holdings`;
--> statement-breakpoint
DROP TABLE IF EXISTS `daily_snapshots`;
--> statement-breakpoint
DROP TABLE IF EXISTS `group_accounts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `account_statuses`;
--> statement-breakpoint
DROP TABLE IF EXISTS `accounts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `asset_history_categories`;
--> statement-breakpoint
DROP TABLE IF EXISTS `asset_history`;
--> statement-breakpoint
DROP TABLE IF EXISTS `asset_categories`;
--> statement-breakpoint
DROP TABLE IF EXISTS `institution_categories`;
--> statement-breakpoint
DROP TABLE IF EXISTS `groups`;
--> statement-breakpoint

-- Robofolio: 証券会社マスタ
CREATE TABLE `rf_brokers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rf_brokers_name_unique` ON `rf_brokers` (`name`);
--> statement-breakpoint

-- Robofolio: 銘柄マスタ
CREATE TABLE `rf_holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`broker_id` integer NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`asset_type` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`broker_id`) REFERENCES `rf_brokers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rf_holdings_broker_id_idx` ON `rf_holdings` (`broker_id`);
--> statement-breakpoint

-- Robofolio: 日次スナップショット
CREATE TABLE `rf_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rf_snapshots_date_unique` ON `rf_snapshots` (`date`);
--> statement-breakpoint

-- Robofolio: 銘柄ごとの日次評価額
CREATE TABLE `rf_holding_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`holding_id` integer NOT NULL,
	`quantity` real,
	`avg_cost_price` real,
	`unit_price` real,
	`amount` integer NOT NULL,
	`unrealized_gain` integer,
	`unrealized_gain_pct` real,
	`daily_change` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `rf_snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`holding_id`) REFERENCES `rf_holdings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rf_holding_values_snapshot_holding_idx` ON `rf_holding_values` (`snapshot_id`, `holding_id`);
