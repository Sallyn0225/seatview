-- Before issue #29, admin deletes soft-deleted D1 rows after purging the R2
-- object. Those legacy rows cannot be restored safely, so remove them before
-- the recycle-bin UI lists restorable rows.
DELETE FROM `photos` WHERE `deleted_at` IS NOT NULL;
