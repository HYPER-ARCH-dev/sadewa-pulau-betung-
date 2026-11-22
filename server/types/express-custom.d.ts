import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        scope?: 'tenant' | 'platform';
        tenantId?: string | null;
        userId: string;
        username: string;
        role:
          | 'super_admin'
          | 'admin_desa'
          | 'operator'
          | 'editor'
          | 'admin_posyandu'
          | 'platform_super_admin'
          | 'platform_ops';
        name: string;
        tokenVersion: number;
        exp: number;
      };
    }
  }
}
