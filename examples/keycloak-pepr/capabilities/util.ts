import * as crypto from "crypto";

/**
 * Generate a random password of the given length
 *
 * @param length
 * @returns
 */
export function generatePassword(length = 16) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const buf = crypto.randomBytes(length);
  const password = Array.from(buf, byte => chars[byte % chars.length]).join("");

  return password;
}
