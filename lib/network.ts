import { NextRequest } from "next/server";

// Netlify (and most hosts) put the real client IP in x-forwarded-for or
// x-nf-client-connection-ip. x-forwarded-for can contain a comma-separated
// chain (client, proxy1, proxy2...) -- the first entry is the original
// client.
export function getClientIp(req: NextRequest): string | null {
  const nfIp = req.headers.get("x-nf-client-connection-ip");
  if (nfIp) return nfIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return null;
}

// `allowedIp` comes from the app_settings table now (admin-editable), not
// an environment variable -- the caller is responsible for fetching it.
// A blank/null value means "don't restrict."
export function isAllowedClockInIp(ip: string | null, allowedIp: string | null): boolean {
  if (!allowedIp) return true; // not configured -- don't restrict
  if (!ip) return false; // configured but we couldn't determine the IP
  return ip === allowedIp.trim();
}
