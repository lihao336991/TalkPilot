import { readFileSync } from 'node:fs';
import path from 'node:path';

export function loadEnvFile(repoRoot) {
  const envPath = path.join(repoRoot, '.env');

  try {
    const content = readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const equalIndex = trimmedLine.indexOf('=');

      if (equalIndex <= 0) {
        continue;
      }

      const key = trimmedLine.slice(0, equalIndex).trim();
      const rawValue = trimmedLine.slice(equalIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {}
}
