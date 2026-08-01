export type BodyType = "sedan" | "truck" | "suv";
export type Zone = "hood" | "wheels" | "windshield" | "other";
export type SubscriptionStatus =
  | "incomplete"
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";
export type Plan = "monthly" | "yearly";

export interface Profile {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_plan: Plan | null;
  subscription_current_period_end: string | null;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  body_type: BodyType;
  current_mileage: number;
  mileage_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  user_id: string;
  service_type: string;
  zone: Zone | null;
  service_date: string;
  mileage: number | null;
  product_brand: string | null;
  product_name: string | null;
  product_details: Record<string, unknown>;
  notes: string | null;
  raw_input: string | null;
  created_at: string;
}

// Service types we recognize and their zones + mileage intervals (miles)
// and time intervals (months). Used for alert generation.
export const SERVICE_CATALOG: Record<
  string,
  { zone: Zone; label: string; mileageInterval?: number; monthInterval?: number }
> = {
  oil_change:        { zone: "hood",       label: "Oil change",         mileageInterval: 5000,  monthInterval: 6 },
  coolant_flush:     { zone: "hood",       label: "Coolant flush",      mileageInterval: 60000, monthInterval: 60 },
  brake_fluid:       { zone: "hood",       label: "Brake fluid",        mileageInterval: 30000, monthInterval: 24 },
  transmission_fluid:{ zone: "hood",       label: "Transmission fluid", mileageInterval: 60000, monthInterval: 36 },
  air_filter:        { zone: "hood",       label: "Air filter",         mileageInterval: 20000, monthInterval: 24 },
  battery:           { zone: "hood",       label: "Battery",            monthInterval: 48 },
  brake_pads:        { zone: "wheels",     label: "Brake pads",         mileageInterval: 40000 },
  tire_rotation:     { zone: "wheels",     label: "Tire rotation",      mileageInterval: 7500,  monthInterval: 6 },
  tires:             { zone: "wheels",     label: "Tires",              mileageInterval: 50000 },
  rotors:            { zone: "wheels",     label: "Rotors",             mileageInterval: 70000 },
  wiper_blades:      { zone: "windshield", label: "Wiper blades",       monthInterval: 12 },
};

export type ServiceType = keyof typeof SERVICE_CATALOG;
