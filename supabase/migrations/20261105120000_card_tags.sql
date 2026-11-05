-- Card tags (2026-11-05): each card keeps its own tags as a JSON array of names, e.g.
-- ["Year 2", "Autonomic"]. They belong to the card's deck only, not to the Library's `tags`
-- table, so imported CSV tags no longer fill the Library's tag list. RLS on `cards` already
-- covers the new column; nothing else changes.
alter table public.cards add column tags_json jsonb not null default '[]'::jsonb;
