import { createApiApp } from '../server/app';

// Singleton Express app untuk Vercel Serverless Function (/api/*)
const app = createApiApp();

export default function handler(req: any, res: any) {
  return app(req, res);
}
