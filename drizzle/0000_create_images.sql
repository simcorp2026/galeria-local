CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`original_key` text NOT NULL,
	`thumb_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_original_key_unique` ON `images` (`original_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `images_thumb_key_unique` ON `images` (`thumb_key`);--> statement-breakpoint
CREATE INDEX `images_created_at_id_idx` ON `images` (`created_at`,`id`);