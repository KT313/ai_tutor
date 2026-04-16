import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function atomicWrite(filePath: string, data: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, filePath);
}
