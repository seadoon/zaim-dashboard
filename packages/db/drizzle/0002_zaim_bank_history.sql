CREATE TABLE `zaim_daily_bank_totals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`total` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `zaim_daily_bank_totals_date_unique` ON `zaim_daily_bank_totals` (`date`);
--> statement-breakpoint
CREATE INDEX `zaim_daily_bank_totals_date_idx` ON `zaim_daily_bank_totals` (`date`);
