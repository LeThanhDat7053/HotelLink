import api from '../api';
import { appConfig } from '../config';
import type { PropertyResponse } from '../types/api';

const getRuntimeRequestHeaders = (propertyId?: number | string | null) => {
  const resolvedPropertyId = propertyId ?? appConfig.PROPERTY_ID;
  const resolvedTenantCode = appConfig.TENANT_CODE || appConfig.TENANT_ID;

  return {
    ...(resolvedTenantCode ? { 'x-tenant-code': String(resolvedTenantCode) } : {}),
    ...(resolvedPropertyId ? { 'x-property-id': String(resolvedPropertyId) } : {}),
  };
};

/**
 * Property Service - Quản lý properties (khách sạn)
 * Backend: GET /api/v1/properties/
 */

export const propertyService = {
  /**
   * Lấy danh sách properties
   */
  async getProperties(params?: { skip?: number; limit?: number }): Promise<PropertyResponse[]> {
    const { data } = await api.get('/properties/', {
      params,
      headers: getRuntimeRequestHeaders(),
    });
    return data;
  },

  /**
   * Lấy property theo ID
   */
  async getPropertyById(propertyId: number): Promise<PropertyResponse> {
    const { data } = await api.get(`/properties/${propertyId}`, {
      headers: getRuntimeRequestHeaders(propertyId),
    });
    return data;
  },

  /**
   * Lấy property theo code
   */
  async getPropertyByCode(propertyCode: string): Promise<PropertyResponse> {
    const { data } = await api.get(`/properties/by-code/${propertyCode}`, {
      headers: getRuntimeRequestHeaders(),
    });
    return data;
  },

  /**
   * Update property
   */
  async updateProperty(
    propertyId: number,
    updates: Partial<PropertyResponse>
  ): Promise<PropertyResponse> {
    const { data } = await api.put(`/properties/${propertyId}`, updates, {
      headers: getRuntimeRequestHeaders(propertyId),
    });
    return data;
  },
};
