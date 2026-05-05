CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zaim_id` integer NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`category` text,
	`genre` text,
	`amount` integer NOT NULL,
	`place` text,
	`name` text,
	`comment` text,
	`from_account` text,
	`to_account` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_zaim_id_unique` ON `transactions` (`zaim_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category`);
