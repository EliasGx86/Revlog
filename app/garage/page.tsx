import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GarageClient from "@/components/garage-client";
import type { Vehicle } from "@/lib/types";

// The whole garage at a glance: every vehicle as a card, with open/edit/delete.

export const dynamic = "force-dynamic";

export default async function GaragePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<Vehicle[]>();

  if (!vehicles || vehicles.length === 0) redirect("/onboarding");

  return <GarageClient vehicles={vehicles} />;
}
