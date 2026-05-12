create or replace function public.remove_match_night_and_reverse(target_night_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with target_night as (
    select teams, team_results
    from public.match_nights
    where id = target_night_id
  ),
  player_adjustments as (
    select
      (player_item ->> 'id')::uuid as player_id,
      count(*)::int as games_to_remove,
      sum((team_item ->> 'goalDifferenceForNight')::int) as gd_to_remove
    from target_night
    cross join lateral jsonb_array_elements(teams) as team_item
    cross join lateral jsonb_array_elements(team_item -> 'players') as player_item
    where jsonb_array_length(team_results) > 0
    group by (player_item ->> 'id')::uuid
  )
  update public.players
  set
    games_played = greatest(0, public.players.games_played - player_adjustments.games_to_remove),
    goal_difference = public.players.goal_difference - player_adjustments.gd_to_remove,
    updated_at = now()
  from player_adjustments
  where public.players.id = player_adjustments.player_id;

  delete from public.match_nights
  where id = target_night_id;
end;
$$;

grant execute on function public.remove_match_night_and_reverse(uuid) to anon;
