import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftOpen,
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  Sparkles,
  Truck,
  Upload,
  User,
  X,
} from 'lucide-react';
import { AppPage, DashboardBlockId, EnrichedOrder, GlobalFilters, Vehicle } from './types';
import { useFleetStore } from './store/useFleetStore';
import { useAuth } from './contexts/AuthContext';
import { LoginLamp } from './components/LoginLamp';
import {
  buildActionByCategory,
  buildCategoryBreakdown,
  buildDailyTrendData,
  buildMonthlyVehicleStatus,
  buildPoBreakdown,
  buildSixMonthSeries,
  buildTopRecurringItems,
  buildTopVehicles,
  computePeriodMetrics,
  computePriorityAlerts,
  filterEnrichedOrders,
  resolveDateRange,
  resolvePreviousRange,
} from './utils/analytics';
import { buildDemoDataset } from './utils/demoData';
import { exportReportToExcel } from './utils/excel';
import {
  formatDateTimeVN,
  formatMonthLabel,
  getCurrentMonthStatusTitle,
  getCurrentYearMonth,
  getLocalISODate,
  getMonthDateRange,
  getPreviousMonth,
} from './utils/format';
import { isVehicleAssignedToUser, normalizePlateKey } from './utils/plate';
import { GlobalFilterBar } from './components/GlobalFilterBar';
import { KpiSummaryRow } from './components/KpiSummaryRow';
import { ComparisonOverview } from './components/ComparisonOverview';
import { PriorityAlertsPanel } from './components/PriorityAlertsPanel';
import { DashboardCharts } from './components/DashboardCharts';
import { OrdersTable } from './components/OrdersTable';
import { VehiclesView } from './components/VehiclesView';
import { PoTrackingView } from './components/PoTrackingView';
import { SettingsAuditView } from './components/SettingsAuditView';
import { OrderFormModal } from './components/OrderFormModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { VehicleQuickDrawer } from './components/VehicleQuickDrawer';
import { DisplayCustomizePopover } from './components/DisplayCustomizePopover';
import { DashboardSkeleton } from './components/DashboardSkeleton';

function createDefaultFilters(): GlobalFilters {
  const currentYM = getCurrentYearMonth();
  const range = getMonthDateRange(currentYM);
  return {
    periodPreset: 'month',
    selectedMonth: currentYM,
    customStartDate: range.start,
    customEndDate: range.end,
    plateKey: '',
    vehicleType: '',
    department: '',
    garage: '',
    category: '',
    serviceType: '',
    action: '',
    poNumber: '',
    searchQuery: '',
  };
}

const NAV_ITEMS: Array<{
  id: AppPage;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: LayoutDashboard },
  { id: 'orders', label: 'Phiếu bảo dưỡng', shortLabel: 'Phiếu BD', icon: ClipboardList },
  { id: 'vehicles', label: 'Đội xe & Hồ sơ', shortLabel: 'Đội xe', icon: Truck },
  { id: 'po', label: 'Theo dõi PO', shortLabel: 'Theo dõi', icon: Receipt },
  { id: 'settings', label: 'Cài đặt & Nhật ký', shortLabel: 'Cài đặt', icon: Settings },
];

const COMPANY_LOGO_SRC =
  '/assets/aistudio/23-logo-thai-viet-corporation-removebg-preview__1__370dbc13.png';

const DASHBOARD_BLOCK_LABELS: Record<DashboardBlockId, string> = {
  kpi_summary: '4 thẻ chỉ số KPI tổng quan',
  monthly_status: 'THÔNG TIN DỮ LIỆU TRONG THÁNG',
  alerts: 'Góc Cảnh Báo Khẩn',
  charts: 'Biểu đồ phân tích chi tiết',
  orders_table: 'Bảng chi tiết phiếu bảo dưỡng',
};

const VALID_APP_PAGES: AppPage[] = ['dashboard', 'orders', 'vehicles', 'po', 'settings'];

function resolveInitialPageFromUrl(isAdmin: boolean): AppPage {
  const defaultPage: AppPage = isAdmin ? 'dashboard' : 'orders';
  if (typeof window === 'undefined') return defaultPage;
  const hashRaw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const queryTab = (params.get('tab') || params.get('page') || '').trim().toLowerCase();
  const pathSeg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const candidate = (hashRaw || queryTab || pathSeg) as AppPage;

  if (VALID_APP_PAGES.includes(candidate)) {
    if (!isAdmin && (candidate === 'dashboard' || candidate === 'settings')) {
      return 'orders';
    }
    return candidate;
  }
  return defaultPage;
}

function DashboardApp({ onLogout }: { onLogout: () => Promise<void> }) {
  const { user, profile, isAdmin, displayName, syncVehiclesForAuth } = useAuth();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  const store = useFleetStore({
    actorName: displayName,
    isAdmin,
    userId: user?.id ?? null,
    assignedVehiclePlate: profile?.vehicle_plate ?? null,
    onSyncError: showToast,
  });
  const effectiveAdminMode = isAdmin && store.isAdminMode;
  const [activePage, setActivePage] = useState<AppPage>(() =>
    resolveInitialPageFromUrl(isAdmin)
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [filters, setFilters] = useState<GlobalFilters>(() => createDefaultFilters());
  const [liveDateKey, setLiveDateKey] = useState<string>(() => getLocalISODate());

  useEffect(() => {
    const refreshClock = () => {
      const nextKey = getLocalISODate();
      setLiveDateKey((prev) => (prev === nextKey ? prev : nextKey));
    };
    window.addEventListener('focus', refreshClock);
    document.addEventListener('visibilitychange', refreshClock);
    const timer = window.setInterval(refreshClock, 60_000);
    return () => {
      window.removeEventListener('focus', refreshClock);
      document.removeEventListener('visibilitychange', refreshClock);
      window.clearInterval(timer);
    };
  }, []);

  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [drawerVehicleId, setDrawerVehicleId] = useState<string | null>(null);
  const [isPeriodSwitching, setIsPeriodSwitching] = useState(false);
  const periodInitRef = useRef(true);

  useEffect(() => {
    if (periodInitRef.current) {
      periodInitRef.current = false;
      return;
    }
    setIsPeriodSwitching(true);
    const timer = window.setTimeout(() => setIsPeriodSwitching(false), 260);
    return () => window.clearTimeout(timer);
  }, [
    filters.periodPreset,
    filters.selectedMonth,
    filters.customStartDate,
    filters.customEndDate,
    demoMode,
  ]);

  // Keep AuthContext driver name reactively synced whenever fleet vehicle data changes
  useEffect(() => {
    syncVehiclesForAuth(store.vehicles);
  }, [store.vehicles, syncVehiclesForAuth]);

  // Block bypass URL routes (#dashboard, #settings, ?tab=...) for role = user
  useEffect(() => {
    const enforceRouteGuard = () => {
      const hashRaw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const queryTab = (params.get('tab') || params.get('page') || '').trim().toLowerCase();
      const pathSeg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      const targetsRestricted =
        hashRaw === 'settings' ||
        queryTab === 'settings' ||
        pathSeg === 'settings' ||
        hashRaw === 'dashboard' ||
        queryTab === 'dashboard' ||
        pathSeg === 'dashboard';

      if (!isAdmin && targetsRestricted) {
        setActivePage('orders');
        if (window.location.hash || params.has('tab') || params.has('page')) {
          params.delete('tab');
          params.delete('page');
          const nextSearch = params.toString() ? `?${params.toString()}` : '';
          window.history.replaceState(null, '', `${window.location.pathname}${nextSearch}`);
        }
      } else if (
        VALID_APP_PAGES.includes(hashRaw as AppPage) &&
        (isAdmin || (hashRaw !== 'settings' && hashRaw !== 'dashboard'))
      ) {
        setActivePage(hashRaw as AppPage);
      }
    };

    enforceRouteGuard();
    window.addEventListener('hashchange', enforceRouteGuard);
    return () => window.removeEventListener('hashchange', enforceRouteGuard);
  }, [isAdmin]);

  // Modals
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<EnrichedOrder | null>(null);
  const [preselectedVehicleId, setPreselectedVehicleId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Global keyboard shortcuts: Ctrl+K / Cmd+K / "/"
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      } else if (e.key === '/' && !isTyping && !orderModalOpen && !importModalOpen) {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orderModalOpen, importModalOpen]);

  const updateFilters = (patch: Partial<GlobalFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const resetAllFilters = () => {
    const freshDefaults = createDefaultFilters();
    setFilters((prev) => ({
      ...freshDefaults,
      periodPreset: prev.periodPreset,
      selectedMonth: prev.selectedMonth,
      customStartDate: prev.customStartDate,
      customEndDate: prev.customEndDate,
    }));
  };

  // ==================== DATASET & ANALYTICS DERIVATIONS ====================
  const activeDataset = useMemo(() => {
    if (demoMode) {
      return buildDemoDataset(
        store.vehicles,
        filters.selectedMonth || getCurrentYearMonth()
      );
    }
    return {
      vehicles: store.vehicles,
      orders: store.orders,
      items: store.items,
    };
  }, [demoMode, store.vehicles, store.orders, store.items, filters.selectedMonth]);

  const currentRange = useMemo(() => resolveDateRange(filters), [filters]);
  const prevRange = useMemo(() => resolvePreviousRange(filters), [filters]);

  const currentFiltered = useMemo(
    () =>
      filterEnrichedOrders(
        activeDataset.vehicles,
        activeDataset.orders,
        activeDataset.items,
        filters,
        currentRange
      ),
    [activeDataset.vehicles, activeDataset.orders, activeDataset.items, filters, currentRange]
  );

  const prevFiltered = useMemo(
    () =>
      filterEnrichedOrders(
        activeDataset.vehicles,
        activeDataset.orders,
        activeDataset.items,
        filters,
        prevRange
      ),
    [activeDataset.vehicles, activeDataset.orders, activeDataset.items, filters, prevRange]
  );

  const currentMetrics = useMemo(
    () =>
      computePeriodMetrics(
        currentFiltered.orders,
        currentFiltered.items,
        activeDataset.orders,
        activeDataset.vehicles.length
      ),
    [currentFiltered, activeDataset.orders, activeDataset.vehicles.length]
  );

  const prevMetrics = useMemo(
    () =>
      computePeriodMetrics(
        prevFiltered.orders,
        prevFiltered.items,
        activeDataset.orders,
        activeDataset.vehicles.length
      ),
    [prevFiltered, activeDataset.orders, activeDataset.vehicles.length]
  );

  const sixMonthSeries = useMemo(
    () =>
      buildSixMonthSeries(
        activeDataset.vehicles,
        activeDataset.orders,
        activeDataset.items,
        filters
      ),
    [activeDataset.vehicles, activeDataset.orders, activeDataset.items, filters]
  );

  const alerts = useMemo(
    () =>
      computePriorityAlerts(
        activeDataset.vehicles,
        activeDataset.orders,
        activeDataset.items,
        currentFiltered.orders,
        currentRange.label
      ),
    [
      activeDataset.vehicles,
      activeDataset.orders,
      activeDataset.items,
      currentFiltered.orders,
      currentRange.label,
    ]
  );

  const dailyData = useMemo(
    () =>
      buildDailyTrendData(
        currentFiltered.orders,
        prevFiltered.orders,
        filters.selectedMonth
      ),
    [currentFiltered.orders, prevFiltered.orders, filters.selectedMonth]
  );

  const categoryData = useMemo(
    () => buildCategoryBreakdown(currentFiltered.items),
    [currentFiltered.items]
  );

  const topVehicles = useMemo(
    () => buildTopVehicles(currentFiltered.orders, prevFiltered.orders),
    [currentFiltered.orders, prevFiltered.orders]
  );

  const liveNow = useMemo(() => {
    const [y, m, d] = liveDateKey.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [liveDateKey]);

  const currentYearMonth = useMemo(() => getCurrentYearMonth(liveNow), [liveNow]);
  const prevCalendarMonth = useMemo(
    () => getPreviousMonth(currentYearMonth, 1),
    [currentYearMonth]
  );
  const monthlyStatusTitle = useMemo(
    () => getCurrentMonthStatusTitle(liveNow),
    [liveNow]
  );

  const dashboardBlockLabels = useMemo<Record<DashboardBlockId, string>>(
    () => ({
      ...DASHBOARD_BLOCK_LABELS,
      monthly_status: monthlyStatusTitle,
    }),
    [monthlyStatusTitle]
  );

  const currentMonthFiltered = useMemo(
    () =>
      filterEnrichedOrders(
        activeDataset.vehicles,
        activeDataset.orders,
        activeDataset.items,
        filters,
        getMonthDateRange(currentYearMonth)
      ),
    [activeDataset.vehicles, activeDataset.orders, activeDataset.items, filters, currentYearMonth]
  );

  const prevCalendarMonthFiltered = useMemo(
    () =>
      filterEnrichedOrders(
        activeDataset.vehicles,
        activeDataset.orders,
        activeDataset.items,
        filters,
        getMonthDateRange(prevCalendarMonth)
      ),
    [activeDataset.vehicles, activeDataset.orders, activeDataset.items, filters, prevCalendarMonth]
  );

  const vehicleStatuses = useMemo(
    () =>
      buildMonthlyVehicleStatus(
        activeDataset.vehicles,
        currentMonthFiltered.orders,
        prevCalendarMonthFiltered.orders,
        filters
      ),
    [
      activeDataset.vehicles,
      currentMonthFiltered.orders,
      prevCalendarMonthFiltered.orders,
      filters,
    ]
  );

  const poData = useMemo(
    () => buildPoBreakdown(currentFiltered.items),
    [currentFiltered.items]
  );

  const recurringItems = useMemo(
    () => buildTopRecurringItems(currentFiltered.items),
    [currentFiltered.items]
  );

  const actionByCategory = useMemo(
    () => buildActionByCategory(currentFiltered.items),
    [currentFiltered.items]
  );

  const drawerVehicle = useMemo(
    () =>
      drawerVehicleId
        ? activeDataset.vehicles.find((v) => v.id === drawerVehicleId) ?? null
        : null,
    [drawerVehicleId, activeDataset.vehicles]
  );

  const crossFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.plateKey) {
      chips.push({
        key: 'plate',
        label: `Biển số: ${filters.plateKey}`,
        clear: () => updateFilters({ plateKey: '' }),
      });
    }
    if (filters.category) {
      chips.push({
        key: 'cat',
        label: `Nhóm: ${filters.category}`,
        clear: () => updateFilters({ category: '' }),
      });
    }
    if (filters.poNumber) {
      chips.push({
        key: 'po',
        label: filters.poNumber === '__MISSING__' ? 'PO: Thiếu số PO' : `PO: ${filters.poNumber}`,
        clear: () => updateFilters({ poNumber: '' }),
      });
    }
    if (filters.serviceType) {
      chips.push({
        key: 'stype',
        label: `Loại BD: ${filters.serviceType}`,
        clear: () => updateFilters({ serviceType: '' }),
      });
    }
    if (filters.action) {
      chips.push({
        key: 'action',
        label: `Hành động: ${filters.action}`,
        clear: () => updateFilters({ action: '' }),
      });
    }
    if (filters.garage) {
      chips.push({
        key: 'garage',
        label: `Gara: ${filters.garage}`,
        clear: () => updateFilters({ garage: '' }),
      });
    }
    if (filters.department) {
      chips.push({
        key: 'dept',
        label: `Bộ phận: ${filters.department}`,
        clear: () => updateFilters({ department: '' }),
      });
    }
    if (filters.vehicleType) {
      chips.push({
        key: 'vtype',
        label: `Loại xe: ${filters.vehicleType}`,
        clear: () => updateFilters({ vehicleType: '' }),
      });
    }
    if (filters.searchQuery.trim()) {
      chips.push({
        key: 'q',
        label: `Từ khóa: "${filters.searchQuery.trim()}"`,
        clear: () => updateFilters({ searchQuery: '' }),
      });
    }
    return chips;
  }, [filters]);

  // ==================== HANDLERS ====================
  const openVehicleProfile = (vehicleId: string, plate?: string) => {
    if (plate) store.pushRecentPlate(plate);
    else {
      const v = activeDataset.vehicles.find((x) => x.id === vehicleId);
      if (v) store.pushRecentPlate(v.plate);
    }
    if (demoMode) {
      setDrawerVehicleId(vehicleId);
      return;
    }
    setSelectedVehicleId(vehicleId);
    setActivePage('vehicles');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleCrossFilterPlate = (vehicle: Vehicle) => {
    const targetKey = normalizePlateKey(vehicle.plate);
    const activeKey = normalizePlateKey(filters.plateKey);
    updateFilters({
      plateKey: activeKey === targetKey ? '' : vehicle.plate,
    });
  };

  const openNewOrder = (vehId?: string | null) => {
    if (isAdmin) {
      showToast('Admin không có quyền thêm/lập phiếu bảo dưỡng mới.');
      return;
    }
    const assignedVehicles = store.vehicles.filter((v) =>
      isVehicleAssignedToUser(v, user?.id ?? null, profile?.vehicle_plate ?? null)
    );
    if (assignedVehicles.length === 0) {
      showToast('Tài khoản của bạn chưa được gắn phụ trách biển số xe nào.');
      return;
    }
    if (vehId) {
      const matched = assignedVehicles.find((v) => v.id === vehId || v.plate === vehId);
      if (!matched) {
        showToast('Bạn chỉ được thêm/lập phiếu cho biển số xe đang phụ trách.');
        return;
      }
      setPreselectedVehicleId(matched.id);
    } else {
      setPreselectedVehicleId(assignedVehicles[0].id);
    }
    setEditingOrder(null);
    setOrderModalOpen(true);
  };

  const openEditOrder = (order: EnrichedOrder) => {
    if (!isAdmin || demoMode) return;
    setEditingOrder(order);
    setPreselectedVehicleId(null);
    setOrderModalOpen(true);
  };

  const handleFilterByPoAndGoDashboard = (poNumber: string) => {
    updateFilters({ poNumber });
    if (isAdmin) {
      if (activePage !== 'dashboard' && activePage !== 'orders') {
        setActivePage('dashboard');
      }
    } else if (activePage !== 'orders') {
      setActivePage('orders');
    }
  };

  const handleExportExcel = () => {
    exportReportToExcel(currentRange.label, currentFiltered.orders, activeDataset.vehicles);
    showToast(`Đã xuất file Excel báo cáo ${currentRange.label}.`);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const urgentVehicleAlertCount = alerts.filter((a) => a.category === 'registration').length;

  const isBlockHidden = (block: DashboardBlockId) =>
    store.hiddenDashboardBlocks.includes(block);

  const visibleNavItems = isAdmin
    ? effectiveAdminMode
      ? NAV_ITEMS
      : NAV_ITEMS.filter((item) => !store.hiddenReportTabs.includes(item.id))
    : NAV_ITEMS.filter(
        (item) =>
          item.id !== 'dashboard' &&
          item.id !== 'settings' &&
          (item.id === 'orders' || !store.hiddenReportTabs.includes(item.id))
      );

  const navigateToPage = (page: AppPage) => {
    if (!isAdmin && (page === 'dashboard' || page === 'settings')) {
      setActivePage('orders');
      return;
    }
    setActivePage(page);
    if (page !== 'vehicles') setSelectedVehicleId(null);
    setTabletDrawerOpen(false);
    setMobileUserMenuOpen(false);
  };

  // Redirect safely if active tab is hidden or admin-only
  useEffect(() => {
    const forbiddenForUser =
      !isAdmin && (activePage === 'dashboard' || activePage === 'settings');
    const hiddenForViewer =
      !effectiveAdminMode &&
      (isAdmin || activePage !== 'orders') &&
      store.hiddenReportTabs.includes(activePage);
    if (forbiddenForUser || hiddenForViewer) {
      setActivePage(isAdmin ? 'dashboard' : 'orders');
    }
  }, [isAdmin, effectiveAdminMode, store.hiddenReportTabs, activePage]);

  // Strictly guarded admin-only vehicle creation handlers
  const handleGuardedAddVehicle: typeof store.addVehicle = (payload) => {
    if (!isAdmin) {
      return { ok: false, error: 'Chỉ Admin mới có quyền thêm xe mới.' };
    }
    return store.addVehicle(payload);
  };

  const handleGuardedBulkAddPlates: typeof store.bulkAddPlates = (
    rawEntries,
    defaultType,
    defaultDepartment
  ) => {
    if (!isAdmin) {
      return { added: [], skipped: rawEntries };
    }
    return store.bulkAddPlates(rawEntries, defaultType, defaultDepartment);
  };

  const isDashboardLoading = store.isSyncing || isPeriodSwitching;
  const isEmptyPeriod =
    !demoMode &&
    !isDashboardLoading &&
    currentMetrics.totalCost === 0 &&
    currentFiltered.orders.length === 0;

  return (
    <div className="min-h-dvh flex bg-transparent text-slate-900 relative overflow-x-hidden w-full">
      {/* Atmospheric Ambient Refraction Layer */}
      <div className="glass-backdrop no-print" aria-hidden="true">
        <div className="glass-orb glass-orb-sapphire" />
        <div className="glass-orb glass-orb-indigo" />
        <div className="glass-orb glass-orb-teal" />
      </div>

      {/* Tablet Collapsed Icon-Only Rail (768px - 1023px) — Deep Navy Glass */}
      <aside
        aria-label="Thanh điều hướng thu gọn"
        className="hidden md:flex lg:hidden flex-col w-[76px] shrink-0 glass-sidebar text-slate-200 no-print relative z-20"
      >
        <div className="sticky top-0 h-[100dvh] py-4 px-2.5 flex flex-col items-center justify-between">
          <div className="flex flex-col items-center gap-3 w-full">
            <div
              className="w-10 h-10 rounded-xl bg-white/95 p-1.5 flex items-center justify-center shadow-lg shadow-blue-950/40 ring-1 ring-white/40 shrink-0 overflow-hidden"
              title="THAI VIET CORPORATION"
            >
              <img
                src={COMPANY_LOGO_SRC}
                alt="THAI VIET CORPORATION"
                className="w-full h-full object-contain"
              />
            </div>

            <button
              type="button"
              onClick={() => setTabletDrawerOpen(true)}
              title="Mở rộng thanh điều hướng"
              aria-label="Mở rộng thanh điều hướng"
              className="w-11 h-11 rounded-xl bg-white/8 border border-white/15 text-slate-200 hover:text-white hover:bg-white/15 flex items-center justify-center transition-colors touch-press"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            <div className="w-8 h-px bg-white/12" />

            <nav aria-label="Điều hướng máy tính bảng" className="flex flex-col items-center gap-2 w-full">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                const badgeCount =
                  isAdmin && item.id === 'vehicles' && urgentVehicleAlertCount > 0
                    ? urgentVehicleAlertCount
                    : item.id === 'po' && currentMetrics.missingPoItemCount > 0
                    ? currentMetrics.missingPoItemCount
                    : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateToPage(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    className={`relative w-11 h-11 rounded-xl flex items-center justify-center ${
                      active
                        ? 'nav-tab-3d-active'
                        : 'nav-tab-3d text-slate-300 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-xs">
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col items-center gap-1.5 pt-3 border-t border-white/12 w-full">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                title="Nhập Excel / CSV (UPSERT)"
                aria-label="Nhập Excel / CSV"
                className="w-11 h-11 rounded-xl bg-white/8 border border-white/15 text-slate-200 hover:text-white hover:bg-white/15 flex items-center justify-center transition-colors touch-press"
              >
                <Upload className="w-4.5 h-4.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onLogout();
              }}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              className="w-11 h-11 rounded-xl bg-white/6 border border-white/12 text-slate-300 hover:text-red-300 hover:bg-red-500/20 flex items-center justify-center transition-colors touch-press"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar (Laptop & Large Desktop >= 1024px) — Deep Navy Glass */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 glass-sidebar text-slate-200 no-print relative z-20">
        <div className="sticky top-0 h-[100dvh] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {/* Brand Emblem & System Title */}
            <div className="px-1 pt-1 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/95 p-1.5 flex items-center justify-center shadow-lg shadow-blue-950/40 ring-1 ring-white/40 shrink-0 overflow-hidden">
                <img
                  src={COMPANY_LOGO_SRC}
                  alt="THAI VIET CORPORATION"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[11px] font-extrabold tracking-tight text-white leading-tight whitespace-nowrap"
                  title="THAI VIET CORPORATION"
                >
                  THAI VIET CORPORATION
                </div>
                <div className="text-[11px] font-medium text-blue-200/75 truncate mt-0.5">
                  Quản Lý Bảo Dưỡng Đội Xe
                </div>
              </div>
            </div>

            {/* Authenticated User Profile Card */}
            <div className="px-3 py-2.5 rounded-xl bg-white/8 border border-white/14 backdrop-blur-md shadow-inner flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isAdmin
                    ? 'bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/30'
                    : 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/30'
                }`}
              >
                {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[11.5px] font-bold text-white leading-snug break-words"
                  title={displayName}
                >
                  {displayName}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none whitespace-nowrap ${
                      isAdmin
                        ? 'bg-blue-500/25 text-blue-200 border border-blue-400/35'
                        : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/35'
                    }`}
                  >
                    {isAdmin ? 'Admin' : 'Người dùng'}
                  </span>
                  {profile?.vehicle_plate && (
                    <span className="font-mono text-[10px] font-semibold text-slate-300 truncate">
                      {profile.vehicle_plate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Clean Enterprise Navigation — 3D Liquid Glass Tabs */}
            <nav aria-label="Điều hướng chính" className="space-y-2">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                const isTabHidden = store.hiddenReportTabs.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateToPage(item.id)}
                    className={`w-full min-w-0 min-h-[42px] flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                      active
                        ? 'nav-tab-3d-active'
                        : isTabHidden
                        ? 'nav-tab-3d text-slate-500 line-through'
                        : 'nav-tab-3d text-slate-200 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {isAdmin && item.id === 'vehicles' && urgentVehicleAlertCount > 0 && (
                      <span
                        className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          active
                            ? 'bg-white/25 text-white border border-white/30'
                            : 'bg-red-500/25 text-red-200 border border-red-400/35'
                        }`}
                      >
                        {urgentVehicleAlertCount}
                      </span>
                    )}
                    {item.id === 'po' && currentMetrics.missingPoItemCount > 0 && (
                      <span
                        className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          active
                            ? 'bg-white/25 text-white border border-white/30'
                            : 'bg-amber-500/25 text-amber-200 border border-amber-400/35'
                        }`}
                      >
                        {currentMetrics.missingPoItemCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Clean Actions */}
          <div className="space-y-2 pt-4 border-t border-white/12">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/16 text-xs font-semibold text-white transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                Nhập Excel / CSV (UPSERT)
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/6 hover:bg-red-500/20 border border-white/12 hover:border-red-400/40 text-xs font-semibold text-slate-300 hover:text-red-200 transition-all"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              Đăng xuất
            </button>

            <div className="px-2 pt-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Đội xe quản lý</span>
              <strong className="font-mono text-slate-200">{activeDataset.vehicles.length} xe</strong>
            </div>
          </div>
        </div>
      </aside>

      {/* iPad / Mobile Slide-over Navigation Drawer — Deep Navy Glass */}
      <AnimatePresence>
        {tabletDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs lg:hidden no-print"
            onClick={() => setTabletDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: -296 }}
              animate={{ x: 0 }}
              exit={{ x: -296 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-72 max-w-[85vw] h-[100dvh] glass-sidebar text-slate-200 p-4 flex flex-col justify-between overflow-y-auto safe-top safe-bottom"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/95 p-1.5 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
                      <img
                        src={COMPANY_LOGO_SRC}
                        alt="THAI VIET CORPORATION"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-[11px] tracking-tight text-white leading-tight whitespace-nowrap">
                        THAI VIET CORPORATION
                      </div>
                      <div className="text-[10.5px] font-medium text-blue-200/75">
                        Quản Lý Bảo Dưỡng Đội Xe
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTabletDrawerOpen(false)}
                    aria-label="Đóng thanh điều hướng"
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* User Badge */}
                <div className="px-3 py-2.5 rounded-xl bg-white/8 border border-white/14 flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isAdmin
                        ? 'bg-blue-500/25 text-blue-200'
                        : 'bg-emerald-500/25 text-emerald-200'
                    }`}
                  >
                    {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white leading-snug break-words">
                      {displayName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${
                          isAdmin
                            ? 'bg-blue-500/25 text-blue-200 border border-blue-400/35'
                            : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/35'
                        }`}
                      >
                        {isAdmin ? 'Admin' : 'Người dùng'}
                      </span>
                      {profile?.vehicle_plate && (
                        <span className="font-mono text-[10px] font-semibold text-slate-300">
                          {profile.vehicle_plate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <nav className="space-y-2">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    const isTabHidden = store.hiddenReportTabs.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateToPage(item.id)}
                        className={`w-full min-h-[44px] flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                          active
                            ? 'nav-tab-3d-active'
                            : isTabHidden
                            ? 'nav-tab-3d text-slate-500 line-through'
                            : 'nav-tab-3d text-slate-200 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4.5 h-4.5 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                        {isAdmin && item.id === 'vehicles' && urgentVehicleAlertCount > 0 && (
                          <span
                            className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                              active
                                ? 'bg-white/25 text-white border border-white/30'
                                : 'bg-red-500/25 text-red-200'
                            }`}
                          >
                            {urgentVehicleAlertCount}
                          </span>
                        )}
                        {item.id === 'po' && currentMetrics.missingPoItemCount > 0 && (
                          <span
                            className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                              active
                                ? 'bg-white/25 text-white border border-white/30'
                                : 'bg-amber-500/25 text-amber-200'
                            }`}
                          >
                            {currentMetrics.missingPoItemCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 pt-4 border-t border-white/12">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setTabletDrawerOpen(false);
                      setImportModalOpen(true);
                    }}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/16 text-white text-xs font-semibold"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-300" />
                    Nhập Excel / CSV (UPSERT)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setTabletDrawerOpen(false);
                    onLogout();
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/18 hover:bg-red-500/28 text-red-200 text-xs font-semibold border border-red-400/35"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full flex flex-col relative z-10">
        {/* Top Bar: Sticky Frosted Glass Header */}
        <header className="sticky top-0 z-30 glass-panel-strong border-x-0! border-t-0! border-b border-white/80! px-3 sm:px-5 md:px-6 pt-3 md:py-3.5 pb-2.5 space-y-2.5 md:space-y-0 no-print safe-top w-full min-w-0">
          {/* Mobile Compact Top Row (< 768px) */}
          <div className="flex md:hidden items-center justify-between gap-2 relative min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setTabletDrawerOpen(true)}
                aria-label="Mở menu điều hướng"
                className="min-w-[44px] min-h-[44px] rounded-xl glass-tile inline-flex items-center justify-center text-slate-700 shrink-0 touch-press"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-white/90 border border-white p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                <img
                  src={COMPANY_LOGO_SRC}
                  alt="THAI VIET CORPORATION"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-950 leading-tight truncate">
                  {activePage === 'dashboard' && 'BÁO CÁO ĐỘI XE'}
                  {activePage === 'orders' && 'Phiếu bảo dưỡng'}
                  {activePage === 'vehicles' && (selectedVehicleId ? 'Hồ sơ phương tiện' : 'Đội xe & Hồ sơ')}
                  {activePage === 'po' && 'Theo dõi PO'}
                  {activePage === 'settings' && 'Cài đặt & Nhật ký'}
                </h1>
                <div className="text-[11px] font-semibold text-slate-500 leading-tight truncate">
                  THAI VIET CORPORATION
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isAdmin && activePage === 'dashboard' && (
                <DisplayCustomizePopover
                  isAdminMode={store.isAdminMode}
                  hiddenDashboardBlocks={store.hiddenDashboardBlocks}
                  hiddenReportTabs={store.hiddenReportTabs}
                  blockLabels={dashboardBlockLabels}
                  navTabs={NAV_ITEMS}
                  onToggleAdminMode={store.toggleAdminMode}
                  onToggleBlockVisibility={store.toggleDashboardBlockVisibility}
                  onToggleTabVisibility={store.toggleReportTabVisibility}
                  onResetAll={() => {
                    store.resetReportVisibility();
                    showToast('Đã khôi phục hiển thị mặc định toàn bộ báo cáo.');
                  }}
                />
              )}

              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => openNewOrder()}
                  aria-label="Thêm phiếu bảo dưỡng mới"
                  title="Thêm phiếu bảo dưỡng mới"
                  className="min-w-[44px] min-h-[44px] sm:px-3.5 rounded-xl glass-button-primary text-white inline-flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap touch-press"
                >
                  <Plus className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="hidden sm:inline">Thêm phiếu</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setMobileUserMenuOpen((prev) => !prev)}
                aria-label="Tài khoản và đăng xuất"
                className={`min-w-[44px] min-h-[44px] rounded-xl glass-tile flex items-center justify-center touch-press ${
                  isAdmin ? 'text-blue-700' : 'text-emerald-700'
                }`}
              >
                {isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </button>
            </div>

            {/* Mobile User Profile & Logout Popover */}
            <AnimatePresence>
              {mobileUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMobileUserMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-1.5rem)] max-h-[80dvh] overflow-y-auto glass-panel-strong rounded-2xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isAdmin
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {isAdmin ? <Shield className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold text-slate-950 break-words leading-snug">
                          {displayName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                              isAdmin
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isAdmin ? 'Admin' : 'Người dùng'}
                          </span>
                          {profile?.vehicle_plate && (
                            <span className="font-mono text-[11px] font-semibold text-slate-600">
                              {profile.vehicle_plate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileUserMenuOpen(false);
                          setImportModalOpen(true);
                        }}
                        className="w-full min-h-[44px] flex items-center gap-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-blue-700"
                      >
                        <Upload className="w-4 h-4" />
                        Nhập Excel / CSV (UPSERT)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setMobileUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Single Unified Search Bar (< 768px, 100% width) */}
          <div className="md:hidden relative w-full flex items-center">
            <Search className="w-4 h-4 text-blue-600 absolute left-3.5 pointer-events-none" />
            <input
              type="search"
              value={filters.searchQuery}
              onChange={(e) => updateFilters({ searchQuery: e.target.value })}
              placeholder="Tìm biển số, số PO, hạng mục..."
              aria-label="Tìm nhanh biển số, số PO, hạng mục"
              className="glass-input w-full min-h-[44px] pl-10 pr-20 rounded-xl text-sm text-slate-900 placeholder:text-slate-500"
            />
            <div className="absolute right-1.5 flex items-center gap-0.5">
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => updateFilters({ searchQuery: '' })}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                aria-label="Mở tìm kiếm nâng cao"
                title="Mở tra cứu nhanh xe & PO"
                className="min-h-[34px] px-2.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold whitespace-nowrap"
              >
                Tra cứu
              </button>
            </div>
          </div>

          {/* Tablet & Desktop Top Bar (>= 768px) */}
          <div className="hidden md:flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 max-w-[1520px] mx-auto w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-[200px] flex-1">
              <button
                type="button"
                onClick={() => setTabletDrawerOpen(true)}
                className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-700 touch-press shrink-0"
                aria-label="Mở rộng menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="fluid-page-title font-extrabold tracking-tight text-slate-950 break-words leading-snug min-w-0">
                {activePage === 'dashboard' && 'BÁO CÁO BẢO DƯỠNG ĐỘI XE'}
                {activePage === 'orders' && 'Danh sách phiếu bảo dưỡng'}
                {activePage === 'vehicles' &&
                  (selectedVehicleId ? 'Hồ sơ chi tiết phương tiện' : 'Quản lý đội xe & Hạn bảo dưỡng')}
                {activePage === 'po' && 'Theo dõi chi phí theo số PO'}
                {activePage === 'settings' && 'Cài đặt dữ liệu & Nhật ký thay đổi'}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 max-w-full">
              {/* Single Unified Search Input (>= 768px) */}
              <div className="relative flex items-center w-60 lg:w-72 xl:w-80 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                  placeholder="Tìm nhanh biển số, PO, hạng mục..."
                  aria-label="Tìm nhanh biển số, PO, hạng mục"
                  className="glass-input w-full min-h-[40px] pl-9 pr-16 rounded-xl text-xs text-slate-900 placeholder:text-slate-500"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  {filters.searchQuery && (
                    <button
                      type="button"
                      onClick={() => updateFilters({ searchQuery: '' })}
                      aria-label="Xóa từ khóa"
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSearchModalOpen(true)}
                    title="Mở tra cứu nhanh (Ctrl+K)"
                    className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 hover:bg-blue-50 text-slate-600 hover:text-blue-700 shrink-0 transition-colors"
                  >
                    Ctrl K
                  </button>
                </div>
              </div>

              {isAdmin && activePage === 'dashboard' && (
                <DisplayCustomizePopover
                  isAdminMode={store.isAdminMode}
                  hiddenDashboardBlocks={store.hiddenDashboardBlocks}
                  hiddenReportTabs={store.hiddenReportTabs}
                  blockLabels={dashboardBlockLabels}
                  navTabs={NAV_ITEMS}
                  onToggleAdminMode={store.toggleAdminMode}
                  onToggleBlockVisibility={store.toggleDashboardBlockVisibility}
                  onToggleTabVisibility={store.toggleReportTabVisibility}
                  onResetAll={() => {
                    store.resetReportVisibility();
                    showToast('Đã khôi phục hiển thị mặc định toàn bộ báo cáo.');
                  }}
                />
              )}

              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => openNewOrder()}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl glass-button-primary text-white text-xs font-bold transition-all whitespace-nowrap shrink-0 touch-press"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Thêm phiếu
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Print-only executive header for PDF export */}
        <div className="print-only px-6 pt-2 pb-4 border-b border-slate-300 mb-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-extrabold text-slate-900">
              THAI VIET CORPORATION — BÁO CÁO BẢO DƯỠNG ĐỘI XE — {currentRange.label.toUpperCase()}
            </h1>
            <span className="text-xs font-mono text-slate-600">
              Xuất lúc: {formatDateTimeVN(store.lastUpdated)}
            </span>
          </div>
        </div>

        {/* Main Viewport — reserves clearance for mobile fixed bottom nav bar + safe-area */}
        <main className="flex-1 px-3 sm:px-5 md:px-6 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-10 pt-4 space-y-4 w-full max-w-[1560px] mx-auto min-w-0">
          {/* Demo Mode Active Banner */}
          {demoMode && (
            <div className="glass-panel rounded-2xl border-indigo-300/80! bg-linear-to-r! from-indigo-50/85! via-white/75! to-blue-50/75! px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 no-print">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Đang bật <strong>Chế độ dữ liệu mẫu</strong> — Dữ liệu minh họa chỉ hiển thị tạm thời trên trình duyệt, không ghi vào Supabase.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDemoMode(false);
                  showToast('Đã tắt dữ liệu mẫu — hiển thị 100% dữ liệu thật từ Supabase.');
                }}
                className="px-3 py-1 rounded-lg glass-tile text-indigo-800 text-xs font-bold whitespace-nowrap"
              >
                Tắt dữ liệu mẫu
              </button>
            </div>
          )}

          {/* Global Filter Bar on analytical & ledger pages */}
          {(activePage === 'dashboard' || activePage === 'orders' || activePage === 'po') && (
            <GlobalFilterBar
              filters={filters}
              onChange={updateFilters}
              onResetAll={resetAllFilters}
              vehicles={activeDataset.vehicles}
              orders={activeDataset.orders}
              items={activeDataset.items}
              lastUpdated={store.lastUpdated}
              isSyncing={store.isSyncing}
              onRefresh={store.refreshData}
              onExportExcel={handleExportExcel}
              onExportPdf={handleExportPdf}
              demoMode={demoMode}
              onToggleDemoMode={() => {
                setDemoMode((prev) => {
                  const next = !prev;
                  showToast(
                    next
                      ? 'Đã bật Chế độ dữ liệu mẫu (không ghi vào Supabase).'
                      : 'Đã khôi phục dữ liệu thật từ Supabase.'
                  );
                  return next;
                });
              }}
            />
          )}

          {/* Page Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activePage}_${selectedVehicleId ?? 'list'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4 min-w-0"
            >
              {isAdmin && activePage === 'dashboard' && (
                <>
                  {/* Smart Empty State Banner */}
                  {isEmptyPeriod && (
                    <div className="glass-panel rounded-2xl border-blue-300/75! px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 no-print">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20 flex items-center justify-center shrink-0">
                          <Calendar className="w-4.5 h-4.5" />
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug break-words">
                          <span className="font-extrabold text-slate-950">{currentRange.label}</span> chưa phát sinh chi phí bảo dưỡng.
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {filters.periodPreset !== 'quarter' && (
                          <button
                            type="button"
                            onClick={() => updateFilters({ periodPreset: 'quarter' })}
                            className="px-3.5 py-2 rounded-xl glass-tile text-slate-800 text-xs font-semibold whitespace-nowrap touch-press"
                          >
                            Xem dữ liệu Quý này
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDemoMode(true);
                            showToast('Đã bật Chế độ dữ liệu mẫu để xem thử biểu đồ & KPI.');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-button-primary text-white text-xs font-semibold whitespace-nowrap touch-press"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Bật dữ liệu mẫu
                        </button>
                      </div>
                    </div>
                  )}

                  {isDashboardLoading ? (
                    <DashboardSkeleton />
                  ) : (
                    /* Dynamic Overview Blocks (ordered by store.dashboardBlockOrder, cleanly hidden if toggled off) */
                    store.dashboardBlockOrder.map((blockId) => {
                      if (!isAdmin && blockId === 'alerts') return null;
                      if (isBlockHidden(blockId)) return null;

                      let content: React.ReactNode = null;

                      if (blockId === 'kpi_summary') {
                        content = (
                          <KpiSummaryRow
                            currentMetrics={currentMetrics}
                            prevMetrics={prevMetrics}
                            vehicles={activeDataset.vehicles}
                            periodLabel={currentRange.label}
                            prevLabel={prevRange.label}
                            liveTodayISO={liveDateKey}
                            isLoading={false}
                            onFilterByMissingPo={() => updateFilters({ poNumber: '__MISSING__' })}
                            onOpenVehiclesTab={() => navigateToPage('vehicles')}
                          />
                        );
                      } else if (blockId === 'monthly_status') {
                        content = (
                          <ComparisonOverview
                            title={monthlyStatusTitle}
                            periodLabel={formatMonthLabel(currentYearMonth)}
                            prevLabel={formatMonthLabel(prevCalendarMonth)}
                            vehicleStatuses={vehicleStatuses}
                            liveTodayISO={liveDateKey}
                            activePlateKey={filters.plateKey}
                            onOpenVehicle={openVehicleProfile}
                            onOpenVehicleDrawer={(v) => setDrawerVehicleId(v.id)}
                            onToggleCrossFilterPlate={handleToggleCrossFilterPlate}
                            canCreateOrder={!isAdmin && !demoMode}
                            onOpenNewOrderForVehicle={
                              !isAdmin && !demoMode ? (vid) => openNewOrder(vid) : undefined
                            }
                          />
                        );
                      } else if (blockId === 'alerts') {
                        content = (
                          <PriorityAlertsPanel
                            alerts={alerts}
                            onOpenVehicle={openVehicleProfile}
                            onApplyFilter={(patch) => updateFilters(patch)}
                            onOpenNewOrderForVehicle={
                              !isAdmin && !demoMode ? (vid) => openNewOrder(vid) : undefined
                            }
                          />
                        );
                      } else if (blockId === 'charts') {
                        content = (
                          <DashboardCharts
                            dailyData={dailyData}
                            categoryData={categoryData}
                            topVehicles={topVehicles}
                            poData={poData}
                            sixMonthSeries={sixMonthSeries}
                            recurringItems={recurringItems}
                            actionByCategory={actionByCategory}
                            totalCategoryCost={currentMetrics.totalCost}
                            monthlyBudget={store.monthlyBudget}
                            periodLabel={currentRange.label}
                            prevLabel={prevRange.label}
                            activeCategory={filters.category}
                            activePo={filters.poNumber}
                            activePlateKey={filters.plateKey}
                            canCreateOrder={!isAdmin && !demoMode}
                            onCreateOrder={!isAdmin && !demoMode ? () => openNewOrder() : undefined}
                            onEnableDemoMode={
                              !demoMode
                                ? () => {
                                    setDemoMode(true);
                                    showToast('Đã bật Chế độ dữ liệu mẫu để xem thử biểu đồ.');
                                  }
                                : undefined
                            }
                            onFilterChange={updateFilters}
                            onOpenVehicle={openVehicleProfile}
                          />
                        );
                      } else if (blockId === 'orders_table') {
                        content = (
                          <OrdersTable
                            orders={currentFiltered.orders}
                            canModifyOrders={isAdmin && !demoMode}
                            onOpenVehicle={openVehicleProfile}
                            onEditOrder={openEditOrder}
                            onDeleteOrder={(id) => {
                              if (!isAdmin || demoMode) return;
                              store.deleteOrder(id);
                              showToast('Đã xóa phiếu bảo dưỡng và ghi nhận vào Nhật ký.');
                            }}
                            onFilterByPo={(po) => updateFilters({ poNumber: po })}
                            onAddNew={!isAdmin && !demoMode ? () => openNewOrder() : undefined}
                            crossFilterChips={crossFilterChips}
                            onClearAllCrossFilters={resetAllFilters}
                          />
                        );
                      }

                      if (!content) return null;

                      return (
                        <motion.div
                          key={blockId}
                          layout="position"
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {content}
                        </motion.div>
                      );
                    })
                  )}
                </>
              )}

              {activePage === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 no-print">
                    <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl glass-segment">
                      <button
                        type="button"
                        onClick={() => updateFilters({ poNumber: '', serviceType: '' })}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                          !filters.poNumber && !filters.serviceType
                            ? 'tab-3d-active'
                            : 'tab-3d'
                        }`}
                      >
                        Tất cả ({currentFiltered.orders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateFilters({
                            poNumber: filters.poNumber === '__MISSING__' ? '' : '__MISSING__',
                          })
                        }
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                          filters.poNumber === '__MISSING__'
                            ? 'tab-3d-active-amber'
                            : 'tab-3d text-amber-900!'
                        }`}
                      >
                        Thiếu số PO
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateFilters({
                            serviceType:
                              filters.serviceType === 'Sửa chữa đột xuất'
                                ? ''
                                : 'Sửa chữa đột xuất',
                          })
                        }
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                          filters.serviceType === 'Sửa chữa đột xuất'
                            ? 'tab-3d-active'
                            : 'tab-3d'
                        }`}
                      >
                        Sửa chữa đột xuất
                      </button>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setImportModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-tile text-xs font-semibold text-blue-800 touch-press"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Nhập hàng loạt từ Excel / CSV
                      </button>
                    )}
                  </div>

                  <OrdersTable
                    orders={currentFiltered.orders}
                    canModifyOrders={isAdmin && !demoMode}
                    title={`Danh sách phiếu bảo dưỡng — ${currentRange.label}`}
                    subtitle="Bấm vào bất kỳ dòng nào để xem danh sách hạng mục, phụ tùng và số PO"
                    onOpenVehicle={openVehicleProfile}
                    onEditOrder={openEditOrder}
                    onDeleteOrder={(id) => {
                      if (!isAdmin || demoMode) return;
                      store.deleteOrder(id);
                      showToast('Đã xóa phiếu bảo dưỡng.');
                    }}
                    onFilterByPo={(po) => updateFilters({ poNumber: po })}
                    onAddNew={!isAdmin && !demoMode ? () => openNewOrder() : undefined}
                    crossFilterChips={crossFilterChips}
                    onClearAllCrossFilters={resetAllFilters}
                  />
                </div>
              )}

              {activePage === 'vehicles' && (
                <VehiclesView
                  vehicles={store.vehicles}
                  allOrders={store.orders}
                  allItems={store.items}
                  selectedVehicleId={selectedVehicleId}
                  isAdmin={isAdmin}
                  currentUserId={user?.id ?? null}
                  assignedVehiclePlate={profile?.vehicle_plate ?? null}
                  onSelectVehicle={(vid) => {
                    setSelectedVehicleId(vid);
                    if (vid) {
                      const v = store.vehicles.find((x) => x.id === vid);
                      if (v) store.pushRecentPlate(v.plate);
                    }
                  }}
                  onAddVehicle={(payload, opts) => {
                    const res = handleGuardedAddVehicle(payload);
                    if (res.ok && !opts?.silent) {
                      showToast(`Đã thêm xe ${res.vehicle.plate} vào đội xe.`);
                    }
                    return res;
                  }}
                  onUpdateVehicle={(id, upd, opts) => {
                    if (!isAdmin) {
                      return { ok: false, error: 'Chỉ Admin mới có quyền cập nhật thông tin xe.' };
                    }
                    const res = store.updateVehicle(id, upd);
                    if (res.ok && !opts?.silent) showToast('Đã cập nhật hồ sơ phương tiện.');
                    return res;
                  }}
                  onDeleteVehicle={store.deleteVehicle}
                  onOpenNewOrderForVehicle={(vid) => openNewOrder(vid)}
                  onEditOrder={openEditOrder}
                  onDeleteOrder={(id) => {
                    if (!isAdmin) return;
                    store.deleteOrder(id);
                    showToast('Đã xóa phiếu bảo dưỡng.');
                  }}
                  onFilterByPo={handleFilterByPoAndGoDashboard}
                  onNotify={showToast}
                />
              )}

              {activePage === 'po' && (
                <PoTrackingView
                  filteredItems={currentFiltered.items}
                  canAssignPo={isAdmin && !demoMode}
                  onFilterByPo={handleFilterByPoAndGoDashboard}
                  onAssignPo={(itemId, po) => {
                    if (!isAdmin || demoMode) return;
                    store.assignPoToItem(itemId, po);
                    showToast(`Đã gắn số PO ${po.trim().toUpperCase()} cho hạng mục.`);
                  }}
                  onOpenVehicle={openVehicleProfile}
                />
              )}

              {isAdmin && activePage === 'settings' && (
                <SettingsAuditView
                  auditLogs={store.auditLogs}
                  vehicles={store.vehicles}
                  isAdmin={isAdmin}
                  vehicleCount={store.vehicles.length}
                  orderCount={store.orders.length}
                  itemCount={store.items.length}
                  onOpenImport={() => setImportModalOpen(true)}
                  onExportExcel={handleExportExcel}
                  onUpdateVehicle={(id, upd, opts) => {
                    const res = store.updateVehicle(id, upd);
                    if (res.ok && !opts?.silent) showToast('Đã cập nhật hồ sơ phương tiện.');
                    return res;
                  }}
                  onDeleteVehicle={store.deleteVehicle}
                  onRefreshFleet={store.refreshData}
                  onNotify={showToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (< 768px) */}
      <nav
        aria-label="Điều hướng điện thoại"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel-strong border-x-0! border-b-0! border-t border-white/85! px-1.5 pt-1 safe-bottom no-print shadow-[0_-8px_28px_-10px_rgba(15,23,42,0.18)]"
      >
        <div
          className="grid gap-1.5 items-stretch py-1"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, visibleNavItems.length)}, minmax(0, 1fr))`,
          }}
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            const badgeCount =
              isAdmin && item.id === 'vehicles' && urgentVehicleAlertCount > 0
                ? urgentVehicleAlertCount
                : item.id === 'po' && currentMetrics.missingPoItemCount > 0
                ? currentMetrics.missingPoItemCount
                : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToPage(item.id)}
                className={`relative min-w-0 min-h-[54px] py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 font-bold ${
                  active ? 'tab-3d-active' : 'tab-3d'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                      {badgeCount}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-tight text-center whitespace-nowrap truncate max-w-full">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-3 md:right-6 left-3 md:left-auto z-50 glass-panel-strong px-4 py-3 rounded-xl border-emerald-300/80! shadow-xl flex items-center gap-2 text-xs font-semibold text-slate-950 no-print"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="break-words">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vehicle Quick Slide-over Drawer */}
      <VehicleQuickDrawer
        vehicle={drawerVehicle}
        allOrders={activeDataset.orders}
        allItems={activeDataset.items}
        liveTodayISO={liveDateKey}
        isFilteredByThisVehicle={Boolean(
          drawerVehicle &&
            normalizePlateKey(filters.plateKey) === normalizePlateKey(drawerVehicle.plate)
        )}
        canCreateOrderForVehicle={Boolean(
          drawerVehicle &&
            !isAdmin &&
            !demoMode &&
            isVehicleAssignedToUser(
              drawerVehicle,
              user?.id ?? null,
              profile?.vehicle_plate ?? null
            )
        )}
        onClose={() => setDrawerVehicleId(null)}
        onToggleFilterByVehicle={handleToggleCrossFilterPlate}
        onOpenFullProfile={(vid, plate) => {
          setDrawerVehicleId(null);
          if (demoMode) {
            setDemoMode(false);
            showToast('Đã tắt dữ liệu mẫu để mở hồ sơ xe thật.');
          }
          setSelectedVehicleId(vid);
          if (plate) store.pushRecentPlate(plate);
          setActivePage('vehicles');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onCreateOrderForVehicle={
          !isAdmin && !demoMode ? (vid) => openNewOrder(vid) : undefined
        }
      />

      {/* Modals */}
      <OrderFormModal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        isAdmin={isAdmin}
        editingOrder={isAdmin ? editingOrder : null}
        preselectedVehicleId={preselectedVehicleId}
        vehicles={store.vehicles}
        allOrders={store.orders}
        allItems={store.items}
        onQuickCreateVehicle={handleGuardedAddVehicle}
        onBulkAddPlates={handleGuardedBulkAddPlates}
        onSaveOrder={(orderPayload, itemPayloads) => {
          if (!isAdmin && orderPayload.id) return;
          if (isAdmin && !orderPayload.id) return;
          const savedId = store.saveOrder(orderPayload, itemPayloads);
          if (!savedId) return;
          showToast(
            orderPayload.id
              ? 'Đã cập nhật phiếu bảo dưỡng và làm mới báo cáo.'
              : 'Đã lưu phiếu bảo dưỡng mới — báo cáo đã tự cập nhật.'
          );
        }}
        onAppendToExistingOrder={(orderId, newItems) => {
          if (!isAdmin) return;
          store.appendItemsToExistingOrder(orderId, newItems);
          showToast(`Đã gộp ${newItems.length} hạng mục vào phiếu cũ thành công.`);
        }}
      />

      {isAdmin && (
        <ExcelImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          vehicles={store.vehicles}
          orders={store.orders}
          items={store.items}
          onConfirmImport={(rows) => {
            const res = store.upsertImportRows(rows);
            showToast(
              `Đã nhập Excel: +${res.inserted} mới, ${res.updated} cập nhật (UPSERT).`
            );
            return res;
          }}
        />
      )}

      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        vehicles={activeDataset.vehicles}
        orders={activeDataset.orders}
        items={activeDataset.items}
        recentPlates={store.recentPlates}
        onSelectVehicle={openVehicleProfile}
        onFilterByPo={handleFilterByPoAndGoDashboard}
        onFilterBySearch={(q) => {
          updateFilters({ searchQuery: q });
          setActivePage(isAdmin ? 'dashboard' : 'orders');
        }}
      />
    </div>
  );
}

export default function App() {
  const { session, loading, signOut } = useAuth();
  const [viewStage, setViewStage] = useState<'checking' | 'lamp' | 'revealing' | 'dashboard'>(
    'checking'
  );
  const [cameFromLamp, setCameFromLamp] = useState(false);
  const [lampInstanceKey, setLampInstanceKey] = useState(0);

  // Sync auth state without interrupting an active lamp light-bloom transition
  useEffect(() => {
    if (loading) return;

    if (!session) {
      setCameFromLamp(false);
      setViewStage((prev) => {
        if (prev !== 'lamp') {
          setLampInstanceKey((k) => k + 1);
        }
        return 'lamp';
      });
      return;
    }

    // Valid session found on initial app open -> go directly to dashboard (no lamp)
    setViewStage((prev) => (prev === 'checking' ? 'dashboard' : prev));
  }, [loading, session]);

  const handleLogout = async () => {
    await signOut();
    setCameFromLamp(false);
    setLampInstanceKey((k) => k + 1);
    setViewStage('lamp');
  };

  // While checking initial session, show dark matching canvas so neither dashboard nor lamp flashes
  if (loading || viewStage === 'checking') {
    return (
      <div
        className="fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0, #0c1424, #04060a 70%)',
        }}
        aria-busy="true"
      />
    );
  }

  // Unauthenticated or waiting for LoginLamp bloom to complete: NEVER render dashboard before auth
  const showDashboard = Boolean(session) && (viewStage === 'revealing' || viewStage === 'dashboard');
  const showLamp = !session || viewStage === 'lamp' || viewStage === 'revealing';
  const shouldAnimateReveal = cameFromLamp && viewStage === 'revealing';

  return (
    <>
      {showDashboard && (
        /* Single persistent wrapper with no resting CSS transform so DashboardApp never remounts and position:fixed bars stay anchored to viewport on iOS Safari */
        <div
          key="dashboard-shell"
          className={shouldAnimateReveal ? 'w-full animate-dashboard-reveal' : 'w-full'}
        >
          <DashboardApp onLogout={handleLogout} />
        </div>
      )}

      {showLamp && (
        <LoginLamp
          key={lampInstanceKey}
          onRevealDashboard={() => {
            setCameFromLamp(true);
            setViewStage('revealing');
          }}
          onTransitionComplete={() => {
            setViewStage('dashboard');
          }}
        />
      )}
    </>
  );
}
