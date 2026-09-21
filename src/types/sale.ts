/**
 * Sale contact types
 * Dữ liệu liên hệ của nhân viên sale (referral theo slug ?ref=)
 */

export interface SaleContact {
  subdomain: string;
  full_name: string;
  property_id?: number;
  zalo_url: string | null;
  phone_url: string | null;
  booking_url: string | null;
}
