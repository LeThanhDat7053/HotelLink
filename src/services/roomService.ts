/**
 * Room Service - Quản lý phòng nghỉ
 * Endpoint: GET /api/v1/vr-hotel/rooms
 * 
 * Hỗ trợ:
 * - Lấy danh sách phòng
 * - Filter theo room_type và status
 * - Xử lý đa ngôn ngữ từ translations
 * - Convert media_id sang URL
 */

import api from '../api';
import { mediaService } from './mediaService';
import type {
  RoomResponse,
  GetRoomsParams,
  RoomUIData,
} from '../types/room';

export const roomService = {
  /**
   * Lấy danh sách phòng từ API
   * 
   * @param propertyId - ID của property
   * @param params - Query params (skip, limit, room_type, status)
   * @returns Promise<RoomResponse[]>
   * 
   * @example
   * const rooms = await roomService.getRooms(10, { limit: 50, status: 'available' });
   */
  async getRooms(
    propertyId: number,
    params?: GetRoomsParams
  ): Promise<RoomResponse[]> {
    const queryParams = {
      skip: params?.skip ?? 0,
      limit: params?.limit ?? 100,
      ...(params?.room_type && { room_type: params.room_type }),
      ...(params?.status && { status: params.status }),
    };

    const { data } = await api.get<RoomResponse[]>('/vr-hotel/rooms', {
      params: queryParams,
      headers: {
        'x-property-id': propertyId,
      },
    });

    return data;
  },

  /**
   * Transform RoomResponse sang RoomUIData cho UI
   * - Lấy translation theo locale
   * - Convert media_id sang URL
   * - Phân loại ảnh: primary vs gallery
   * 
   * @param room - Room data từ API
   * @param locale - Mã ngôn ngữ (vi, en, yue, etc.)
   * @returns RoomUIData
   */
  transformRoomForUI(room: RoomResponse, locale: string): RoomUIData {
    // Lấy translation theo locale, không fallback
    const translation = room.translations[locale];

    // Lấy ảnh đại diện (is_primary = true)
    const primaryMedia = room.media.find(m => m.is_primary && !m.is_vr360);
    const primaryImage = primaryMedia 
      ? mediaService.getMediaViewUrl(primaryMedia.media_id) 
      : null;

    // Lấy ảnh gallery (is_primary = false), sort theo sort_order
    const galleryMedia = room.media
      .filter(m => !m.is_primary && !m.is_vr360)
      .sort((a, b) => a.sort_order - b.sort_order);
    const galleryImages = galleryMedia.map(m => mediaService.getMediaViewUrl(m.media_id));

    const vrLink = room.vr_link || null;
    const targetId = room.target_id || null;
    const panoramaUrl = room.panorama_url || null;

    // Lấy amenities từ translation.amenities_text (ưu tiên) hoặc amenities_json (fallback)
    let amenities: string[] = [];
    if (translation?.amenities_text) {
      // Parse amenities_text thành array (format: "Item1, Item2, Item3")
      amenities = translation.amenities_text
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '');
    } else if (room.amenities_json && room.amenities_json.length > 0) {
      // Fallback về amenities_json nếu không có amenities_text
      amenities = room.amenities_json;
    }

    return {
      id: room.id,
      code: room.room_code,
      type: room.room_type,
      name: translation?.name || '',
      description: translation?.description || '',
      price: room.price_per_night,
      capacity: room.capacity,
      size: room.size_sqm,
      floor: room.floor,
      bedType: room.bed_type,
      status: room.status,
      amenities,
      vrLink,
      targetId,
      panoramaUrl,
      bookingUrl: room.booking_url,
      primaryImage,
      galleryImages,
      displayOrder: room.display_order,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  },

  /**
   * Lấy danh sách phòng và transform cho UI
   * Chỉ trả về rooms có translation cho locale hiện tại
   * 
   * @param propertyId - ID của property
   * @param locale - Mã ngôn ngữ
   * @param params - Query params
   * @returns Promise<RoomUIData[]>
   * 
   * @example
   * const rooms = await roomService.getRoomsForUI(10, 'vi', { limit: 20 });
   */
  async getRoomsForUI(
    propertyId: number,
    locale: string,
    params?: GetRoomsParams
  ): Promise<RoomUIData[]> {
    const rooms = await this.getRooms(propertyId, params);
    return rooms
      .map(room => this.transformRoomForUI(room, locale))
      .filter(room => room.name.trim() !== '') // Chỉ giữ rooms có translation
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },

  /**
   * Lấy chi tiết 1 phòng theo ID
   * 
   * @param propertyId - ID của property
   * @param roomId - ID của room
   * @param locale - Mã ngôn ngữ
   * @returns Promise<RoomUIData | null>
   */
  async getRoomById(
    propertyId: number,
    roomId: number,
    locale: string
  ): Promise<RoomUIData | null> {
    const rooms = await this.getRooms(propertyId);
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) return null;
    
    return this.transformRoomForUI(room, locale);
  },

  /**
   * Lấy chi tiết 1 phòng theo room_code
   * 
   * @param propertyId - ID của property
   * @param roomCode - Mã phòng (room_code)
   * @param locale - Mã ngôn ngữ
   * @returns Promise<RoomUIData | null>
   */
  async getRoomByCode(
    propertyId: number,
    roomCode: string,
    locale: string
  ): Promise<RoomUIData | null> {
    const rooms = await this.getRooms(propertyId);
    const room = rooms.find(r => r.room_code?.toLowerCase() === roomCode.toLowerCase());
    
    if (!room) return null;
    
    return this.transformRoomForUI(room, locale);
  },
};
