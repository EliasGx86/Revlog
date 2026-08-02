import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVICE_CATALOG } from "@/lib/types";

// Reminder pass that runs on every entry (service log or mileage answer):
// pending alerts are checked against the odometer/calendar and surfaced in
// the chat reply. This is the in-app half of alerts; push/email is v2.

interface PendingAlert {
  service_type: string;
  due_date: string | null;
  due_mileage: number | null;
}

/**
 * A logged service satisfies any older pending reminder for that same
 * service (you did the oil change → the "oil change due" alert is done).
 */
export async function completeMatchingAlerts(
  supabase: SupabaseClient,
  vehicleId: string,
  userId: string,
  serviceType: string
) {
  await supabase
    .from("alerts")
    .update({ status: "completed" })
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId)
    .eq("service_type", serviceType)
    .eq("status", "pending");
}

/**
 * Check pending alerts against current mileage/date. Returns a short note to
 * append to a chat reply, or null when nothing is due or coming up.
 */
export async function buildReminderNote(
  supabase: SupabaseClient,
  vehicleId: string,
  currentMileage: number
): Promise<string | null> {
  const { data } = await supabase
    .from("alerts")
    .select("service_type, due_date, due_mileage")
    .eq("vehicle_id", vehicleId)
    .eq("status", "pending");
  const alerts = (data ?? []) as PendingAlert[];
  if (!alerts.length) return null;

  // One reminder per service type — keep the most urgent (earliest due).
  const byType = new Map<string, PendingAlert>();
  for (const a of alerts) {
    const prev = byType.get(a.service_type);
    if (
      !prev ||
      (a.due_mileage ?? Infinity) < (prev.due_mileage ?? Infinity) ||
      (a.due_date ?? "9999") < (prev.due_date ?? "9999")
    ) {
      byType.set(a.service_type, a);
    }
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const SOON_MILES = 500;
  const SOON_DAYS = 21;

  const due: string[] = [];
  const soon: string[] = [];

  for (const a of byType.values()) {
    const label =
      SERVICE_CATALOG[a.service_type as keyof typeof SERVICE_CATALOG]?.label ??
      a.service_type;

    const mileageDue = a.due_mileage != null && currentMileage >= a.due_mileage;
    const dateDue = a.due_date != null && a.due_date <= todayIso;

    if (mileageDue) {
      due.push(
        `${label} is due — was due at ${a.due_mileage!.toLocaleString()} mi, you're at ${currentMileage.toLocaleString()}`
      );
      continue;
    }
    if (dateDue) {
      due.push(`${label} is due — was due ${a.due_date}`);
      continue;
    }

    const milesLeft =
      a.due_mileage != null ? a.due_mileage - currentMileage : Infinity;
    const daysLeft =
      a.due_date != null
        ? Math.ceil(
            (new Date(a.due_date).getTime() - today.getTime()) / 86_400_000
          )
        : Infinity;

    if (milesLeft <= SOON_MILES) {
      soon.push(`${label} coming up in ~${milesLeft.toLocaleString()} mi`);
    } else if (daysLeft <= SOON_DAYS) {
      soon.push(`${label} coming up in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`);
    }
  }

  const parts = [...due, ...soon].slice(0, 3);
  if (!parts.length) return null;
  return `🔔 ${parts.join(". ")}.`;
}

/**
 * Proactive suggestions for a FRESH odometer reading: services we've never
 * seen logged whose typical interval has already passed. Distinct from
 * buildReminderNote, which only re-surfaces alerts the app itself scheduled —
 * this one catches maintenance the user has never told us about at all.
 * Kept to the 2 most-overdue so it reads as a nudge, not a lecture.
 */
export async function buildSuggestionNote(
  supabase: SupabaseClient,
  vehicleId: string,
  currentMileage: number
): Promise<string | null> {
  if (currentMileage <= 0) return null;

  const [{ data: logs }, { data: alerts }] = await Promise.all([
    supabase.from("maintenance_logs").select("service_type").eq("vehicle_id", vehicleId),
    supabase
      .from("alerts")
      .select("service_type")
      .eq("vehicle_id", vehicleId)
      .eq("status", "pending"),
  ]);
  const known = new Set([
    ...(logs ?? []).map((l) => l.service_type as string),
    ...(alerts ?? []).map((a) => a.service_type as string),
  ]);

  const candidates = Object.entries(SERVICE_CATALOG)
    .filter(
      ([type, cat]) =>
        cat.mileageInterval != null &&
        !known.has(type) &&
        currentMileage >= cat.mileageInterval
    )
    // most-overdue first, by how many intervals have elapsed
    .sort(
      ([, a], [, b]) =>
        currentMileage / b.mileageInterval! - currentMileage / a.mileageInterval!
    )
    .slice(0, 2);

  if (!candidates.length) return null;

  const list = candidates
    .map(
      ([, cat]) =>
        `${cat.label} (typical every ${cat.mileageInterval!.toLocaleString()} mi)`
    )
    .join(", ");
  return `💡 Nothing on record yet for: ${list}. If you've had these done, just tell me and I'll log them.`;
}
