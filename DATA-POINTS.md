# RevLog — Vehicle Data-Point Inventory

The canonical list of everything RevLog tracks per vehicle. **Update this file
whenever a field, spec candidate, service type, or table is added** — this is
also marketing ammunition ("RevLog knows 45+ things about your car"), so keep
the counts honest.

Counts as of 2026-08-03: **9 identity fields · 16 named spec fields (plus
unlimited chat-stated specs) · 12 service types × 7 fields per event ·
6 insurance fields · 5 document folders**.

## 1. Vehicle identity (`vehicles` table)

| # | Field | How it gets filled |
|---|-------|--------------------|
| 1 | Make | onboarding picker / garage edit |
| 2 | Model | onboarding picker / garage edit |
| 3 | Year | onboarding / garage edit |
| 4 | **Trim / submodel** (LX, EX-L…) | **decoded from the VIN** (free NHTSA vPIC API) — the "which trim?" answer parts stores ask for |
| 5 | Color | swatch picker |
| 6 | Body type (sedan/SUV/truck/motorcycle) | onboarding (drives the 3D model) |
| 7 | VIN | typed or 📷 photo-OCR'd; click-to-copy in header |
| 8 | License plate | typed or 📷 photo-OCR'd; rendered on the 3D model |
| 9 | Current mileage (+ last-updated date) | onboarding, garage edit, chat mileage prompts |

## 2. Hardware specs (`vehicle_specs` table)

Facts about the car (not events). Each row: name, label, value, and
**source** — `oem` (stock value, "stock" badge) vs `user` (stated/confirmed —
never overwritten by stock pulls).

**Seeded at initialization** (LLM pull, trim-aware when a VIN is on file):

| # | name | Label |
|---|------|-------|
| 1 | `oil_type` | Oil type (e.g. 0W-20 full synthetic) |
| 2 | `oil_capacity` | Oil capacity |
| 3 | `oil_filter_part` | Oil filter part # |
| 4 | `oil_drain_plug_size` | Oil drain plug socket size |
| 5 | `engine_air_filter_part` | Engine air filter |
| 6 | `cabin_air_filter_part` | Cabin air filter |
| 7 | `tire_size` | Tire size |
| 8 | `tire_pressure` | Tire pressure (front/rear) |
| 9 | `battery_group` | Battery group |
| 10 | `wiper_size_driver` | Wiper (driver) |
| 11 | `wiper_size_passenger` | Wiper (passenger) |
| 12 | `fuel_type` | Fuel type |
| 13 | `coolant_type` | Coolant type |

**Decoded straight from the VIN** (no LLM, NHTSA):

| # | name | Label |
|---|------|-------|
| 14 | `engine` | Engine (e.g. "3.5L V6 (280 hp)") |
| 15 | `drive_type` | Drivetrain (FWD/4x4…) |
| 16 | `transmission` | Transmission (e.g. "6-speed automatic") |

**Unlimited via chat**: the spec intent extracts and saves *any* stated fact
("my drain plug is 14mm", "I run a K&N filter", "lift kit is 2 inches") with a
freeform name/label — the list above is a floor, not a ceiling. The
"Customizations" field at onboarding does the same for mods.

## 3. Maintenance events (`maintenance_logs` table)

Per event: service type · zone · date · mileage · product brand · product
name · product details (JSON) · notes · raw input (what the user actually said).

Service catalog (drives reminders — mileage / month intervals):

| # | Service | Zone | Interval |
|---|---------|------|----------|
| 1 | Oil change | hood | 5,000 mi / 6 mo |
| 2 | Coolant flush | hood | 60,000 mi / 60 mo |
| 3 | Brake fluid | hood | 30,000 mi / 24 mo |
| 4 | Transmission fluid | hood | 60,000 mi / 36 mo |
| 5 | Air filter | hood | 20,000 mi / 24 mo |
| 6 | Cabin air filter | hood | 15,000 mi / 12 mo |
| 7 | Battery | hood | 48 mo |
| 8 | Brake pads | wheels | 40,000 mi |
| 9 | Tire rotation | wheels | 7,500 mi / 6 mo |
| 10 | Tires | wheels | 50,000 mi |
| 11 | Rotors | wheels | 70,000 mi |
| 12 | Wiper blades | windshield | 12 mo |

Derived from these: **alerts** (`alerts` table — due services glow red on the
3D model, 🔔 reminders in chat replies, auto-completed when the service is
logged) and **proactive suggestions** (never-logged services past their
typical interval, nudged on fresh odometer readings).

## 4. Insurance (`vehicle_insurance` table)

Carrier · policy # · monthly premium · coverage description · renewal date ·
notes. Filled conversationally ("my insurance is Progressive, policy ABC-123,
$140 a month"); partial updates merge.

## 5. Glovebox documents (`documents` table + private storage)

Photo/PDF uploads (10 MB cap) in five folders: Maintenance receipts ·
Insurance & registration · Title & purchase · Warranty & manuals · Other.

## Marketing angles this supports

- **"Tell it once, never look it up again"** — oil spec, drain plug size,
  filter part numbers, wiper sizes: the stuff you re-google in the parts-store
  aisle is one chat question away.
- **"It knows your exact trim"** — VIN decode answers the AutoZone counter
  question ("LX or EX?") automatically, and stock specs are pulled for *that*
  trim, not the most common one.
- **"45+ data points from day one"** — identity + auto-pulled stock specs +
  VIN-decoded hardware before the user types a single fact.
- **Confirmed vs stock** — RevLog distinguishes what *you* said from factory
  defaults, and never overwrites your word with a database guess.

## Not tracked yet (ideas parked in BACKLOG)

- Brake rotor sizes, spark plug part/gap, serpentine belt part, transmission
  fluid type, differential/transfer-case fluids, headlight bulb types, fuse
  map, lug nut torque/socket size, hitch/towing capacity, paint code.
- Fuel economy log, expenses/cost tracking, recalls (NHTSA has a free recall
  API keyed off VIN — natural next step), warranty expiration tracking.
