-- Task 1.4: full-text search over notes (ARCHITECTURE §3.3 notes_fts). Hand-written: drizzle-kit
-- doesn't know FTS5. The index holds each note's title and plain text, keyed by `note_id`, and
-- triggers keep it in step with `notes`. Deleted notes stay indexed (undo) and are filtered out
-- by the search query, which joins back to `notes`.
CREATE VIRTUAL TABLE `notes_fts` USING fts5(
	`note_id` UNINDEXED,
	`title`,
	`content_text`,
	tokenize = 'unicode61 remove_diacritics 2',
	prefix = '2 3'
);
--> statement-breakpoint
CREATE TRIGGER `notes_fts_after_insert` AFTER INSERT ON `notes` BEGIN
	DELETE FROM `notes_fts` WHERE `note_id` = new.`id`;
	INSERT INTO `notes_fts` (`note_id`, `title`, `content_text`)
		VALUES (new.`id`, new.`title`, new.`content_text`);
END;
--> statement-breakpoint
CREATE TRIGGER `notes_fts_after_update` AFTER UPDATE OF `id`, `title`, `content_text` ON `notes` BEGIN
	DELETE FROM `notes_fts` WHERE `note_id` = old.`id`;
	INSERT INTO `notes_fts` (`note_id`, `title`, `content_text`)
		VALUES (new.`id`, new.`title`, new.`content_text`);
END;
--> statement-breakpoint
CREATE TRIGGER `notes_fts_after_delete` AFTER DELETE ON `notes` BEGIN
	DELETE FROM `notes_fts` WHERE `note_id` = old.`id`;
END;
--> statement-breakpoint
INSERT INTO `notes_fts` (`note_id`, `title`, `content_text`)
	SELECT `id`, `title`, `content_text` FROM `notes`;
