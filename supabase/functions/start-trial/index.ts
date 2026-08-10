import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingProfile, error: fetchError } = await adminClient
      .from("profiles")
      .select("trial_used, is_premium, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingProfile?.trial_used) {
      return new Response(
        JSON.stringify({ error: "Trial already used" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const trialExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const currentExpiresAt = existingProfile?.premium_expires_at
      ? new Date(existingProfile.premium_expires_at)
      : null;
    const alreadyHasLongerPremium =
      existingProfile?.is_premium === true &&
      currentExpiresAt !== null &&
      currentExpiresAt > new Date(trialExpiresAt);

    const expiresAt = alreadyHasLongerPremium
      ? existingProfile!.premium_expires_at
      : trialExpiresAt;

    const profileFields = {
      is_premium: true,
      premium_expires_at: expiresAt,
      trial_used: true,
      updated_at: new Date().toISOString(),
    };

    if (!existingProfile) {
      // No profile row yet: insert it. If one was created concurrently
      // (e.g. by onboarding or a second start-trial call), fall back to
      // the guarded update below instead of erroring.
      const { error: insertError } = await adminClient
        .from("profiles")
        .insert({ id: user.id, ...profileFields });

      if (insertError && insertError.code !== "23505") throw insertError;
      if (!insertError) {
        return new Response(
          JSON.stringify({ ok: true, premium_expires_at: expiresAt }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Guard the write with .eq("trial_used", false) so two concurrent
    // requests can't both pass the check above and both grant a trial.
    const { data: updatedRows, error: updateError } = await adminClient
      .from("profiles")
      .update(profileFields)
      .eq("id", user.id)
      .eq("trial_used", false)
      .select("id");

    if (updateError) throw updateError;

    if (!updatedRows || updatedRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Trial already used" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, premium_expires_at: expiresAt }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
