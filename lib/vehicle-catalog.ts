import type { BodyType } from "./types";

// Curated vehicles for the beta picker. Each maps to the closest 3D body type
// so the rendered model roughly matches what the user drives. Expand this list
// (and eventually give entries their own model/proportions) as requests come in
// via the vehicle_requests table.
export interface CatalogVehicle {
  id: string;
  make: string;
  model: string;
  bodyType: BodyType;
}

// First pass: popular picks in Colorado.
export const VEHICLE_CATALOG: CatalogVehicle[] = [
  { id: "chevrolet-colorado", make: "Chevrolet", model: "Colorado", bodyType: "truck" },
  { id: "ford-f150",          make: "Ford",      model: "F-150",    bodyType: "truck" },
  { id: "ram-1500",           make: "Ram",       model: "1500",     bodyType: "truck" },
  { id: "toyota-rav4",        make: "Toyota",    model: "RAV4",     bodyType: "suv" },
  { id: "subaru-outback",     make: "Subaru",    model: "Outback",  bodyType: "suv" },
  { id: "honda-civic",        make: "Honda",     model: "Civic",    bodyType: "sedan" },
];
