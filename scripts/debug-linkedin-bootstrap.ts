import { createFileSessionStore } from '../packages/automation/src/session-store';
import {
  captureLinkedInSessionFromDirectPersistentProfile,
  captureLinkedInSessionFromChromeProfile
} from '../packages/automation/src/index';
import { getLinkedInAuthBootstrapState } from '../packages/automation/src/auth-config';

async function main() {
  const accountId = process.argv[2] ?? 'local-account';
  const mode = process.argv[3] ?? 'direct';
  const sessionStore = createFileSessionStore();
  const state = await getLinkedInAuthBootstrapState();

  console.log(
    JSON.stringify(
      {
        accountId,
        mode,
        legacyConfig: {
          userDataDir: state.legacyConfig.userDataDir,
          proxyUrl: state.legacyConfig.proxyUrl,
          cdpUrl: state.legacyConfig.cdpUrl,
          hasLinkedinUsername: Boolean(state.legacyConfig.linkedinUsername),
          hasLinkedinPassword: Boolean(state.legacyConfig.linkedinPassword)
        },
        checks: state.checks
      },
      null,
      2
    )
  );

  const session =
    mode === 'cdp'
      ? await captureLinkedInSessionFromChromeProfile(accountId, sessionStore)
      : await captureLinkedInSessionFromDirectPersistentProfile(accountId, sessionStore);

  console.log(
    JSON.stringify(
      {
        capturedAt: session.capturedAt,
        userAgent: session.userAgent
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});