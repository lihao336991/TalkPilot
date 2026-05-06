export function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }

  return value;
}
