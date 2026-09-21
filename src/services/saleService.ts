import api from '../api';
import { appConfig } from '../config';
import type { SaleContact } from '../types/sale';

export const saleService = {
  /**
   * Lấy thông tin contact public của sale theo slug.
   * Endpoint public: GET /sale/public/{slug}?tenant_code=<tenant>
   * (tenant_code là query param bắt buộc)
   */
  async getPublicContact(slug: string): Promise<SaleContact> {
    const tenantCode = appConfig.TENANT_CODE || appConfig.TENANT_ID;
    const propertyId = Number(appConfig.PROPERTY_ID) || undefined;
    const { data } = await api.get<SaleContact>(`/sale/public/${encodeURIComponent(slug)}`, {
      params: {
        tenant_code: tenantCode,
        // Truyền property_id để BE lọc khi hỗ trợ (1 tenant có thể nhiều property)
        ...(propertyId ? { property_id: propertyId } : {}),
      },
    });
    return data;
  },
};
