import path from 'node:path';
import { pathToFileURL } from 'node:url';

type LoginAndSaveSession = typeof import('../../../../packages/automation/src/index')['loginAndSaveSession'];
type CaptureLinkedInSessionFromChromeProfile = typeof import('../../../../packages/automation/src/index')['captureLinkedInSessionFromChromeProfile'];
type CaptureLinkedInSessionFromDirectPersistentProfile = typeof import('../../../../packages/automation/src/index')['captureLinkedInSessionFromDirectPersistentProfile'];

function resolveWorkspaceRoot() {
  const cwd = process.cwd();
  if (path.basename(cwd) === 'web' && path.basename(path.dirname(cwd)) === 'apps') {
    return path.resolve(cwd, '..', '..');
  }

  return cwd;
}

export async function loadLoginAndSaveSession(): Promise<LoginAndSaveSession> {
  const modulePath = path.resolve(resolveWorkspaceRoot(), 'packages/automation/src/index.ts');
  const automationModule = await import(pathToFileURL(modulePath).href);
  return automationModule.loginAndSaveSession as LoginAndSaveSession;
}

export async function loadCaptureLinkedInSessionFromChromeProfile(): Promise<CaptureLinkedInSessionFromChromeProfile> {
  const automationModulePath = path.resolve(resolveWorkspaceRoot(), 'packages/automation/src/index.ts');
  const automationModuleUrl = pathToFileURL(automationModulePath).href;
  const automationModule = await import(automationModuleUrl);
  return automationModule.captureLinkedInSessionFromChromeProfile as CaptureLinkedInSessionFromChromeProfile;
}

export async function loadCaptureLinkedInSessionFromDirectPersistentProfile(): Promise<CaptureLinkedInSessionFromDirectPersistentProfile> {
  const automationModulePath = path.resolve(resolveWorkspaceRoot(), 'packages/automation/src/index.ts');
  const automationModuleUrl = pathToFileURL(automationModulePath).href;
  const automationModule = await import(automationModuleUrl);
  return automationModule.captureLinkedInSessionFromDirectPersistentProfile as CaptureLinkedInSessionFromDirectPersistentProfile;
}