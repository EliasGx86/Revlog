import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import HomeClient from "@/components/home-client";
import type { Vehicle, Profile } from "@/lib/types";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/sign-in");

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Vehicle>();

  if (!vehicle) redirect("/onboarding");

  // Gate behind active subscription. If checkout completed but webhook hasn't
  // fired yet, profile.subscription_status will be 'incomplete' and we send
  // them back to onboarding (which will resume at checkout).
  if (profile.subscription_status !== "active" && profile.subscription_status !== "trialing") {
    redirect("/onboarding");
  }

  return <HomeClient profile={profile} vehicle={vehicle} />;
}
