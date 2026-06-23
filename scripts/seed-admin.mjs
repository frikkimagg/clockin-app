// One-time setup script: creates the first admin employee so you can log
// into /admin and add everyone else through the UI from then on.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-admin.mjs "Your Name" 1234
//
// Or, if you have a .env.local file in the project root:
//   node -r dotenv/config scripts/seed-admin.mjs "Your Name" 1234

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const [, , name, pin] = process.argv;

if (!name || !pin) {
  console.error('Usage: node scripts/seed-admin.mjs "Your Name" 1234');
  process.exit(1);
}

if (!/^\d{4,8}$/.test(pin)) {
  console.error("PIN must be 4-8 digits.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const pin_hash = await bcrypt.hash(pin, 10);

const { data, error } = await supabase
  .from("employees")
  .insert({ name, pin_hash, is_admin: true, active: true })
  .select()
  .single();

if (error) {
  console.error("Failed to create admin:", error.message);
  process.exit(1);
}

console.log(`Created admin employee "${data.name}" with id ${data.id}.`);
console.log("You can now log into /admin with the PIN you chose.");
