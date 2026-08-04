import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 3) return "Username must be at least 3 characters.";
  if (trimmed.length > 40) return "Username must be at most 40 characters.";
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return "Username may only contain letters, numbers, dots, underscores, and hyphens.";
  }
  return null;
}
