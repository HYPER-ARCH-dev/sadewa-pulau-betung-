import React, { useEffect, useState } from 'react';
import { getTenantAuthToken } from '../../utils/tenantStorage';

function needsAuthHeader(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith('/api/upload/private/') || url.startsWith('/api/admin/');
}

function getAuthToken(): string | null {
  return getTenantAuthToken();
}

export interface AuthorizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
}

/**
 * Menampilkan gambar publik secara langsung, dan otomatis menyertakan header
 * Authorization Bearer untuk aset di zona privat (/api/upload/private/*).
 */
export const AuthorizedImage: React.FC<AuthorizedImageProps> = ({ src, alt = '', ...rest }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => (needsAuthHeader(src) ? '' : src || ''));

  useEffect(() => {
    if (!src) {
      setResolvedSrc('');
      return;
    }

    if (!needsAuthHeader(src)) {
      setResolvedSrc(src);
      return;
    }

    let isCancelled = false;
    let objectUrl: string | null = null;
    const token = getAuthToken();

    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (isCancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        if (!isCancelled) setResolvedSrc('');
      });

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!resolvedSrc) {
    return null;
  }

  return <img src={resolvedSrc} alt={alt} {...rest} />;
};

/**
 * Mengunduh atau membuka dokumen dari jalur privat / admin menggunakan Bearer token.
 */
export async function downloadAuthorizedFile(url: string, fallbackFileName?: string): Promise<boolean> {
  if (!url) return false;

  if (!needsAuthHeader(url)) {
    const a = document.createElement('a');
    a.href = url;
    if (fallbackFileName) a.download = fallbackFileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  const token = getAuthToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) return false;

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fallbackFileName || url.split('/').pop()?.split('?')[0] || 'dokumen-sadewa';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  return true;
}
