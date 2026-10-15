import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

export function loadEnvFile(
  path: string = resolve(process.cwd(), '.env'),
): void {
  loadDotenv({
    path,
    override: false,
    quiet: true,
  });
}
