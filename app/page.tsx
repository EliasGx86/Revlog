import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import HomeClient from "@/components/home-client";
import type { Vehicle, Profile } from "@/lib/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/sign-in");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<Vehicle[]>();

  if (!vehicles || vehicles.length === 0) redirect("/onboarding");

  // ?v=<id> selects a vehicle from the garage; default to the first one.
  const vehicle = vehicles.find((x) => x.id === searchParams.v) ?? vehicles[0];

  // BETA: free for everyone — no subscription gate. When Stripe launches,
  // restore the check on profile.subscription_status here.

  return <HomeClient profile={profile} vehicle={vehicle} vehicles={vehicles} />;
}
