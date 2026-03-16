const TOOLS_ENCRYPTION_SECRET_ENV = "TOOLS_ENCRYPTION_SECRET";

export function getToolsEncryptionSecret() {
  const secret = process.env[TOOLS_ENCRYPTION_SECRET_ENV]?.trim();

  if (!secret) {
    throw new Error(`${TOOLS_ENCRYPTION_SECRET_ENV} is required to store API-key connections.`);
  }

  return secret;
}
