import type { FC } from 'react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { Grid, Layout, Skeleton } from 'antd';
import {
  AboutContent,
  BottomBar,
  ContactContent,
  DiningView,
  FacilityView,
  GalleryContent,
  Header,
  InfoBox,
  LoadingScreen,
  PolicyContent,
  PropertyPostsContent,
  RegulationContent,
  RoomsView,
  SEOMeta,
  ServiceView,
  ThreeDVistaBackground,
} from './components/common';
import { OfferView } from './components/common/OfferView';
import { ThemeInjector } from './components/ThemeInjector';
import { ROUTES, extractCleanPath } from './constants/routes';
import {
  LanguageProvider,
  PropertyProvider,
  SaleProvider,
  ThemeProvider,
  useSale,
  usePropertyContext,
  usePropertyData,
} from './context';
import { useTheme } from './context/ThemeContext';
import {
  useContact,
  useIntroductionContent,
  useLogo,
  usePolicy,
  usePropertyPosts,
  useRegulation,
  useRouteLoading,
  useSettings,
} from './hooks';
import { useLocale } from './context/LanguageContext';
import { useVrHotelSettings } from './hooks/useVR360';
import { getMenuTranslations } from './constants/translations';
import { getMediaType, getYouTubeEmbedUrl } from './utils/mediaHelper';
import { resolvePanoramaNameFromPageSettings } from './utils/vr360SceneResolver';
import { loadVr360Scenes } from './utils/vr360SceneParser';
import { getSaleSlugFromUrl } from './utils/saleSlug';
import VR360SceneSyncPage from './pages/VR360SceneSyncPage';
import type { Vr360SceneItem } from './types/settings';

const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const RoomsPage = lazy(() => import('./pages/RoomsPage'));

const { Content } = Layout;
const { useBreakpoint } = Grid;

const AppLayout: FC = () => {
  const location = useLocation();
  const screens = useBreakpoint();
  const locale = useLocale();
  const { primaryColor } = useTheme();
  const { vr360Url: defaultVr360Url, propertyName, loading, propertyId } = usePropertyData();
  const { logoUrl } = useLogo();
  const { settings } = useSettings();
  const { settings: vrHotelSettings } = useVrHotelSettings(propertyId);
  const { saleContact } = useSale();
  const { isLoading: isRouteLoading, forceComplete } = useRouteLoading({ minLoadingTime: 200 });
  const backgroundColor = settings?.background_color || 'rgb(31, 41, 55)';
  const t = getMenuTranslations(locale);

  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [isInfoBoxVisible, setIsInfoBoxVisible] = useState(true);
  const [userClosedInfoBox, setUserClosedInfoBox] = useState(false);
  const hasInitialized = useRef(false);

  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [diningTitle, setDiningTitle] = useState<string | null>(null);
  const [facilityTitle, setFacilityTitle] = useState<string | null>(null);
  const [serviceTitle, setServiceTitle] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState<string | null>(null);

  const [roomDetailVrLink, setRoomDetailVrLink] = useState<string | null>(null);
  const [roomDetailTargetId, setRoomDetailTargetId] = useState<string | null>(null);
  const [roomDetailPanoramaUrl, setRoomDetailPanoramaUrl] = useState<string | null>(null);
  const [isViewingRoomDetail, setIsViewingRoomDetail] = useState<boolean>(false);
  const roomVrClearTimerRef = useRef<number | null>(null);

  const handleRoomVrChange = useCallback((targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => {
    if (targetId === null && panoramaUrl === null && vrLink === null) {
      // Debounce the clear — if new room data arrives within 100ms, cancel it.
      // This prevents the cleanup of the old RoomDetail from overwriting data
      // set by handleRoomClick when switching between rooms.
      roomVrClearTimerRef.current = window.setTimeout(() => {
        setRoomDetailTargetId(null);
        setRoomDetailPanoramaUrl(null);
        setRoomDetailVrLink(null);
      }, 100);
    } else {
      if (roomVrClearTimerRef.current !== null) {
        clearTimeout(roomVrClearTimerRef.current);
        roomVrClearTimerRef.current = null;
      }
      setRoomDetailTargetId(targetId);
      setRoomDetailPanoramaUrl(panoramaUrl);
      setRoomDetailVrLink(vrLink);
    }
  }, []);

  const [diningDetailVrLink, setDiningDetailVrLink] = useState<string | null>(null);
  const [diningDetailTargetId, setDiningDetailTargetId] = useState<string | null>(null);
  const [diningDetailPanoramaUrl, setDiningDetailPanoramaUrl] = useState<string | null>(null);
  const [isViewingDiningDetail, setIsViewingDiningDetail] = useState<boolean>(false);
  const diningVrClearTimerRef = useRef<number | null>(null);

  const handleDiningVrChange = useCallback((targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => {
    if (targetId === null && panoramaUrl === null && vrLink === null) {
      diningVrClearTimerRef.current = window.setTimeout(() => {
        setDiningDetailTargetId(null);
        setDiningDetailPanoramaUrl(null);
        setDiningDetailVrLink(null);
      }, 100);
    } else {
      if (diningVrClearTimerRef.current !== null) {
        clearTimeout(diningVrClearTimerRef.current);
        diningVrClearTimerRef.current = null;
      }
      setDiningDetailTargetId(targetId);
      setDiningDetailPanoramaUrl(panoramaUrl);
      setDiningDetailVrLink(vrLink);
    }
  }, []);

  const [facilityDetailVrLink, setFacilityDetailVrLink] = useState<string | null>(null);
  const [facilityDetailTargetId, setFacilityDetailTargetId] = useState<string | null>(null);
  const [facilityDetailPanoramaUrl, setFacilityDetailPanoramaUrl] = useState<string | null>(null);
  const [isViewingFacilityDetail, setIsViewingFacilityDetail] = useState<boolean>(false);
  const facilityVrClearTimerRef = useRef<number | null>(null);

  const handleFacilityVrChange = useCallback((targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => {
    if (targetId === null && panoramaUrl === null && vrLink === null) {
      facilityVrClearTimerRef.current = window.setTimeout(() => {
        setFacilityDetailTargetId(null);
        setFacilityDetailPanoramaUrl(null);
        setFacilityDetailVrLink(null);
      }, 100);
    } else {
      if (facilityVrClearTimerRef.current !== null) {
        clearTimeout(facilityVrClearTimerRef.current);
        facilityVrClearTimerRef.current = null;
      }
      setFacilityDetailTargetId(targetId);
      setFacilityDetailPanoramaUrl(panoramaUrl);
      setFacilityDetailVrLink(vrLink);
    }
  }, []);

  const [serviceDetailVrLink, setServiceDetailVrLink] = useState<string | null>(null);
  const [serviceDetailTargetId, setServiceDetailTargetId] = useState<string | null>(null);
  const [serviceDetailPanoramaUrl, setServiceDetailPanoramaUrl] = useState<string | null>(null);
  const [isViewingServiceDetail, setIsViewingServiceDetail] = useState<boolean>(false);
  const serviceVrClearTimerRef = useRef<number | null>(null);

  const handleServiceVrChange = useCallback((targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => {
    if (targetId === null && panoramaUrl === null && vrLink === null) {
      serviceVrClearTimerRef.current = window.setTimeout(() => {
        setServiceDetailTargetId(null);
        setServiceDetailPanoramaUrl(null);
        setServiceDetailVrLink(null);
      }, 100);
    } else {
      if (serviceVrClearTimerRef.current !== null) {
        clearTimeout(serviceVrClearTimerRef.current);
        serviceVrClearTimerRef.current = null;
      }
      setServiceDetailTargetId(targetId);
      setServiceDetailPanoramaUrl(panoramaUrl);
      setServiceDetailVrLink(vrLink);
    }
  }, []);

  const [offerDetailVrLink, setOfferDetailVrLink] = useState<string | null>(null);
  const [offerDetailTargetId, setOfferDetailTargetId] = useState<string | null>(null);
  const [offerDetailPanoramaUrl, setOfferDetailPanoramaUrl] = useState<string | null>(null);
  const [isViewingOfferDetail, setIsViewingOfferDetail] = useState<boolean>(false);
  const offerVrClearTimerRef = useRef<number | null>(null);

  const handleOfferVrChange = useCallback((targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => {
    if (targetId === null && panoramaUrl === null && vrLink === null) {
      offerVrClearTimerRef.current = window.setTimeout(() => {
        setOfferDetailTargetId(null);
        setOfferDetailPanoramaUrl(null);
        setOfferDetailVrLink(null);
      }, 100);
    } else {
      if (offerVrClearTimerRef.current !== null) {
        clearTimeout(offerVrClearTimerRef.current);
        offerVrClearTimerRef.current = null;
      }
      setOfferDetailTargetId(targetId);
      setOfferDetailPanoramaUrl(panoramaUrl);
      setOfferDetailVrLink(vrLink);
    }
  }, []);

  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [localVrReady, setLocalVrReady] = useState(false);
  const localVrReadyRef = useRef(false);
  const [isTransitioningToLocalVr, setIsTransitioningToLocalVr] = useState(false);
  // Keeps the 3DVista iframe visible during brief gaps between local scenes (e.g.
  // room1 → list → room2). Hiding the iframe (display:none) pauses 3DVista rendering
  // and breaks its native crossfade, making the old scene linger ~1s. We only hide
  // it once we've definitively settled on an external VR for longer than the grace.
  const [keepLocalVrVisible, setKeepLocalVrVisible] = useState(false);
  const prevShouldUseLocalVrRef = useRef(false);
  const prevActivePanoramaNameRef = useRef<string | null>(null);
  const [hasVisualBootstrapped, setHasVisualBootstrapped] = useState(false);
  const [parsedVrScenes, setParsedVrScenes] = useState<Vr360SceneItem[]>([]);
  const prevVisualUrlRef = useRef<string | null>(null);
  const iframeTimeoutRef = useRef<number | null>(null);
  const prevRoomPanoramaRef = useRef<string | null>(null);
  const prevDiningPanoramaRef = useRef<string | null>(null);
  const prevFacilityPanoramaRef = useRef<string | null>(null);
  const prevServicePanoramaRef = useRef<string | null>(null);
  const prevOfferPanoramaRef = useRef<string | null>(null);
  const prevSectionPanoramaRef = useRef<string | null>(null);

  const { getFirstPostTitle } = usePropertyPosts(propertyId);
  const { content: introContent, vr360Link: introVr360Link } = useIntroductionContent(propertyId, locale);
  const { vr360Link: policyVr360Link } = usePolicy(propertyId || 0, locale);
  const {
    content: regulationContent,
    vr360Link: regulationVr360Link,
    loading: regulationLoading,
    error: regulationError,
  } = useRegulation(propertyId || 0, locale);
  const {
    content: contactContent,
    vr360Link: contactVr360Link,
    loading: contactLoading,
    error: contactError,
  } = useContact(propertyId || 0, locale);

  const cleanPath = useMemo(() => extractCleanPath(location.pathname), [location.pathname]);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedSceneFromUrl =
    searchParams.get('viewer') === 'vr360' ? searchParams.get('scene') : null;
  const isStandaloneVrScene = Boolean(requestedSceneFromUrl);
  const isSceneSyncRoute = cleanPath === ROUTES.VR360_SCENE_SYNC;

  const isHomePage = cleanPath === '/';
  const isAboutPage = cleanPath === '/gioi-thieu';
  const isRoomsPage = cleanPath === '/phong-nghi' || cleanPath.startsWith('/phong-nghi/');
  const isDiningPage = cleanPath === '/am-thuc' || cleanPath.startsWith('/am-thuc/');
  const isFacilityPage = cleanPath === '/tien-ich' || cleanPath.startsWith('/tien-ich/');
  const isServicePage = cleanPath === '/dich-vu' || cleanPath.startsWith('/dich-vu/');
  const isPolicyPage = cleanPath === '/chinh-sach';
  const isContactPage = cleanPath === '/lien-he';
  const isBookingPage = cleanPath === '/dat-phong';
  const isGalleryPage = cleanPath === '/thu-vien-anh';
  const isRegulationPage = cleanPath === '/noi-quy-khach-san';
  const isOffersPage = cleanPath === '/uu-dai' || cleanPath.startsWith('/uu-dai/');

  const roomCodeFromUrl = isRoomsPage && cleanPath.startsWith('/phong-nghi/')
    ? cleanPath.replace('/phong-nghi/', '')
    : undefined;
  const diningCodeFromUrl = isDiningPage && cleanPath.startsWith('/am-thuc/')
    ? cleanPath.replace('/am-thuc/', '')
    : undefined;
  const facilityCodeFromUrl = isFacilityPage && cleanPath.startsWith('/tien-ich/')
    ? cleanPath.replace('/tien-ich/', '')
    : undefined;
  const serviceCodeFromUrl = isServicePage && cleanPath.startsWith('/dich-vu/')
    ? cleanPath.replace('/dich-vu/', '')
    : undefined;
  const offerCodeFromUrl = isOffersPage && cleanPath.startsWith('/uu-dai/')
    ? cleanPath.replace('/uu-dai/', '')
    : undefined;

  useEffect(() => {
    prevSectionPanoramaRef.current = null;
  }, [cleanPath]);

  useEffect(() => {
    // Có sale (prefix path /coraltest) thì ưu tiên booking_url của sale, ngược lại của hotel
    const effectiveBookingUrl = saleContact?.booking_url || vrHotelSettings?.booking_url;
    if (isBookingPage && effectiveBookingUrl) {
      window.open(effectiveBookingUrl, '_blank', 'noopener,noreferrer');
      window.history.back();
    }
  }, [isBookingPage, saleContact?.booking_url, vrHotelSettings?.booking_url]);

  useEffect(() => {
    let active = true;

    const hydrateParsedScenes = async () => {
      try {
        const scenes = await loadVr360Scenes();
        if (active) {
          setParsedVrScenes(scenes);
        }
      } catch {
        if (active) {
          setParsedVrScenes([]);
        }
      }
    };

    hydrateParsedScenes();

    return () => {
      active = false;
    };
  }, []);

  const effectiveVrScenes = useMemo(
    () => (vrHotelSettings?.scenes && vrHotelSettings.scenes.length > 0 ? vrHotelSettings.scenes : parsedVrScenes),
    [parsedVrScenes, vrHotelSettings?.scenes],
  );

  const currentSectionSettings = useMemo(() => {
    if (isHomePage || isGalleryPage) return vrHotelSettings?.vr360_settings?.sections?.home ?? null;
    if (isAboutPage) return vrHotelSettings?.vr360_settings?.sections?.introduction ?? null;
    if (isPolicyPage) return vrHotelSettings?.vr360_settings?.sections?.policies ?? null;
    if (isRegulationPage) return vrHotelSettings?.vr360_settings?.sections?.rules ?? null;
    if (isContactPage) return vrHotelSettings?.vr360_settings?.sections?.contact ?? null;
    if (isRoomsPage) return vrHotelSettings?.pages?.rooms ?? null;
    if (isDiningPage) return vrHotelSettings?.pages?.dining ?? null;
    if (isFacilityPage) return vrHotelSettings?.pages?.facilities ?? null;
    if (isServicePage) return vrHotelSettings?.pages?.services ?? null;
    if (isOffersPage) return vrHotelSettings?.pages?.offers ?? null;
    return null;
  }, [
    isAboutPage,
    isContactPage,
    isDiningPage,
    isFacilityPage,
    isGalleryPage,
    isHomePage,
    isOffersPage,
    isPolicyPage,
    isRegulationPage,
    isRoomsPage,
    isServicePage,
    vrHotelSettings?.pages,
    vrHotelSettings?.vr360_settings?.sections,
  ]);

  const fallbackPageTitle = useMemo(() => {
    if (isHomePage) return getFirstPostTitle(locale) || '';
    if (isAboutPage) return introContent?.title || t.about;
    if (isPolicyPage) return t.policy;
    if (isRegulationPage) return t.regulation;
    if (isRoomsPage && roomTitle) return roomTitle;
    if (isDiningPage && diningTitle) return diningTitle;
    if (isFacilityPage && facilityTitle) return facilityTitle;
    if (isServicePage && serviceTitle) return serviceTitle;
    if (isOffersPage && offerTitle) return offerTitle;
    if (isRoomsPage) return t.rooms;
    if (isDiningPage) return t.dining;
    if (isFacilityPage) return t.facilities;
    if (isServicePage) return t.services;
    if (isContactPage) return t.contact;
    if (isBookingPage) return t.booking;
    if (isGalleryPage) return t.gallery;
    if (isOffersPage) return t.offers;
    return '';
  }, [
    diningTitle,
    facilityTitle,
    getFirstPostTitle,
    introContent?.title,
    isAboutPage,
    isBookingPage,
    isContactPage,
    isDiningPage,
    isFacilityPage,
    isGalleryPage,
    isHomePage,
    isOffersPage,
    isPolicyPage,
    isRegulationPage,
    isRoomsPage,
    isServicePage,
    locale,
    offerTitle,
    roomTitle,
    serviceTitle,
    t.about,
    t.booking,
    t.contact,
    t.dining,
    t.facilities,
    t.gallery,
    t.offers,
    t.policy,
    t.regulation,
    t.rooms,
    t.services,
  ]);

  const pageTitle =
    currentSectionSettings?.title_translations?.[locale] ||
    currentSectionSettings?.vr_title ||
    fallbackPageTitle;

  const pageExternalVrUrl = useMemo(() => {
    if (isHomePage || isGalleryPage) return currentSectionSettings?.vr360_link || defaultVr360Url;
    if (isAboutPage) return currentSectionSettings?.vr360_link || introVr360Link || defaultVr360Url;
    if (isPolicyPage) return currentSectionSettings?.vr360_link || policyVr360Link || defaultVr360Url;
    if (isRegulationPage) return currentSectionSettings?.vr360_link || regulationVr360Link || defaultVr360Url;
    if (isContactPage) return currentSectionSettings?.vr360_link || contactVr360Link || defaultVr360Url;
    if (isRoomsPage) return roomDetailVrLink || vrHotelSettings?.pages?.rooms?.vr360_link || defaultVr360Url;
    if (isDiningPage) return diningDetailVrLink || vrHotelSettings?.pages?.dining?.vr360_link || defaultVr360Url;
    if (isServicePage) return serviceDetailVrLink || vrHotelSettings?.pages?.services?.vr360_link || defaultVr360Url;
    if (isFacilityPage) return facilityDetailVrLink || vrHotelSettings?.pages?.facilities?.vr360_link || defaultVr360Url;
    if (isOffersPage) return offerDetailVrLink || vrHotelSettings?.pages?.offers?.vr360_link || defaultVr360Url;
    return defaultVr360Url;
  }, [
    contactVr360Link,
    currentSectionSettings?.vr360_link,
    defaultVr360Url,
    diningDetailVrLink,
    facilityDetailVrLink,
    introVr360Link,
    isAboutPage,
    isContactPage,
    isDiningPage,
    isFacilityPage,
    isGalleryPage,
    isHomePage,
    isOffersPage,
    isPolicyPage,
    isRegulationPage,
    isRoomsPage,
    isServicePage,
    offerDetailVrLink,
    policyVr360Link,
    regulationVr360Link,
    roomDetailVrLink,
    serviceDetailVrLink,
    vrHotelSettings?.pages?.dining?.vr360_link,
    vrHotelSettings?.pages?.facilities?.vr360_link,
    vrHotelSettings?.pages?.offers?.vr360_link,
    vrHotelSettings?.pages?.rooms?.vr360_link,
    vrHotelSettings?.pages?.services?.vr360_link,
  ]);

  const activePanoramaName = useMemo(() => {
    if (requestedSceneFromUrl) {
      return requestedSceneFromUrl;
    }

    // Đang xem chi tiết phòng cụ thể — xử lý giống hệt PageSettings của các menu
    if (isRoomsPage && isViewingRoomDetail) {
      const resolved = resolvePanoramaNameFromPageSettings(
        { target_id: roomDetailTargetId, panorama_url: roomDetailPanoramaUrl },
        effectiveVrScenes,
      );
      // Room data chưa về khi cả 3 đều null (cleanup đã clear, fetch chưa xong)
      // → giữ panorama cũ để tránh loading screen flash trong khoảng chờ
      const roomDataArrived = roomDetailTargetId !== null || roomDetailPanoramaUrl !== null || roomDetailVrLink !== null;
      if (!roomDataArrived) {
        return prevRoomPanoramaRef.current;
      }
      prevRoomPanoramaRef.current = resolved;
      return resolved;
    }

    // Ra khỏi chi tiết phòng → reset ref
    prevRoomPanoramaRef.current = null;

    if (isDiningPage && isViewingDiningDetail) {
      const resolved = resolvePanoramaNameFromPageSettings(
        { target_id: diningDetailTargetId, panorama_url: diningDetailPanoramaUrl },
        effectiveVrScenes,
      );
      const diningDataArrived = diningDetailTargetId !== null || diningDetailPanoramaUrl !== null || diningDetailVrLink !== null;
      if (!diningDataArrived) {
        return prevDiningPanoramaRef.current;
      }
      prevDiningPanoramaRef.current = resolved;
      return resolved;
    }
    prevDiningPanoramaRef.current = null;

    if (isFacilityPage && isViewingFacilityDetail) {
      const resolved = resolvePanoramaNameFromPageSettings(
        { target_id: facilityDetailTargetId, panorama_url: facilityDetailPanoramaUrl },
        effectiveVrScenes,
      );
      const facilityDataArrived = facilityDetailTargetId !== null || facilityDetailPanoramaUrl !== null || facilityDetailVrLink !== null;
      if (!facilityDataArrived) {
        return prevFacilityPanoramaRef.current;
      }
      prevFacilityPanoramaRef.current = resolved;
      return resolved;
    }
    prevFacilityPanoramaRef.current = null;

    if (isServicePage && isViewingServiceDetail) {
      const resolved = resolvePanoramaNameFromPageSettings(
        { target_id: serviceDetailTargetId, panorama_url: serviceDetailPanoramaUrl },
        effectiveVrScenes,
      );
      const serviceDataArrived = serviceDetailTargetId !== null || serviceDetailPanoramaUrl !== null || serviceDetailVrLink !== null;
      if (!serviceDataArrived) {
        return prevServicePanoramaRef.current;
      }
      prevServicePanoramaRef.current = resolved;
      return resolved;
    }
    prevServicePanoramaRef.current = null;

    if (isOffersPage && isViewingOfferDetail) {
      const resolved = resolvePanoramaNameFromPageSettings(
        { target_id: offerDetailTargetId, panorama_url: offerDetailPanoramaUrl },
        effectiveVrScenes,
      );
      const offerDataArrived = offerDetailTargetId !== null || offerDetailPanoramaUrl !== null || offerDetailVrLink !== null;
      if (!offerDataArrived) {
        return prevOfferPanoramaRef.current;
      }
      prevOfferPanoramaRef.current = resolved;
      return resolved;
    }
    prevOfferPanoramaRef.current = null;

    const resolved = resolvePanoramaNameFromPageSettings(currentSectionSettings, effectiveVrScenes);
    // vrHotelSettings loads async — while it's null, currentSectionSettings is null too,
    // causing a brief fallback to the homepage VR. Hold the last known resolved name
    // until settings arrive so the viewer doesn't flash the wrong scene.
    if (resolved !== null) {
      prevSectionPanoramaRef.current = resolved;
      return resolved;
    }
    return prevSectionPanoramaRef.current;
  }, [
    currentSectionSettings,
    diningDetailPanoramaUrl,
    diningDetailTargetId,
    diningDetailVrLink,
    effectiveVrScenes,
    facilityDetailPanoramaUrl,
    facilityDetailTargetId,
    facilityDetailVrLink,
    isDiningPage,
    isFacilityPage,
    isOffersPage,
    isRoomsPage,
    isServicePage,
    isViewingDiningDetail,
    isViewingFacilityDetail,
    isViewingOfferDetail,
    isViewingRoomDetail,
    isViewingServiceDetail,
    offerDetailPanoramaUrl,
    offerDetailTargetId,
    offerDetailVrLink,
    requestedSceneFromUrl,
    roomDetailPanoramaUrl,
    roomDetailTargetId,
    roomDetailVrLink,
    serviceDetailPanoramaUrl,
    serviceDetailTargetId,
    serviceDetailVrLink,
  ]);

  const isCurrentPageDisplaying = useMemo(() => {
    if (isHomePage || isBookingPage || isGalleryPage || isSceneSyncRoute) {
      return true;
    }

    if (isAboutPage || isPolicyPage) {
      return currentSectionSettings?.is_displaying !== false;
    }

    if (isRegulationPage) {
      return regulationContent?.isDisplaying !== false;
    }

    if (isContactPage) {
      return contactContent?.isDisplaying !== false;
    }

    if (isRoomsPage || isDiningPage || isFacilityPage || isServicePage || isOffersPage) {
      return currentSectionSettings?.is_displaying !== false;
    }

    return true;
  }, [
    contactContent?.isDisplaying,
    currentSectionSettings?.is_displaying,
    isAboutPage,
    isBookingPage,
    isContactPage,
    isDiningPage,
    isFacilityPage,
    isGalleryPage,
    isHomePage,
    isOffersPage,
    isPolicyPage,
    isRegulationPage,
    isRoomsPage,
    isSceneSyncRoute,
    isServicePage,
    regulationContent?.isDisplaying,
  ]);

  const shouldUseLocalVr = Boolean(activePanoramaName);
  const activeExternalVrUrl = shouldUseLocalVr ? null : pageExternalVrUrl || defaultVr360Url;
  const mediaType = useMemo(() => getMediaType(activeExternalVrUrl || ''), [activeExternalVrUrl]);
  const shouldBlockOnVisualReady = !hasVisualBootstrapped;
  const isVisualReady = shouldUseLocalVr ? localVrReady : iframeLoaded;
  const shouldShowLoadingScreen =
    (isTransitioningToLocalVr ||
      (!shouldUseLocalVr &&
        !isViewingRoomDetail &&
        !isViewingDiningDetail &&
        !isViewingFacilityDetail &&
        !isViewingServiceDetail &&
        !isViewingOfferDetail &&
        (isRouteLoading || (shouldBlockOnVisualReady && !isVisualReady))));
  const handleLocalVrReadyChange = useCallback(
    (ready: boolean) => {
      localVrReadyRef.current = ready;
      setLocalVrReady((previousReady) => (previousReady === ready ? previousReady : ready));
      if (ready) {
        setIsTransitioningToLocalVr(false);
        setHasVisualBootstrapped(true);
        forceComplete();
      }
    },
    [forceComplete],
  );

  useEffect(() => {
    if (iframeLoaded) {
      setHasVisualBootstrapped(true);
    }
  }, [iframeLoaded]);

  useEffect(() => {
    prevActivePanoramaNameRef.current = activePanoramaName;
  }, [activePanoramaName]);

  // Debounced visibility for the local 3DVista iframe: show immediately when a local
  // scene is active, but delay hiding so quick scene-to-scene navigation doesn't
  // toggle display:none (which would pause 3DVista and break its crossfade).
  useEffect(() => {
    if (shouldUseLocalVr) {
      setKeepLocalVrVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setKeepLocalVrVisible(false), 400);
    return () => clearTimeout(timer);
  }, [shouldUseLocalVr]);

  useEffect(() => {
    if (!shouldBlockOnVisualReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      localVrReadyRef.current = true;
      setHasVisualBootstrapped(true);
      setIframeLoaded(true);
      setLocalVrReady(true);
      setIsTransitioningToLocalVr(false);
      forceComplete();
    }, 1800);

    return () => {
      clearTimeout(timer);
    };
  }, [forceComplete, shouldBlockOnVisualReady]);

  useEffect(() => {
    if (shouldUseLocalVr) {
      // Only show loading on the very first transition to local VR (viewer not yet initialized).
      // Once viewer has been ready at least once, it stays mounted (hidden) so no reload needed.
      if (!prevShouldUseLocalVrRef.current && !localVrReadyRef.current) {
        setIsTransitioningToLocalVr(true);
      }
      prevShouldUseLocalVrRef.current = true;
      setIframeLoaded(true);
      return;
    }
    prevShouldUseLocalVrRef.current = false;
    setIsTransitioningToLocalVr(false);

    if (iframeTimeoutRef.current) {
      clearTimeout(iframeTimeoutRef.current);
    }

    if (activeExternalVrUrl !== prevVisualUrlRef.current) {
      setIframeLoaded(false);
      iframeTimeoutRef.current = window.setTimeout(() => {
        setIframeLoaded(true);
        forceComplete();
      }, prevVisualUrlRef.current ? 800 : 1000);
      prevVisualUrlRef.current = activeExternalVrUrl || null;
    }

    return () => {
      if (iframeTimeoutRef.current) {
        clearTimeout(iframeTimeoutRef.current);
      }
    };
  }, [activeExternalVrUrl, forceComplete, shouldUseLocalVr]);

  const isDesktop = screens.md;
  const shouldShowInfoBox = isCurrentPageDisplaying
    ? isDesktop
      ? isMenuExpanded
      : isInfoBoxVisible && !isMenuExpanded
    : false;

  const handleCloseInfoBox = useCallback(() => {
    setIsInfoBoxVisible(false);
    setUserClosedInfoBox(true);
  }, []);

  const handleOpenInfoBox = useCallback(() => {
    setIsInfoBoxVisible(true);
    setUserClosedInfoBox(false);
  }, []);

  useEffect(() => {
    if (screens.md !== undefined && !hasInitialized.current) {
      hasInitialized.current = true;
      if (!screens.md) {
        setIsMenuExpanded(false);
        setIsInfoBoxVisible(true);
        setUserClosedInfoBox(false);
      }
    }
  }, [screens.md]);

  useEffect(() => {
    if (!isDesktop) {
      setIsMenuExpanded(false);
      setIsInfoBoxVisible(true);
      setUserClosedInfoBox(false);
    }
  }, [isDesktop, location.pathname]);

  if (isSceneSyncRoute) {
    return <VR360SceneSyncPage />;
  }

  return (
    <Layout
      id="page"
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <LoadingScreen
        logoUrl={logoUrl}
        visible={shouldShowLoadingScreen}
      />

      <ThemeInjector />
      <SEOMeta />

      <Content id="primary" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div style={{ width: '100%', height: '100%' }}>
          {loading ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor,
              }}
            >
              <Skeleton.Node active style={{ width: 200, height: 200 }}>
                <span style={{ color: '#ccc' }}>Dang tai VR360...</span>
              </Skeleton.Node>
            </div>
          ) : (
            <>
              <ThreeDVistaBackground
                visible={keepLocalVrVisible}
                panoramaName={activePanoramaName}
                onReadyChange={handleLocalVrReadyChange}
                showNextPanoButton={isStandaloneVrScene}
              />
            </>
          )}
          {!shouldUseLocalVr && !keepLocalVrVisible && (
            activeExternalVrUrl ? (
              mediaType === 'image' ? (
                <img
                  key={activeExternalVrUrl}
                  src={activeExternalVrUrl}
                  alt={`${propertyName} Background`}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    zIndex: 0,
                  }}
                  onLoad={() => {
                    setIframeLoaded(true);
                    forceComplete();
                  }}
                />
              ) : mediaType === 'youtube' ? (
                <iframe
                  key={activeExternalVrUrl}
                  src={getYouTubeEmbedUrl(activeExternalVrUrl)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    border: 0,
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                  title={`${propertyName} Video Background`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  onLoad={() => {
                    setIframeLoaded(true);
                    forceComplete();
                  }}
                />
              ) : (
                <iframe
                  key={activeExternalVrUrl}
                  src={activeExternalVrUrl}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    border: 0,
                    zIndex: 0,
                  }}
                  title={`${propertyName} VR360 Tour`}
                  allowFullScreen
                  onLoad={() => {
                    setIframeLoaded(true);
                    forceComplete();
                  }}
                />
              )
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                }}
                ref={() => {
                  if (!iframeLoaded) {
                    setIframeLoaded(true);
                    forceComplete();
                  }
                }}
              />
            )
          )}
        </div>
      </Content>

      {!isStandaloneVrScene && (
        <>
          <Header isMenuExpanded={isMenuExpanded} onMenuToggle={setIsMenuExpanded} />

          <InfoBox title={pageTitle || undefined} isVisible={shouldShowInfoBox} onClose={handleCloseInfoBox}>
            {isHomePage && <PropertyPostsContent />}
            {isAboutPage && <AboutContent />}
            {isRoomsPage && (
              <RoomsView
                onTitleChange={setRoomTitle}
                onRoomVrChange={handleRoomVrChange}
                onViewingDetailChange={setIsViewingRoomDetail}
                initialCode={roomCodeFromUrl}
              />
            )}
            {isDiningPage && (
              <DiningView
                onTitleChange={setDiningTitle}
                onDiningVrChange={handleDiningVrChange}
                onViewingDetailChange={setIsViewingDiningDetail}
                initialCode={diningCodeFromUrl}
              />
            )}
            {isFacilityPage && (
              <FacilityView
                onTitleChange={setFacilityTitle}
                onFacilityVrChange={handleFacilityVrChange}
                onViewingDetailChange={setIsViewingFacilityDetail}
                initialCode={facilityCodeFromUrl}
              />
            )}
            {isServicePage && (
              <ServiceView
                onTitleChange={setServiceTitle}
                onServiceVrChange={handleServiceVrChange}
                onViewingDetailChange={setIsViewingServiceDetail}
                initialCode={serviceCodeFromUrl}
              />
            )}
            {isPolicyPage && <PolicyContent />}
            {isContactPage && (
              <ContactContent content={contactContent} loading={contactLoading} error={contactError} />
            )}
            {isGalleryPage && <GalleryContent />}
            {isRegulationPage && (
              <RegulationContent content={regulationContent} loading={regulationLoading} error={regulationError} />
            )}
            {isOffersPage && (
              <OfferView
                onTitleChange={setOfferTitle}
                onOfferVrChange={handleOfferVrChange}
                onViewingDetailChange={setIsViewingOfferDetail}
                initialCode={offerCodeFromUrl}
              />
            )}
          </InfoBox>

          {!isDesktop && userClosedInfoBox && (
            <a
              className="show-info-btn"
              onClick={handleOpenInfoBox}
              style={{
                position: 'fixed',
                left: screens.md ? 15 : 10,
                bottom: screens.md ? 65 : 55,
                zIndex: 1998,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(0, 0, 0, 0.68)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
                color: primaryColor,
                border: 'none',
                borderRadius: 6,
                padding: '6px',
                fontSize: screens.sm ? 13 : 12,
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 39,
                  lineHeight: '38px',
                  background: primaryColor,
                  color: '#fff',
                  textAlign: 'center',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                i
              </div>
              <div
                style={{
                  fontFamily: "'UTMCafeta', 'UTMNeoSansIntel', Arial, sans-serif",
                  letterSpacing: '0.5px',
                  paddingRight: '10px',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.showInfo}
              </div>
            </a>
          )}

          <BottomBar />
        </>
      )}

      <Suspense fallback={<LoadingScreen logoUrl={logoUrl} visible />}>
        <Routes>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={`/:lang${ROUTES.HOME}`} element={<HomePage />} />
          <Route path={ROUTES.ABOUT} element={<AboutPage />} />
          <Route path={`/:lang${ROUTES.ABOUT}`} element={<AboutPage />} />
          <Route path="/gioi-thieu" element={<div />} />
          <Route path="/:lang/gioi-thieu" element={<div />} />
          <Route path="/phong-nghi" element={<RoomsPage />} />
          <Route path="/:lang/phong-nghi" element={<RoomsPage />} />
          <Route path="/phong-nghi/:code" element={<RoomsPage />} />
          <Route path="/:lang/phong-nghi/:code" element={<RoomsPage />} />
          <Route path="/dat-phong" element={<div />} />
          <Route path="/:lang/dat-phong" element={<div />} />
          <Route path="/am-thuc" element={<div />} />
          <Route path="/:lang/am-thuc" element={<div />} />
          <Route path="/am-thuc/:code" element={<div />} />
          <Route path="/:lang/am-thuc/:code" element={<div />} />
          <Route path="/tien-ich" element={<div />} />
          <Route path="/:lang/tien-ich" element={<div />} />
          <Route path="/tien-ich/:code" element={<div />} />
          <Route path="/:lang/tien-ich/:code" element={<div />} />
          <Route path="/dich-vu" element={<div />} />
          <Route path="/:lang/dich-vu" element={<div />} />
          <Route path="/dich-vu/:code" element={<div />} />
          <Route path="/:lang/dich-vu/:code" element={<div />} />
          <Route path="/lien-he" element={<div />} />
          <Route path="/:lang/lien-he" element={<div />} />
          <Route path="/chinh-sach" element={<div />} />
          <Route path="/:lang/chinh-sach" element={<div />} />
          <Route path="/thu-vien-anh" element={<div />} />
          <Route path="/:lang/thu-vien-anh" element={<div />} />
          <Route path="/noi-quy-khach-san" element={<div />} />
          <Route path="/:lang/noi-quy-khach-san" element={<div />} />
          <Route path="/uu-dai" element={<div />} />
          <Route path="/:lang/uu-dai" element={<div />} />
          <Route path="/uu-dai/:code" element={<div />} />
          <Route path="/:lang/uu-dai/:code" element={<div />} />
          <Route path={ROUTES.VR360_SCENE_SYNC} element={<div />} />
          <Route path={`/:lang${ROUTES.VR360_SCENE_SYNC}`} element={<div />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

const LanguageWrapper: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { property } = usePropertyContext();
  return (
    <LanguageProvider propertyId={property?.id || null}>
      <ThemeProvider>{children}</ThemeProvider>
    </LanguageProvider>
  );
};

function App() {
  // Slug của sale nằm ở segment path đầu tiên (vd /coraltest/...).
  // Set làm basename để mọi route/điều hướng tự giữ prefix mà không cần sửa từng link.
  const saleSlug = getSaleSlugFromUrl();
  const routerBasename = saleSlug ? `/${saleSlug}` : undefined;

  return (
    <PropertyProvider>
      <SaleProvider>
        <Router basename={routerBasename}>
          <LanguageWrapper>
            <AppLayout />
          </LanguageWrapper>
        </Router>
      </SaleProvider>
    </PropertyProvider>
  );
}

export default App;
