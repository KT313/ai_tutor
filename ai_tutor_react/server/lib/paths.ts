import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Repo root is two levels up from server/lib/
const ROOT = resolve(__dirname, '..', '..');

export const CONTENT_DIR = resolve(ROOT, 'content');
export const HISTORIES_DIR = resolve(ROOT, 'histories');
