
CREATE OR REPLACE FUNCTION public.get_estimator_availability()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'estimators', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name))
      FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'orcamentista'
    ), '[]'::jsonb),
    'deals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'orcamentista_id', d.orcamentista_id,
        'budget_start_date', d.budget_start_date,
        'proposal_delivery_date', d.proposal_delivery_date,
        'target_delivery_date', d.target_delivery_date,
        'close_date', d.close_date,
        'created_at', d.created_at,
        'stage', d.stage
      ))
      FROM public.deals d
      WHERE d.orcamentista_id IS NOT NULL
        AND d.stage NOT IN ('fechado', 'perdido', '__won__', '__lost__')
    ), '[]'::jsonb)
  );
$$;
