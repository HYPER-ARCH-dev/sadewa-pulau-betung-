import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        role: 'super_admin' | 'admin_desa' | 'operator' | 'editor' | 'admin_posyandu';
        name: string;
        tokenVersion: number;
        exp: number;
      };
    }
  }
}
