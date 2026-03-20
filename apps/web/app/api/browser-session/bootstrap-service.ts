import { AppError } from '@mycrm/core';
import { readLegacyEnvConfig } from '@mycrm/automation/src/auth-config';
import { createFileSessionStore } from '@mycrm/automation/src/session-store';
import { getManualBrowserSyncReadiness } from '@/lib/services/jobs-service';
import {
  loadCaptureLinkedInSessionFromDirectPersistentProfile,
  loadCaptureLinkedInSessionFromChromeProfile,
  loadLoginAndSaveSession
} from '@/lib/services/automation-bootstrap';

export async function bootstrapBrowserSession(accountId: string) {
  const legacyConfig = await readLegacyEnvConfig();
  const sessionStore = createFileSessionStore();

  if (legacyConfig.userDataDir && !legacyConfig.linkedinUsername && !legacyConfig.linkedinPassword) {
    try {
      const captureLinkedInSessionFromDirectPersistentProfile = await loadCaptureLinkedInSessionFromDirectPersistentProfile();
      const session = await captureLinkedInSessionFromDirectPersistentProfile(accountId, sessionStore);
      const readiness = await getManualBrowserSyncReadiness(accountId);

      return {
        accountId: session.accountId,
        capturedAt: session.capturedAt,
        userAgent: session.userAgent,
        readiness
      };
    } catch (error) {
      try {
        const captureLinkedInSessionFromChromeProfile = await loadCaptureLinkedInSessionFromChromeProfile();
        const session = await captureLinkedInSessionFromChromeProfile(accountId, sessionStore);
        const readiness = await getManualBrowserSyncReadiness(accountId);

        return {
          accountId: session.accountId,
          capturedAt: session.capturedAt,
          userAgent: session.userAgent,
          readiness
        };
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : 'LinkedIn profile capture failed.';
        throw new AppError(message, {
          code: 'BROWSER_SESSION_BOOTSTRAP_FAILED',
          status: 400,
          details: { accountId, mode: 'profile-capture' }
        });
      }
    }
  }

  if (!legacyConfig.linkedinUsername || !legacyConfig.linkedinPassword) {
    throw new AppError(
      `LinkedIn credential bootstrap is not configured for account ${accountId}. Set LINKEDIN_USERNAME and LINKEDIN_PASSWORD before starting browser bootstrap.`,
      {
        code: 'BROWSER_SESSION_BOOTSTRAP_NOT_CONFIGURED',
        status: 400,
        details: {
          accountId,
          hasLinkedinUsername: Boolean(legacyConfig.linkedinUsername),
          hasLinkedinPassword: Boolean(legacyConfig.linkedinPassword)
        }
      }
    );
  }

  let session;
  try {
    const loginAndSaveSession = await loadLoginAndSaveSession();
    session = await loginAndSaveSession(accountId, sessionStore, legacyConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LinkedIn login bootstrap failed.';
    throw new AppError(message, {
      code: 'BROWSER_SESSION_BOOTSTRAP_FAILED',
      status: 400,
      details: { accountId }
    });
  }

  if (!session) {
    throw new AppError(`LinkedIn login bootstrap failed for account ${accountId}.`, {
      code: 'BROWSER_SESSION_BOOTSTRAP_FAILED',
      status: 400,
      details: { accountId }
    });
  }

  const readiness = await getManualBrowserSyncReadiness(accountId);

  return {
    accountId: session.accountId,
    capturedAt: session.capturedAt,
    userAgent: session.userAgent,
    readiness
  };
}