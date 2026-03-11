import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get idle_alert_days setting
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "idle_alert_days")
      .maybeSingle();

    const idleDays = parseInt(setting?.value || "180", 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - idleDays);
    const cutoffISO = cutoffDate.toISOString();

    // Find active deals with no recent activity
    const { data: activeDeals, error: dealsErr } = await supabase
      .from("deals")
      .select("id, name, owner_id, updated_at")
      .not("stage", "in", '("fechado","perdido")')
      .lt("updated_at", cutoffISO);

    if (dealsErr) throw dealsErr;
    if (!activeDeals?.length) {
      return new Response(JSON.stringify({ message: "Nenhum negócio inativo encontrado", checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For each idle deal, check if there's a recent activity or task
    let notified = 0;
    for (const deal of activeDeals) {
      // Check recent activities
      const { data: recentActivity } = await supabase
        .from("activities")
        .select("id")
        .eq("company_id", deal.id)
        .gte("activity_date", cutoffISO)
        .limit(1)
        .maybeSingle();

      if (recentActivity) continue;

      // Check recent tasks
      const { data: recentTask } = await supabase
        .from("tasks")
        .select("id")
        .eq("deal_id", deal.id)
        .gte("created_at", cutoffISO)
        .limit(1)
        .maybeSingle();

      if (recentTask) continue;

      // Check if notification already sent recently (avoid spam)
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("entity_id", deal.id)
        .eq("type", "idle_deal")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (existingNotif) continue;

      // Create notification
      await supabase.from("notifications").insert({
        user_id: deal.owner_id,
        type: "idle_deal",
        title: `Negócio inativo: ${deal.name}`,
        description: `Este negócio está sem atividades há mais de ${idleDays} dias. Considere atualizar ou fechar.`,
        entity_type: "deal",
        entity_id: deal.id,
      });
      notified++;
    }

    return new Response(JSON.stringify({ success: true, checked: activeDeals.length, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erro ao verificar negócios inativos" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
