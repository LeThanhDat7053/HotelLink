import type { FC, ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { saleService } from '../services/saleService';
import { getSaleSlugFromUrl } from '../utils/saleSlug';
import { appConfig } from '../config';
import type { SaleContact } from '../types/sale';

interface SaleContextValue {
  /** Slug đọc từ segment path đầu (vd /coraltest/...), null nếu không có */
  slug: string | null;
  /** Contact của sale (null khi không có slug hoặc fetch lỗi) */
  saleContact: SaleContact | null;
  /** true khi URL có prefix sale (đang ở luồng referral) */
  hasSale: boolean;
  loading: boolean;
}

const SaleContext = createContext<SaleContextValue>({
  slug: null,
  saleContact: null,
  hasSale: false,
  loading: false,
});

export const SaleProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const slug = useMemo(() => getSaleSlugFromUrl(), []);
  const [saleContact, setSaleContact] = useState<SaleContact | null>(null);
  const [loading, setLoading] = useState<boolean>(!!slug);

  useEffect(() => {
    if (!slug) {
      return;
    }

    let isMounted = true;
    setLoading(true);

    saleService
      .getPublicContact(slug)
      .then((data) => {
        if (!isMounted) {
          return;
        }
        // Chỉ chấp nhận sale khi property_id khớp đúng với property hiện tại.
        // null = chưa gán property → fallback về hotel.
        const currentPropertyId = Number(appConfig.PROPERTY_ID);
        if (currentPropertyId > 0 && data.property_id !== currentPropertyId) {
          console.warn(
            `[sale] property_id mismatch (sale=${data.property_id ?? 'null'}, current=${currentPropertyId}) → fallback to hotel`,
          );
          setSaleContact(null);
          return;
        }
        setSaleContact(data);
      })
      .catch((err) => {
        // Fetch lỗi (slug không tồn tại,...) → fallback contact hotel
        console.warn('[sale] Could not fetch sale contact, fallback to hotel:', err);
        if (isMounted) {
          setSaleContact(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const value = useMemo<SaleContextValue>(
    () => ({ slug, saleContact, hasSale: !!slug, loading }),
    [slug, saleContact, loading],
  );

  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
};

export const useSale = (): SaleContextValue => useContext(SaleContext);
