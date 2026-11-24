export const settingsTabIds = [
  'global', 'config', 'roles', 'userRoles', 'globalPrompts',
  'voice', 'data', 'knowledge', 'search', 'skills',
] as const;
export type TabType = typeof settingsTabIds[number];

export function parseSettingsHash(hash: string): { isOpen: boolean; tab?: TabType } {
  const match = /^#setting(?:\/([^/]+))?$/.exec(hash);
  if (!match) return { isOpen: false };
  const tab = settingsTabIds.find(id => id === match[1]);
  return { isOpen: true, tab };
}
