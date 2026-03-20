import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createNodeSqliteConnection } from '../packages/db/src/server/node-sqlite';
import { createFileSessionStore } from '../packages/automation/src/session-store';

type ChromeCookieRow = {
  host_key: string;
  name: string;
  path: string;
  expires_utc: number;
  is_secure: number;
  is_httponly: number;
  samesite: number;
  encrypted_value: Uint8Array | Buffer | null;
  value: string | null;
};

function toSameSite(value: number) {
  if (value === 1) {
    return 'Lax';
  }
  if (value === 2) {
    return 'Strict';
  }
  if (value === 0 || value === -1) {
    return 'None';
  }
  return undefined;
}

async function main() {
  const accountId = process.argv[2] ?? 'local-account';
  const userDataDir = process.env.USER_DATA_DIR?.trim();

  if (!userDataDir) {
    throw new Error('USER_DATA_DIR is required.');
  }

  const profileCandidates = ['Default', 'Profile 1'];
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mycrm-linkedin-cookies-'));
  const copiedCookiesDbPath = path.join(tempDir, 'Cookies');
  let sqlite: Awaited<ReturnType<typeof createNodeSqliteConnection>> | undefined;

  try {
    let rows: ChromeCookieRow[] = [];

    for (const profileName of profileCandidates) {
      const sourceCookiesDbPath = path.resolve(userDataDir, profileName, 'Network', 'Cookies');
      if (!fs.existsSync(sourceCookiesDbPath)) {
        continue;
      }

      try {
        await copyFileWithSharedRead(sourceCookiesDbPath, copiedCookiesDbPath);
        sqlite = await createNodeSqliteConnection(`file:${copiedCookiesDbPath.replace(/\\/g, '/')}`);
        rows = await sqlite.all<ChromeCookieRow>(`
          select
            host_key,
            name,
            path,
            expires_utc,
            is_secure,
            is_httponly,
            samesite,
            encrypted_value,
            value
          from cookies
          where host_key like '%linkedin.com%'
          order by host_key, name
        `);
      } catch (error) {
        console.warn(`Skipping Chrome profile ${profileName}: ${String(error)}`);
        if (sqlite) {
          await sqlite.close().catch(() => undefined);
          sqlite = undefined;
        }
        continue;
      }

      if (rows.length > 0) {
        console.log(`Using Chrome profile: ${profileName}`);
        break;
      }

      await sqlite.close();
      sqlite = undefined;
    }

    const cookies = rows
      .map((row) => {
        const encryptedValue = row.encrypted_value
          ? Buffer.from(row.encrypted_value as Uint8Array).toString('base64')
          : '';
        const value = row.value ?? '';

        return {
          name: row.name,
          value,
          encryptedValue,
          domain: row.host_key,
          path: row.path,
          secure: Boolean(row.is_secure),
          httpOnly: Boolean(row.is_httponly),
          sameSite: toSameSite(row.samesite),
          expires: row.expires_utc > 0 ? row.expires_utc : undefined
        };
      })
      .filter((cookie) => cookie.name && (cookie.value || cookie.encryptedValue));

    console.log(JSON.stringify({ count: cookies.length, names: cookies.map((cookie) => cookie.name) }, null, 2));

    if (cookies.length === 0) {
      throw new Error('No LinkedIn cookies found in the configured Chrome profile.');
    }

    const sessionStore = createFileSessionStore();
    await sessionStore.save({
      accountId,
      cookiesJson: JSON.stringify(cookies),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      capturedAt: Date.now()
    });

    console.log(`Saved LinkedIn session for ${accountId}.`);
  } finally {
    if (sqlite) {
      await sqlite.close();
    }
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function copyFileWithSharedRead(sourcePath: string, destinationPath: string) {
  await new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath, {
      flags: 'r'
    });
    const writeStream = fs.createWriteStream(destinationPath, {
      flags: 'w'
    });

    const cleanup = (error?: Error) => {
      readStream.destroy();
      writeStream.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    readStream.on('error', cleanup);
    writeStream.on('error', cleanup);
    writeStream.on('close', () => resolve());
    readStream.pipe(writeStream);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});