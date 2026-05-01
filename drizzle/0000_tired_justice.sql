CREATE TABLE `raw_gh_usage` (
	`pull_date` text NOT NULL,
	`billing_month` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`pull_date`, `billing_month`)
);
--> statement-breakpoint
CREATE TABLE `raw_m365_usage` (
	`pull_date` text NOT NULL,
	`page_index` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`pull_date`, `page_index`)
);
--> statement-breakpoint
CREATE TABLE `gh_metrics_daily` (
	`metric_date` text NOT NULL,
	`username` text NOT NULL,
	`ide` text NOT NULL,
	`feature` text NOT NULL,
	`suggestions` integer,
	`acceptances` integer,
	PRIMARY KEY(`metric_date`, `username`, `ide`, `feature`)
);
--> statement-breakpoint
CREATE TABLE `gh_seats` (
	`snapshot_date` text NOT NULL,
	`username` text NOT NULL,
	`plan_type` text NOT NULL,
	`seat_cost_usd` real NOT NULL,
	`last_activity_at` text,
	`assignee_team` text,
	PRIMARY KEY(`snapshot_date`, `username`)
);
--> statement-breakpoint
CREATE TABLE `gh_usage_facts` (
	`billing_month` text NOT NULL,
	`username` text NOT NULL,
	`product` text NOT NULL,
	`sku` text NOT NULL,
	`model` text NOT NULL,
	`unit_type` text NOT NULL,
	`price_per_unit` real NOT NULL,
	`gross_qty` integer NOT NULL,
	`gross_amount` real NOT NULL,
	`discount_qty` integer NOT NULL,
	`discount_amount` real NOT NULL,
	`net_qty` integer NOT NULL,
	`net_amount` real NOT NULL,
	`pulled_at` text NOT NULL,
	PRIMARY KEY(`billing_month`, `username`, `sku`, `model`)
);
--> statement-breakpoint
CREATE INDEX `gh_usage_by_user` ON `gh_usage_facts` (`username`,`billing_month`);--> statement-breakpoint
CREATE INDEX `gh_usage_by_month` ON `gh_usage_facts` (`billing_month`);--> statement-breakpoint
CREATE TABLE `m365_app_activity` (
	`pull_date` text NOT NULL,
	`upn` text NOT NULL,
	`app` text NOT NULL,
	`last_active` text,
	PRIMARY KEY(`pull_date`, `upn`, `app`)
);
--> statement-breakpoint
CREATE TABLE `m365_interactions_weekly` (
	`week_starting` text NOT NULL,
	`upn` text NOT NULL,
	`app_context` text NOT NULL,
	`interaction_count` integer NOT NULL,
	PRIMARY KEY(`week_starting`, `upn`, `app_context`)
);
--> statement-breakpoint
CREATE TABLE `m365_usage_facts` (
	`pull_date` text NOT NULL,
	`upn` text NOT NULL,
	`upn_is_hashed` integer NOT NULL,
	`display_name` text,
	`last_activity` text,
	`days_since_active` integer,
	`seat_sku` text NOT NULL,
	`seat_cost_usd` real NOT NULL,
	PRIMARY KEY(`pull_date`, `upn`)
);
--> statement-breakpoint
CREATE TABLE `identity_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gh_username` text,
	`m365_upn` text,
	`display_name` text NOT NULL,
	`team` text NOT NULL,
	`cost_center` text,
	`start_date` text,
	`end_date` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_map_gh_username_unique` ON `identity_map` (`gh_username`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_map_m365_upn_unique` ON `identity_map` (`m365_upn`);--> statement-breakpoint
CREATE TABLE `api_drift_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`detected_at` text NOT NULL,
	`source` text NOT NULL,
	`field_path` text NOT NULL,
	`unexpected_value` text,
	`payload_sample` text
);
--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pipeline` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`error_message` text,
	`rows_affected` integer
);
