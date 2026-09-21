import type { SaleContact } from '../types/sale';

export interface ResolvedContact {
  /** URL Messenger (chỉ có ở contact hotel; sale không có messenger) */
  messengerUrl: string | null;
  /** Zalo: sale.zalo_url khi có sale, ngược lại phone_number của hotel */
  zaloPhone: string | null;
  /** Số điện thoại gọi trực tiếp (chỉ có khi referral qua sale) */
  phoneUrl: string | null;
  /** Booking URL */
  bookingUrl: string | null;
  /** true nếu đang dùng contact của sale (có ?ref=) */
  isSale: boolean;
}

interface HotelContactInput {
  messengerUrl?: string | null;
  zaloPhone?: string | null;
  bookingUrl?: string | null;
}

/**
 * Gộp contact: nếu có sale (referral) thì ưu tiên dùng contact của sale
 * (zalo_url, phone_url, booking_url). Ngược lại dùng contact mặc định của hotel.
 *
 * Khi có sale: hiển thị Zalo + Gọi điện + Booking (bỏ Messenger vì sale không có).
 */
export const resolveContact = (
  sale: SaleContact | null,
  hotel: HotelContactInput,
): ResolvedContact => {
  if (sale) {
    return {
      messengerUrl: null,
      zaloPhone: sale.zalo_url ?? null,
      phoneUrl: sale.phone_url ?? null,
      bookingUrl: sale.booking_url ?? null,
      isSale: true,
    };
  }

  return {
    messengerUrl: hotel.messengerUrl ?? null,
    zaloPhone: hotel.zaloPhone ?? null,
    phoneUrl: null,
    bookingUrl: hotel.bookingUrl ?? null,
    isSale: false,
  };
};
