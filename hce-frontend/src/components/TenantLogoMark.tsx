import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type TenantLogoMarkProps = {
  logoUrl?: string | null;
  clinicName?: string | null;
  size?: string;
  className?: string;
};

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function resolveTenantAssetUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/')) {
    return API_URL ? `${API_URL}${trimmed}` : trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocalHost && API_URL) {
      return `${API_URL}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return null;
  }

  return trimmed;
}

export function TenantLogoMark({ logoUrl, clinicName, size = '2.2rem', className }: TenantLogoMarkProps) {
  const resolvedLogoUrl = useMemo(() => resolveTenantAssetUrl(logoUrl), [logoUrl]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = (clinicName?.trim() || 'Denta Cloud').charAt(0).toUpperCase() || 'D';
  const showImage = Boolean(resolvedLogoUrl && failedUrl !== resolvedLogoUrl);
  const style = { '--tenant-logo-size': size } as CSSProperties;

  useEffect(() => {
    setFailedUrl(null);
  }, [resolvedLogoUrl]);

  return (
    <span className={`tenant-logo-mark${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      {showImage ? (
        <img
          src={resolvedLogoUrl!}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          onError={() => setFailedUrl(resolvedLogoUrl)}
        />
      ) : (
        <span className="tenant-logo-mark__fallback">{initial}</span>
      )}
    </span>
  );
}
