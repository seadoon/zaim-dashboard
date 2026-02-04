CREATE TABLE `account_statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`status` text NOT NULL,
	`last_updated` text,
	`total_assets` integer DEFAULT 0,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_statuses_account_id_unique` ON `account_statuses` (`account_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mf_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`category_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`category_id`) REFERENCES `institution_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_mf_id_unique` ON `accounts` (`mf_id`);--> statement-breakpoint
CREATE INDEX `accounts_category_id_idx` ON `accounts` (`category_id`);--> statement-breakpoint
CREATE TABLE `asset_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_categories_name_unique` ON `asset_categories` (`name`);--> statement-breakpoint
CREATE TABLE `asset_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`total_assets` integer NOT NULL,
	`change` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_history_group_date_idx` ON `asset_history` (`group_id`,`date`);--> statement-breakpoint
CREATE INDEX `asset_history_group_id_idx` ON `asset_history` (`group_id`);--> statement-breakpoint
CREATE TABLE `asset_history_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_history_id` integer NOT NULL,
	`category_name` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_history_id`) REFERENCES `asset_history`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_history_categories_history_category_idx` ON `asset_history_categories` (`asset_history_id`,`category_name`);--> statement-breakpoint
CREATE TABLE `daily_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`refresh_completed` integer DEFAULT true,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_snapshots_date_idx` ON `daily_snapshots` (`date`);--> statement-breakpoint
CREATE TABLE `group_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`account_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_accounts_group_account_idx` ON `group_accounts` (`group_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `group_accounts_group_id_idx` ON `group_accounts` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_accounts_account_id_idx` ON `group_accounts` (`account_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_current` integer DEFAULT false,
	`last_scraped_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holding_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`holding_id` integer NOT NULL,
	`snapshot_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`quantity` real,
	`unit_price` real,
	`avg_cost_price` real,
	`daily_change` integer,
	`unrealized_gain` integer,
	`unrealized_gain_pct` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`holding_id`) REFERENCES `holdings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snapshot_id`) REFERENCES `daily_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holding_values_holding_snapshot_idx` ON `holding_values` (`holding_id`,`snapshot_id`);--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mf_id` text,
	`account_id` integer NOT NULL,
	`category_id` integer,
	`name` text NOT NULL,
	`code` text,
	`type` text NOT NULL,
	`liability_category` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holdings_mf_id_unique` ON `holdings` (`mf_id`);--> statement-breakpoint
CREATE INDEX `holdings_account_id_idx` ON `holdings` (`account_id`);--> statement-breakpoint
CREATE TABLE `institution_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`display_order` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institution_categories_name_unique` ON `institution_categories` (`name`);--> statement-breakpoint
CREATE TABLE `spending_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`large_category_id` integer NOT NULL,
	`category_name` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spending_targets_group_category_idx` ON `spending_targets` (`group_id`,`large_category_id`);--> statement-breakpoint
CREATE INDEX `spending_targets_group_id_idx` ON `spending_targets` (`group_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mf_id` text NOT NULL,
	`date` text NOT NULL,
	`account_id` integer,
	`category` text,
	`sub_category` text,
	`description` text,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`is_transfer` integer DEFAULT false NOT NULL,
	`is_excluded_from_calculation` integer DEFAULT false NOT NULL,
	`transfer_target` text,
	`transfer_target_account_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transfer_target_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_mf_id_unique` ON `transactions` (`mf_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_account_id_idx` ON `transactions` (`account_id`);