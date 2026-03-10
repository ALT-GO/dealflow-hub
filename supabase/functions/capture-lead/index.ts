import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, company, role } = await req.json();

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!company || typeof company !== "string" || company.trim().length === 0 || company.length > 100) {
      return new Response(JSON.stringify({ error: "Empresa inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Create or find company
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("name", company.trim())
      .maybeSingle();

    let companyId: string;
    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({ name: company.trim() })
        .select("id")
        .single();
      if (companyError) throw companyError;
      companyId = newCompany.id;
    }

    // 2. Create contact
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role?.trim() || null,
        company_id: companyId,
      })
      .select("id")
      .single();
    if (contactError) throw contactError;

    // 3. Create deal in first funnel stage
    // Use a system owner — we'll get the first admin, or fallback to null-safe approach
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    // Fallback: get any user if no admin exists
    const { data: anyUser } = !adminRole
      ? await supabase.from("user_roles").select("user_id").limit(1).maybeSingle()
      : { data: adminRole };

    const ownerId = anyUser?.user_id;
    if (!ownerId) {
      // Still create company + contact, just skip the deal
      return new Response(JSON.stringify({ success: true, message: "Lead capturado (sem negócio — nenhum usuário no sistema)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: dealError } = await supabase.from("deals").insert({
      name: `Lead - ${company.trim()}`,
      company_id: companyId,
      contact_id: newContact.id,
      owner_id: ownerId,
      stage: "prospeccao",
      value: 0,
    });
    if (dealError) throw dealError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erro interno ao processar lead" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
