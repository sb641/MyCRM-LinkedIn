CREATE TABLE `contacts` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `company` text,
  `position` text,
  `headline` text,
  `profile_url` text,
  `linkedin_profile_id` text,
  `relationship_status` text NOT NULL DEFAULT 'new',
  `last_interaction_at` integer,
  `last_reply_at` integer,
  `last_sent_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `contacts_linkedin_profile_id_idx` ON `contacts` (`linkedin_profile_id`);
CREATE INDEX `contacts_relationship_status_idx` ON `contacts` (`relationship_status`);
CREATE INDEX `contacts_last_interaction_at_idx` ON `contacts` (`last_interaction_at`);

CREATE TABLE `conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `contact_id` text NOT NULL,
  `linkedin_thread_id` text NOT NULL,
  `last_message_date` integer,
  `last_sender` text,
  `last_synced_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `conversations_linkedin_thread_id_idx` ON `conversations` (`linkedin_thread_id`);
CREATE INDEX `conversations_contact_id_idx` ON `conversations` (`contact_id`);

CREATE TABLE `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `linkedin_message_id` text NOT NULL,
  `sender` text NOT NULL,
  `sender_type` text NOT NULL,
  `content` text NOT NULL,
  `timestamp` integer NOT NULL,
  `is_inbound` integer NOT NULL,
  `raw_payload` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `messages_linkedin_message_id_idx` ON `messages` (`linkedin_message_id`);
CREATE INDEX `messages_conversation_timestamp_idx` ON `messages` (`conversation_id`, `timestamp`);

CREATE TABLE `drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `contact_id` text NOT NULL,
  `conversation_id` text NOT NULL,
  `goal_text` text NOT NULL,
  `approved_text` text,
  `draft_status` text NOT NULL DEFAULT 'none',
  `send_status` text NOT NULL DEFAULT 'idle',
  `model_name` text,
  `approved_at` integer,
  `sent_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE cascade,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade
);
CREATE INDEX `drafts_contact_id_idx` ON `drafts` (`contact_id`);
CREATE INDEX `drafts_conversation_id_idx` ON `drafts` (`conversation_id`);

CREATE TABLE `draft_variants` (
  `id` text PRIMARY KEY NOT NULL,
  `draft_id` text NOT NULL,
  `variant_index` integer NOT NULL,
  `text` text NOT NULL,
  `selected` integer NOT NULL DEFAULT false,
  `score` integer,
  FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `draft_variants_draft_variant_idx` ON `draft_variants` (`draft_id`, `variant_index`);

CREATE TABLE `jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `payload` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `attempt_count` integer NOT NULL DEFAULT 0,
  `locked_at` integer,
  `last_error` text,
  `scheduled_for` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `jobs_status_scheduled_for_idx` ON `jobs` (`status`, `scheduled_for`);

CREATE TABLE `sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `status` text NOT NULL DEFAULT 'running',
  `started_at` integer NOT NULL,
  `finished_at` integer,
  `items_scanned` integer NOT NULL DEFAULT 0,
  `items_imported` integer NOT NULL DEFAULT 0,
  `error` text
);

CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `is_secret` integer NOT NULL DEFAULT false
);

CREATE TABLE `audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `action` text NOT NULL,
  `payload` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
