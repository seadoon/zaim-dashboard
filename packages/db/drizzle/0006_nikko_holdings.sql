CREATE TABLE `nikko_holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fetched_at` text NOT NULL,
	`stock_code` text NOT NULL,
	`stock_name` text NOT NULL,
	`shares` real NOT NULL,
	`avg_cost_price` integer NOT NULL,
	`total_contribution` integer NOT NULL,
	`total_incentive` integer NOT NULL
);
