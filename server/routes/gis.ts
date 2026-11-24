import { Router, Request, Response as ExpressResponse } from 'express';
import {
  authenticateToken,
  AuthenticatedRequest,
  requireRolesOrPermission
} from '../auth';
import { getCurrentTenantContext, isMultiTenantRoutingEnabled } from '../db/tenantContext';
import { recordAuditLogDb } from '../db/prisma-helpers';
import { sanitizeDiagnosticMessage } from '../db/connection-diagnostic';
import {
  checkGisTablesReady,
  getPublicGisBootstrap,
  upsertTenantGisConfig,
  getVillageBoundaries,
  createVillageBoundary,
  updateVillageBoundary,
  verifyVillageBoundary,
  setActiveVillageBoundary,
  deleteVillageBoundary
} from '../services/gis/gisRepository';

export const publicGisRouter = Router();
export const adminGisRouter = Router();

// Publik: ambil bootstrap viewport, mode peta default, dan batas wilayah aktif (tanpa PII)
publicGisRouter.get('/bootstrap', async (_req: Request, res: ExpressResponse) => {
  try {
    const payload = await getPublicGisBootstrap();
    return res.json({
      success: true,
      data: payload
    });
  } catch (err: any) {
    console.warn('⚠️ [PUBLIC-GIS-BOOTSTRAP]:', sanitizeDiagnosticMessage(err?.message || String(err)));
    return res.status(500).json({
      success: false,
      error: 'Gagal memuat konfigurasi peta desa.'
    });
  }
});

// Middleware proteksi admin GIS + guard isolasi tenant
adminGisRouter.use(authenticateToken);
adminGisRouter.use((req: AuthenticatedRequest, res: ExpressResponse, next) => {
  const ctx = getCurrentTenantContext();
  if (isMultiTenantRoutingEnabled() && !ctx?.tenantId) {
    return res.status(403).json({
      success: false,
      error: 'Konteks portal desa aktif wajib teridentifikasi untuk mengelola konfigurasi GIS.'
    });
  }
  return next();
});

adminGisRouter.get(
  '/config',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories', 'facilities', 'profile']),
  async (_req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const [bootstrap, gisTablesReady] = await Promise.all([
        getPublicGisBootstrap(),
        checkGisTablesReady()
      ]);

      return res.json({
        success: true,
        data: {
          ...bootstrap,
          gisTablesReady
        }
      });
    } catch (err: any) {
      console.warn('⚠️ [ADMIN-GIS-GET-CONFIG]:', sanitizeDiagnosticMessage(err?.message || String(err)));
      return res.status(500).json({
        success: false,
        error: 'Gagal memuat konfigurasi GIS admin.'
      });
    }
  }
);

adminGisRouter.put(
  '/config',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories', 'facilities', 'profile']),
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const body = req.body || {};
      const updatedConfig = await upsertTenantGisConfig(
        {
          regionCode: body.regionCode,
          centerLat: body.centerLat,
          centerLng: body.centerLng,
          defaultZoom: body.defaultZoom,
          bbox: body.bbox,
          defaultMapMode: body.defaultMapMode,
          activeProviderId: body.activeProviderId,
          showVillageBoundary: body.showVillageBoundary,
          boundaryColor: body.boundaryColor,
          customSatelliteTileUrl: body.customSatelliteTileUrl
        },
        {
          userId: req.user?.userId || 'system',
          userName: req.user?.name || 'Administrator'
        }
      );

      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Perbarui Konfigurasi GIS Desa',
        'WebGIS Spasial',
        `Memperbarui konfigurasi peta tenant (mode=${updatedConfig.defaultMapMode}, zoom=${updatedConfig.defaultZoom})`,
        req.ip || '127.0.0.1'
      );

      return res.json({
        success: true,
        message: 'Konfigurasi GIS desa berhasil diperbarui.',
        data: updatedConfig
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 400;
      return res.status(status).json({
        success: false,
        error: err?.message || 'Gagal memperbarui konfigurasi GIS desa.'
      });
    }
  }
);

// ----------------------------------------------------------------------------
// ENDPOINTS MANAJEMEN BATAS WILAYAH DESA (TAHAP 2)
// ----------------------------------------------------------------------------

adminGisRouter.get(
  '/boundaries',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories']),
  async (_req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const boundaries = await getVillageBoundaries();
      return res.json({
        success: true,
        data: boundaries
      });
    } catch (err: any) {
      console.warn('⚠️ [ADMIN-GIS-GET-BOUNDARIES]:', sanitizeDiagnosticMessage(err?.message || String(err)));
      return res.status(500).json({
        success: false,
        error: 'Gagal mengambil daftar batas wilayah desa.'
      });
    }
  }
);

adminGisRouter.post(
  '/boundaries',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories']),
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const body = req.body || {};
      if (!body.geometryGeoJson) {
        return res.status(400).json({
          success: false,
          error: 'Geometri GeoJSON batas wilayah wajib disertakan.'
        });
      }

      const created = await createVillageBoundary(
        {
          regionCode: body.regionCode,
          status: body.status,
          sourceType: body.sourceType || 'ADMIN_DIGITIZED',
          sourceName: body.sourceName,
          sourceYear: body.sourceYear ? Number(body.sourceYear) : undefined,
          licenseNote: body.licenseNote,
          geometryGeoJson: body.geometryGeoJson,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
          verificationNotes: body.verificationNotes
        },
        {
          userId: req.user?.userId || 'system',
          userName: req.user?.name || 'Administrator'
        }
      );

      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Simpan Batas Wilayah Desa',
        'WebGIS Spasial',
        `Menyimpan poligon batas wilayah desa (${created.sourceType}, status=${created.status}, luas=${created.areaSqM} m²)`,
        req.ip || '127.0.0.1'
      );

      return res.status(201).json({
        success: true,
        message: 'Batas wilayah desa berhasil disimpan.',
        data: created
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 400;
      return res.status(status).json({
        success: false,
        error: err?.message || 'Gagal menyimpan batas wilayah desa.'
      });
    }
  }
);

adminGisRouter.put(
  '/boundaries/:id',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories']),
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const id = req.params.id;
      const body = req.body || {};

      const updated = await updateVillageBoundary(
        id,
        {
          regionCode: body.regionCode,
          sourceType: body.sourceType,
          sourceName: body.sourceName,
          sourceYear: body.sourceYear ? Number(body.sourceYear) : undefined,
          licenseNote: body.licenseNote,
          geometryGeoJson: body.geometryGeoJson,
          isActive: body.isActive,
          verificationNotes: body.verificationNotes
        },
        {
          userId: req.user?.userId || 'system',
          userName: req.user?.name || 'Administrator'
        }
      );

      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Perbarui Batas Wilayah Desa',
        'WebGIS Spasial',
        `Memperbarui poligon batas wilayah desa id=${id} (${updated.sourceType})`,
        req.ip || '127.0.0.1'
      );

      return res.json({
        success: true,
        message: 'Batas wilayah desa berhasil diperbarui.',
        data: updated
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 400;
      return res.status(status).json({
        success: false,
        error: err?.message || 'Gagal memperbarui batas wilayah desa.'
      });
    }
  }
);

adminGisRouter.put(
  '/boundaries/:id/verify',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories']),
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const id = req.params.id;
      const { status, notes } = req.body || {};

      if (!status || !['BELUM_TERVERIFIKASI', 'PERLU_VERIFIKASI', 'TERVERIFIKASI'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status verifikasi harus salah satu dari: BELUM_TERVERIFIKASI, PERLU_VERIFIKASI, TERVERIFIKASI.'
        });
      }

      const verified = await verifyVillageBoundary(
        id,
        status,
        notes || null,
        {
          userId: req.user?.userId || 'system',
          userName: req.user?.name || 'Administrator'
        }
      );

      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Verifikasi Batas Wilayah Desa',
        'WebGIS Spasial',
        `Mengubah status verifikasi batas wilayah id=${id} menjadi ${status}`,
        req.ip || '127.0.0.1'
      );

      return res.json({
        success: true,
        message: `Status verifikasi batas wilayah berhasil diubah menjadi ${status}.`,
        data: verified
      });
    } catch (err: any) {
      const httpStatus = typeof err?.statusCode === 'number' ? err.statusCode : 400;
      return res.status(httpStatus).json({
        success: false,
        error: err?.message || 'Gagal memperbarui status verifikasi batas wilayah.'
      });
    }
  }
);

adminGisRouter.put(
  '/boundaries/:id/set-active',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories']),
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const id = req.params.id;
      const active = await setActiveVillageBoundary(
        id,
        {
          userId: req.user?.userId || 'system',
          userName: req.user?.name || 'Administrator'
        }
      );

      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Aktifkan Batas Wilayah Peta',
        'WebGIS Spasial',
        `Menjadikan batas wilayah id=${id} sebagai batas aktif peta desa`,
        req.ip || '127.0.0.1'
      );

      return res.json({
        success: true,
        message: 'Batas wilayah aktif berhasil diperbarui.',
        data: active
      });
    } catch (err: any) {
      const httpStatus = typeof err?.statusCode === 'number' ? err.statusCode : 400;
      return res.status(httpStatus).json({
        success: false,
        error: err?.message || 'Gagal mengaktifkan batas wilayah.'
      });
    }
  }
);

adminGisRouter.delete(
  '/boundaries/:id',
  requireRolesOrPermission(['super_admin', 'admin_desa'], ['webgis', 'territories']),
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    try {
      const id = req.params.id;
      const deleted = await deleteVillageBoundary(
        id,
        {
          userId: req.user?.userId || 'system',
          userName: req.user?.name || 'Administrator'
        }
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Batas wilayah tidak ditemukan atau sudah dihapus.'
        });
      }

      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Hapus Batas Wilayah Desa',
        'WebGIS Spasial',
        `Menghapus data batas wilayah id=${id}`,
        req.ip || '127.0.0.1'
      );

      return res.json({
        success: true,
        message: 'Batas wilayah desa berhasil dihapus.'
      });
    } catch (err: any) {
      const httpStatus = typeof err?.statusCode === 'number' ? err.statusCode : 400;
      return res.status(httpStatus).json({
        success: false,
        error: err?.message || 'Gagal menghapus batas wilayah.'
      });
    }
  }
);

