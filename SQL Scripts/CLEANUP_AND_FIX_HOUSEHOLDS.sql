-- Cleanup and fix script for household tables
-- This removes the problematic policies and recreates them correctly

-- First, drop all existing policies that might cause recursion
-- Drop old policy names
DROP POLICY IF EXISTS "Users can view households they are members of" ON public.households;
DROP POLICY IF EXISTS "Users can create households" ON public.households;
DROP POLICY IF EXISTS "Household owners can update their household" ON public.households;
DROP POLICY IF EXISTS "Household owners can delete their household" ON public.households;

DROP POLICY IF EXISTS "Users can view members of their households" ON public.household_members;
DROP POLICY IF EXISTS "Household owners can add members" ON public.household_members;
DROP POLICY IF EXISTS "Users can remove themselves from households" ON public.household_members;
DROP POLICY IF EXISTS "Household owners can remove members" ON public.household_members;

DROP POLICY IF EXISTS "Users can view invitations to their email" ON public.household_invitations;
DROP POLICY IF EXISTS "Household owners can create invitations" ON public.household_invitations;
DROP POLICY IF EXISTS "Users can update invitations sent to them" ON public.household_invitations;

-- Drop new policy names (in case script was run partially)
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.household_members;
DROP POLICY IF EXISTS "Users can insert memberships for households they own" ON public.household_members;

-- RLS Policies for household_members table (MUST BE CREATED FIRST to avoid recursion)
CREATE POLICY "Users can view their own memberships"
    ON public.household_members FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert memberships for households they own"
    ON public.household_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.household_members AS hm
            WHERE hm.household_id = household_members.household_id
            AND hm.user_id = auth.uid()
            AND hm.role = 'owner'
        )
    );

CREATE POLICY "Users can remove themselves from households"
    ON public.household_members FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Household owners can remove members"
    ON public.household_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.household_members AS hm
            WHERE hm.household_id = household_members.household_id
            AND hm.user_id = auth.uid()
            AND hm.role = 'owner'
        )
    );

-- RLS Policies for households table
CREATE POLICY "Users can view households they are members of"
    ON public.households FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = households.id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create households"
    ON public.households FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Household owners can update their household"
    ON public.households FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = households.id
            AND user_id = auth.uid()
            AND role = 'owner'
        )
    );

CREATE POLICY "Household owners can delete their household"
    ON public.households FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = households.id
            AND user_id = auth.uid()
            AND role = 'owner'
        )
    );

-- RLS Policies for household_invitations table
CREATE POLICY "Users can view invitations to their email"
    ON public.household_invitations FOR SELECT
    USING (
        invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = household_invitations.household_id
            AND user_id = auth.uid()
            AND role = 'owner'
        )
    );

CREATE POLICY "Household owners can create invitations"
    ON public.household_invitations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = household_invitations.household_id
            AND user_id = auth.uid()
            AND role = 'owner'
        )
    );

CREATE POLICY "Users can update invitations sent to them"
    ON public.household_invitations FOR UPDATE
    USING (invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Update RLS policies for fridge_items to use household_id
DROP POLICY IF EXISTS "Users can view their own items" ON public.fridge_items;
DROP POLICY IF EXISTS "Users can insert their own items" ON public.fridge_items;
DROP POLICY IF EXISTS "Users can update their own items" ON public.fridge_items;
DROP POLICY IF EXISTS "Users can delete their own items" ON public.fridge_items;
DROP POLICY IF EXISTS "Users can view items in their household" ON public.fridge_items;
DROP POLICY IF EXISTS "Users can insert items in their household" ON public.fridge_items;
DROP POLICY IF EXISTS "Users can update items in their household" ON public.fridge_items;
DROP POLICY IF EXISTS "Users can delete items in their household" ON public.fridge_items;

CREATE POLICY "Users can view items in their household"
    ON public.fridge_items FOR SELECT
    USING (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = fridge_items.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Users can insert items in their household"
    ON public.fridge_items FOR INSERT
    WITH CHECK (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = fridge_items.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Users can update items in their household"
    ON public.fridge_items FOR UPDATE
    USING (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = fridge_items.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete items in their household"
    ON public.fridge_items FOR DELETE
    USING (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = fridge_items.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

-- Update RLS policies for drawers to use household_id
DROP POLICY IF EXISTS "Users can view their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can create their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can update their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can delete their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can view drawers in their household" ON public.drawers;
DROP POLICY IF EXISTS "Users can create drawers in their household" ON public.drawers;
DROP POLICY IF EXISTS "Users can update drawers in their household" ON public.drawers;
DROP POLICY IF EXISTS "Users can delete drawers in their household" ON public.drawers;

CREATE POLICY "Users can view drawers in their household"
    ON public.drawers FOR SELECT
    USING (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = drawers.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Users can create drawers in their household"
    ON public.drawers FOR INSERT
    WITH CHECK (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = drawers.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Users can update drawers in their household"
    ON public.drawers FOR UPDATE
    USING (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = drawers.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete drawers in their household"
    ON public.drawers FOR DELETE
    USING (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = drawers.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );
