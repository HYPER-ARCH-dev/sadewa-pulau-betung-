import { RoleType } from '../types';

/**
 * KONSTANTA HAK AKSES DAN ROLE (RBAC)
 * Keyword: AUTH, RBAC, ROLES
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin' as RoleType,
  ADMIN_DESA: 'admin_desa' as RoleType,
  OPERATOR: 'operator' as RoleType,
  EDITOR: 'editor' as RoleType,
  ADMIN_POSYANDU: 'admin_posyandu' as RoleType
} as const;

export const ROLE_LABELS: Record<RoleType, string> = {
  super_admin: 'Super Administrator',
  admin_desa: 'Sekretaris Desa (Admin)',
  operator: 'Operator Pelayanan & Kependudukan',
  editor: 'Editor Konten & Dokumentasi',
  admin_posyandu: 'Admin e-Posyandu & TPK'
};

export const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  super_admin: ['all'],
  admin_desa: ['services', 'complaints', 'news', 'announcements', 'agendas', 'gallery', 'development', 'transparency', 'potential', 'umkm', 'government', 'backups'],
  operator: ['services', 'complaints', 'news', 'announcements', 'umkm'],
  editor: ['news', 'announcements', 'agendas', 'gallery', 'potential', 'umkm'],
  admin_posyandu: ['posyandu']
};
