import { randomBytes } from "crypto";

export function generateMemberToken(): string {
  return randomBytes(24).toString("base64url");
}
