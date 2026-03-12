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
    const body = await req.json();
    const {
      requester_name, requester_email,
      client_name, client_role, client_email, client_phone, client_company,
      business_area, address, state, team_type, project_phase,
      has_team, team_description, qualification_level, target_delivery_date,
      orcamentista_id,
      // New fields
      carbono_zero, cortex, endereco_execucao, estudo_equipe, tipo_negocio, scope,
    } = body;

    // Validation
    if (!requester_name || typeof requester_name !== "string" || requester_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nome do solicitante é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!requester_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requester_email)) {
      return new Response(JSON.stringify({ error: "E-mail do solicitante inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!client_name || typeof client_name !== "string" || client_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nome do cliente é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!client_company || typeof client_company !== "string" || client_company.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Empresa é obrigatória" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!business_area || typeof business_area !== "string") {
      return new Response(JSON.stringify({ error: "Área de negócio é obrigatória" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find or create company
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("name", client_company.trim())
      .maybeSingle();

    let companyId: string;
    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({ name: client_company.trim() })
        .select("id")
        .single();
      if (companyError) throw companyError;
      companyId = newCompany.id;
    }

    // 2. Create contact
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        name: client_name.trim(),
        email: client_email?.trim().toLowerCase() || null,
        role: client_role?.trim() || null,
        company_id: companyId,
      })
      .select("id")
      .single();
    if (contactError) throw contactError;

    // 3. Find an owner (first admin, then any user)
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    const { data: anyUser } = !adminRole
      ? await supabase.from("user_roles").select("user_id").limit(1).maybeSingle()
      : { data: adminRole };

    const ownerId = anyUser?.user_id;
    if (!ownerId) {
      return new Response(JSON.stringify({ success: true, message: "Lead capturado sem negócio (nenhum usuário no sistema)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Generate proposal ID
    const { data: proposalId } = await supabase.rpc("generate_proposal_id", {
      company_name: client_company.trim(),
    });

    // 5. Build description from extra fields
    const descParts = [
      `Solicitante: ${requester_name.trim()} (${requester_email.trim()})`,
      client_phone ? `Telefone: ${client_phone}` : null,
      address ? `Endereço: ${address}` : null,
      state ? `Estado: ${state}` : null,
      team_type ? `Equipe: ${team_type}` : null,
      project_phase ? `Fase do projeto: ${project_phase}` : null,
      has_team ? `Cliente possui equipe: Sim — ${team_description || 'Não informado'}` : `Cliente possui equipe: Não`,
      qualification_level ? `Nível de qualificação: ${qualification_level}` : null,
    ].filter(Boolean).join("\n");

    // 6. Create deal — map requester_name → vendedor_externo, scope → scope
    const { data: newDeal, error: dealError } = await supabase.from("deals").insert({
      name: `Proposta - ${client_company.trim()}`,
      proposal_id: proposalId,
      company_id: companyId,
      contact_id: newContact.id,
      owner_id: ownerId,
      stage: "prospeccao",
      value: 0,
      business_area: business_area || null,
      market: null,
      target_delivery_date: target_delivery_date || null,
      orcamentista_id: orcamentista_id || null,
      approval_status: "pending",
      // New fields
      vendedor_externo: requester_name.trim(),
      scope: scope?.trim() || null,
      carbono_zero: !!carbono_zero,
      cortex: !!cortex,
      endereco_execucao: endereco_execucao?.trim() || null,
      estudo_equipe: estudo_equipe?.trim() || null,
      tipo_negocio: tipo_negocio || null,
    }).select("id").single();
    if (dealError) throw dealError;

    // 7. Log an activity with the full description
    await supabase.from("activities").insert({
      type: "proposal_request",
      title: `Solicitação de proposta recebida: ${client_company.trim()}`,
      description: descParts,
      company_id: companyId,
      contact_id: newContact.id,
      created_by: ownerId,
    });

    // 8. Notify Gerência of Orçamentos team for approval
    if (newDeal?.id) {
      const { data: orcTeam } = await supabase.from("teams").select("id").eq("name", "Orçamentos").maybeSingle();
      if (orcTeam) {
        const { data: teamMembers } = await supabase.from("team_members").select("user_id").eq("team_id", orcTeam.id);
        if (teamMembers) {
          for (const tm of teamMembers) {
            const { data: hasGerencia } = await supabase.rpc("has_role", { _user_id: tm.user_id, _role: "gerencia" });
            if (hasGerencia) {
              await supabase.from("notifications").insert({
                user_id: tm.user_id,
                type: "approval_request",
                title: `Aprovação pendente: Proposta - ${client_company.trim()}`,
                description: `Nova solicitação de proposta aguarda aprovação.`,
                entity_type: "deal",
                entity_id: newDeal.id,
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erro interno ao processar solicitação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
