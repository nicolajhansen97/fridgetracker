-- Tracks each successful AI recipe generation so the edge function can
-- enforce a per-user daily cap. Only the edge function (service_role) writes
-- to this table — there are no RLS policies because no client should ever
-- read or modify it directly.

CREATE TABLE IF NOT EXISTS public.recipe_generation_log (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Speeds up "count(*) WHERE user_id = ? AND created_at >= today" lookups.
CREATE INDEX IF NOT EXISTS idx_recipe_gen_log_user_day
    ON public.recipe_generation_log(user_id, created_at DESC);

ALTER TABLE public.recipe_generation_log ENABLE ROW LEVEL SECURITY;

-- No policies on purpose. service_role bypasses RLS so the edge function can
-- still read/write. End-users get nothing.
