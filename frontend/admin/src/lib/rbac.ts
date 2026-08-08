/** Client-side admin RBAC helpers (roles + permissions from login /team/me). */

const ROLES_KEY = 'movr_admin_roles';
const PERMS_KEY = 'movr_admin_permissions';

export function getAdminRoles(): string[] {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function getAdminPermissions(): string[] {
  try {
    const raw = localStorage.getItem(PERMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function setAdminAccess(roles: string[], permissions?: string[]) {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles || []));
  if (permissions) {
    localStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
  }
}

export function clearAdminAccess() {
  localStorage.removeItem(ROLES_KEY);
  localStorage.removeItem(PERMS_KEY);
}

export function hasPermission(...perms: string[]): boolean {
  const roles = getAdminRoles();
  if (roles.includes('super_admin')) return true;
  const mine = getAdminPermissions();
  if (!perms.length) return true;
  return perms.some((p) => mine.includes(p));
}

export function hasRole(...roles: string[]): boolean {
  const mine = getAdminRoles();
  return roles.some((r) => mine.includes(r));
}
