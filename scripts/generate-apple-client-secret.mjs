import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const APPLE_AUDIENCE = 'https://appleid.apple.com';
const MAX_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 180;

function printUsage() {
  console.error(`
Usage:
  node scripts/generate-apple-client-secret.mjs \\
    --team-id <APPLE_TEAM_ID> \\
    --key-id <APPLE_KEY_ID> \\
    --client-id <APPLE_SERVICES_ID> \\
    --private-key-path <AuthKey_XXXXXX.p8> \\
    [--expires-in <seconds>]

Or use environment variables:
  APPLE_TEAM_ID
  APPLE_KEY_ID
  APPLE_CLIENT_ID
  APPLE_PRIVATE_KEY_PATH
  APPLE_PRIVATE_KEY
  APPLE_EXPIRES_IN_SECONDS

Notes:
  - APPLE_CLIENT_ID should be your Apple Services ID used in Supabase Apple provider.
  - Expires in must be <= 15552000 seconds (180 days).
  - The generated token should be pasted into Supabase Dashboard -> Auth -> Providers -> Apple -> Secret.
`.trim());
}

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    result[key] = value;
    index += 1;
  }

  return result;
}

function getInput(args, argKey, envKey) {
  return args[argKey] ?? process.env[envKey] ?? '';
}

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getPrivateKeyPem(args) {
  const inlineKey = getInput(args, 'private-key', 'APPLE_PRIVATE_KEY');
  if (inlineKey) {
    return inlineKey.replace(/\\n/g, '\n');
  }

  const privateKeyPath = getInput(
    args,
    'private-key-path',
    'APPLE_PRIVATE_KEY_PATH',
  );

  if (!privateKeyPath) {
    throw new Error(
      'Missing Apple private key. Provide --private-key-path, APPLE_PRIVATE_KEY_PATH, --private-key, or APPLE_PRIVATE_KEY.',
    );
  }

  return readFileSync(privateKeyPath, 'utf8');
}

function validateRequired(name, value) {
  if (!value) {
    throw new Error(`Missing required value: ${name}`);
  }
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function generateAppleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKeyPem,
  expiresInSeconds,
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresInSeconds;

  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };

  const payload = {
    iss: teamId,
    iat: issuedAt,
    exp: expiresAt,
    aud: APPLE_AUDIENCE,
    sub: clientId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
  });

  const signature = sign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

try {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const teamId = getInput(args, 'team-id', 'APPLE_TEAM_ID');
  const keyId = getInput(args, 'key-id', 'APPLE_KEY_ID');
  const clientId = getInput(args, 'client-id', 'APPLE_CLIENT_ID');
  const privateKeyPem = getPrivateKeyPem(args);
  const expiresInSeconds = toPositiveInt(
    getInput(args, 'expires-in', 'APPLE_EXPIRES_IN_SECONDS'),
    MAX_EXPIRES_IN_SECONDS,
  );

  validateRequired('APPLE_TEAM_ID / --team-id', teamId);
  validateRequired('APPLE_KEY_ID / --key-id', keyId);
  validateRequired('APPLE_CLIENT_ID / --client-id', clientId);

  if (expiresInSeconds <= 0) {
    throw new Error('APPLE_EXPIRES_IN_SECONDS must be a positive integer.');
  }

  if (expiresInSeconds > MAX_EXPIRES_IN_SECONDS) {
    throw new Error(
      `APPLE_EXPIRES_IN_SECONDS cannot exceed ${MAX_EXPIRES_IN_SECONDS} seconds (180 days).`,
    );
  }

  const jwt = generateAppleClientSecret({
    teamId,
    keyId,
    clientId,
    privateKeyPem,
    expiresInSeconds,
  });

  process.stdout.write(`${jwt}\n`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Failed to generate Apple client secret.',
  );
  console.error('');
  printUsage();
  process.exit(1);
}
