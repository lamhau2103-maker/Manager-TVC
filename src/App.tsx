import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileSpreadsheet,
  GripVertical,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftOpen,
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  Truck,
  Upload,
  User,
  X,
} from 'lucide-react';
import { AppPage, DashboardBlockId, EnrichedOrder, GlobalFilters } from './types';
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
import { exportReportToExcel } from './utils/excel';
import { formatDateTimeVN } from './utils/format';
import { GlobalFilterBar } from './components/GlobalFilterBar';
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

const DEFAULT_FILTERS: GlobalFilters = {
  periodPreset: 'month',
  selectedMonth: '2026-11',
  customStartDate: '2026-11-01',
  customEndDate: '2026-11-30',
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

const NAV_ITEMS: Array<{
  id: AppPage;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: LayoutDashboard },
  { id: 'orders', label: 'Phiếu bảo dưỡng', shortLabel: 'Phiếu BD', icon: ClipboardList },
  { id: 'vehicles', label: 'Đội xe & Hồ sơ', shortLabel: 'Đội xe', icon: Truck },
  { id: 'po', label: 'Theo dõi PO', shortLabel: 'Theo dõi PO', icon: Receipt },
  { id: 'settings', label: 'Cài đặt & Nhật ký', shortLabel: 'Cài đặt', icon: Settings },
];

const COMPANY_LOGO_SRC =
  '/assets/aistudio/23-logo-thai-viet-corporation-removebg-preview__1__370dbc13.png';

const DASHBOARD_BLOCK_LABELS: Record<DashboardBlockId, string> = {
  monthly_status: 'Thông tin bảo dưỡng trong tháng ( đến hiện tại )',
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
  const { profile, isAdmin, displayName, syncVehiclesForAuth } = useAuth();
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
    onSyncError: showToast,
  });
  const effectiveAdminMode = isAdmin && store.isAdminMode;
  const [activePage, setActivePage] = useState<AppPage>(() =>
    resolveInitialPageFromUrl(isAdmin)
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);

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
  const [draggingBlockId, setDraggingBlockId] = useState<DashboardBlockId | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<DashboardBlockId | null>(null);

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
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      periodPreset: prev.periodPreset,
      selectedMonth: prev.selectedMonth,
      customStartDate: prev.customStartDate,
      customEndDate: prev.customEndDate,
    }));
  };

  // ==================== ANALYTICS DERIVATIONS ====================
  const currentRange = useMemo(() => resolveDateRange(filters), [filters]);
  const prevRange = useMemo(() => resolvePreviousRange(filters), [filters]);

  const currentFiltered = useMemo(
    () =>
      filterEnrichedOrders(
        store.vehicles,
        store.orders,
        store.items,
        filters,
        currentRange
      ),
    [store.vehicles, store.orders, store.items, filters, currentRange]
  );

  const prevFiltered = useMemo(
    () =>
      filterEnrichedOrders(
        store.vehicles,
        store.orders,
        store.items,
        filters,
        prevRange
      ),
    [store.vehicles, store.orders, store.items, filters, prevRange]
  );

  const currentMetrics = useMemo(
    () =>
      computePeriodMetrics(
        currentFiltered.orders,
        currentFiltered.items,
        store.orders,
        store.vehicles.length
      ),
    [currentFiltered, store.orders, store.vehicles.length]
  );

  const prevMetrics = useMemo(
    () =>
      computePeriodMetrics(
        prevFiltered.orders,
        prevFiltered.items,
        store.orders,
        store.vehicles.length
      ),
    [prevFiltered, store.orders, store.vehicles.length]
  );

  const sixMonthSeries = useMemo(
    () => buildSixMonthSeries(store.vehicles, store.orders, store.items, filters),
    [store.vehicles, store.orders, store.items, filters]
  );

  const alerts = useMemo(
    () =>
      computePriorityAlerts(
        store.vehicles,
        store.orders,
        store.items,
        currentFiltered.orders,
        currentRange.label
      ),
    [store.vehicles, store.orders, store.items, currentFiltered.orders, currentRange.label]
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

  const vehicleStatuses = useMemo(
    () =>
      buildMonthlyVehicleStatus(
        store.vehicles,
        currentFiltered.orders,
        prevFiltered.orders,
        filters
      ),
    [store.vehicles, currentFiltered.orders, prevFiltered.orders, filters]
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

  // ==================== HANDLERS ====================
  const openVehicleProfile = (vehicleId: string, plate?: string) => {
    if (plate) store.pushRecentPlate(plate);
    else {
      const v = store.vehicles.find((x) => x.id === vehicleId);
      if (v) store.pushRecentPlate(v.plate);
    }
    setSelectedVehicleId(vehicleId);
    setActivePage('vehicles');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openNewOrder = (_vehId?: string | null) => {
    setEditingOrder(null);
    setPreselectedVehicleId(null);
    setOrderModalOpen(true);
  };

  const openEditOrder = (order: EnrichedOrder) => {
    if (!isAdmin) return;
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
    exportReportToExcel(currentRange.label, currentFiltered.orders, store.vehicles);
    showToast(`Đã xuất file Excel báo cáo ${currentRange.label}.`);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const urgentVehicleAlertCount = alerts.filter((a) => a.category === 'registration').length;

  const isBlockHidden = (block: DashboardBlockId) =>
    store.hiddenDashboardBlocks.includes(block);

  const defaultBlockOrder: DashboardBlockId[] = [
    'monthly_status',
    'alerts',
    'charts',
    'orders_table',
  ];
  const hasCustomBlockOrder = store.dashboardBlockOrder.some(
    (id, idx) => id !== defaultBlockOrder[idx]
  );

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

  return (
    <div className="min-h-[100dvh] flex text-slate-900 relative overflow-x-clip max-w-[1600px] w-full mx-auto">
      {/* Ambient refractive orbs behind glass surfaces */}
      <div className="glass-backdrop" aria-hidden="true">
        <div className="glass-orb glass-orb-1" />
        <div className="glass-orb glass-orb-2" />
        <div className="glass-orb glass-orb-3" />
      </div>

      {/* Tablet / iPad Collapsed Icon-Only Rail (640px - 1023px) */}
      <aside
        aria-label="Thanh điều hướng thu gọn"
        className="hidden sm:flex lg:hidden flex-col w-[76px] shrink-0 p-3 pr-0 no-print relative z-20"
      >
        <div className="sticky top-3 h-[calc(100dvh-1.5rem)] glass-panel-strong rounded-2xl py-3 px-2 flex flex-col items-center justify-between">
          <div className="flex flex-col items-center gap-3 w-full">
            <div
              className="w-10 h-10 rounded-xl bg-white/95 border border-white/90 p-1 flex items-center justify-center shadow-sm shrink-0 overflow-hidden"
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
              className="w-11 h-11 rounded-xl glass-tile text-slate-700 hover:text-blue-700 hover:bg-white/85 flex items-center justify-center transition-colors touch-press"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            <div className="w-8 h-px bg-slate-200/80" />

            <nav aria-label="Điều hướng máy tính bảng" className="flex flex-col items-center gap-1.5 w-full">
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
                    className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all touch-press ${
                      active
                        ? 'glass-button-primary text-white'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-xs">
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col items-center gap-1.5 pt-3 border-t border-slate-200/70 w-full">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                title="Nhập Excel / CSV (UPSERT)"
                aria-label="Nhập Excel / CSV"
                className="w-11 h-11 rounded-xl glass-tile text-slate-700 hover:text-blue-700 flex items-center justify-center transition-colors touch-press"
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
              className="w-11 h-11 rounded-xl glass-tile text-slate-700 hover:text-red-700 hover:bg-red-50/85 flex items-center justify-center transition-colors touch-press"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar (Laptop & Large Desktop >= 1024px) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 p-4 pr-0 no-print relative z-10">
        <div className="sticky top-4 h-[calc(100dvh-2rem)] glass-panel-strong rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {/* Brand */}
            <div className="px-0.5 pt-1 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/95 border border-white/90 p-1 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                <img
                  src={COMPANY_LOGO_SRC}
                  alt="THAI VIET CORPORATION"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[10.5px] font-extrabold tracking-[-0.02em] text-slate-900 leading-tight whitespace-nowrap"
                  title="THAI VIET CORPORATION"
                >
                  THAI VIET CORPORATION
                </div>
                <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                  Báo cáo bảo dưỡng đội xe
                </div>
              </div>
            </div>

            {/* Authenticated User Profile & Role Badge at top of Sidebar */}
            <div className="px-3 py-2.5 rounded-xl glass-tile border border-white/80 flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isAdmin
                    ? 'bg-blue-600/15 text-blue-700'
                    : 'bg-emerald-600/15 text-emerald-700'
                }`}
              >
                {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[11.5px] font-bold text-slate-900 leading-snug break-words"
                  title={displayName}
                >
                  {displayName}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none whitespace-nowrap ${
                      isAdmin
                        ? 'bg-blue-100/90 text-blue-800 border border-blue-200'
                        : 'bg-slate-200/80 text-slate-700 border border-slate-300/70'
                    }`}
                  >
                    {isAdmin ? 'Admin' : 'Người dùng'}
                  </span>
                  {profile?.vehicle_plate && (
                    <span className="font-mono text-[10px] font-semibold text-slate-500 truncate">
                      {profile.vehicle_plate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation with Admin Report Tab Hide/Show Eye Icon */}
            <nav aria-label="Điều hướng chính" className="space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                const isTabHidden = store.hiddenReportTabs.includes(item.id);
                const canHideTab = effectiveAdminMode && item.id !== 'dashboard';

                return (
                  <div key={item.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => navigateToPage(item.id)}
                      className={`flex-1 min-w-0 min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                        active
                          ? 'glass-button-primary text-white'
                          : isTabHidden
                          ? 'text-slate-400 line-through bg-white/25 hover:bg-white/45'
                          : 'text-slate-700 hover:text-slate-950 hover:bg-white/55'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {isAdmin && item.id === 'vehicles' && urgentVehicleAlertCount > 0 && (
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                            active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {urgentVehicleAlertCount}
                        </span>
                      )}
                      {item.id === 'po' && currentMetrics.missingPoItemCount > 0 && (
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                            active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {currentMetrics.missingPoItemCount}
                        </span>
                      )}
                    </button>

                    {canHideTab && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          store.toggleReportTabVisibility(item.id);
                          showToast(
                            isTabHidden
                              ? `Đã hiện lại tab "${item.label}" cho người xem.`
                              : `Đã ẩn tab "${item.label}" (chỉ hiện ở chế độ Admin).`
                          );
                        }}
                        title={
                          isTabHidden
                            ? `Quyền Admin: Hiện lại tab ${item.label}`
                            : `Quyền Admin: Ẩn tab ${item.label}`
                        }
                        className={`p-2 rounded-xl border transition-colors shrink-0 ${
                          isTabHidden
                            ? 'bg-amber-50/90 border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-white/40 border-white/75 text-slate-400 hover:text-slate-800 hover:bg-white/80'
                        }`}
                      >
                        {isTabHidden ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Bottom quick tools + Admin Role Toggle + Logout */}
          <div className="space-y-2 pt-4 border-t border-slate-200/70">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    store.toggleAdminMode();
                    showToast(
                      store.isAdminMode
                        ? 'Đã chuyển sang Chế độ Xem (áp dụng ẩn các tab/báo cáo).'
                        : 'Đã bật Quyền Admin (hiện ký hiệu ẩn/hiện tab báo cáo).'
                    );
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    store.isAdminMode
                      ? 'bg-blue-50/85 border-blue-200 text-blue-800'
                      : 'glass-tile text-slate-700 hover:bg-white/80'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    {store.isAdminMode ? 'Quyền Admin: Bật' : 'Chế độ Xem'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    {store.isAdminMode ? 'Ẩn/Hiện' : 'Thành viên'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl glass-tile hover:bg-white/80 text-xs font-semibold text-slate-800 hover:text-blue-700 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Nhập Excel / CSV (UPSERT)
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl glass-tile hover:bg-red-50/85 border border-white/80 hover:border-red-200 text-xs font-semibold text-slate-700 hover:text-red-700 transition-all"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              Đăng xuất
            </button>

            <div className="px-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Đội xe quản lý</span>
              <strong className="font-mono text-slate-800">{store.vehicles.length} xe</strong>
            </div>
          </div>
        </div>
      </aside>

      {/* iPad / Tablet Expandable Full Sidebar Overlay (640px - 1023px) */}
      <AnimatePresence>
        {tabletDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs lg:hidden no-print"
            onClick={() => setTabletDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: -296 }}
              animate={{ x: 0 }}
              exit={{ x: -296 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-72 max-w-[85vw] h-[100dvh] glass-panel-strong p-4 flex flex-col justify-between overflow-y-auto safe-top safe-bottom"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/95 border border-white/90 p-1 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                      <img
                        src={COMPANY_LOGO_SRC}
                        alt="THAI VIET CORPORATION"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-[11px] tracking-[-0.02em] text-slate-900 leading-tight whitespace-nowrap">
                        THAI VIET CORPORATION
                      </div>
                      <div className="text-[10.5px] font-medium text-slate-500">
                        Báo cáo bảo dưỡng đội xe
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTabletDrawerOpen(false)}
                    aria-label="Đóng thanh điều hướng"
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* User Badge */}
                <div className="px-3 py-2.5 rounded-xl glass-tile border border-white/80 flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isAdmin
                        ? 'bg-blue-600/15 text-blue-700'
                        : 'bg-emerald-600/15 text-emerald-700'
                    }`}
                  >
                    {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 leading-snug break-words">
                      {displayName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${
                          isAdmin
                            ? 'bg-blue-100/90 text-blue-800 border border-blue-200'
                            : 'bg-slate-200/80 text-slate-700 border border-slate-300/70'
                        }`}
                      >
                        {isAdmin ? 'Admin' : 'Người dùng'}
                      </span>
                      {profile?.vehicle_plate && (
                        <span className="font-mono text-[10px] font-semibold text-slate-600">
                          {profile.vehicle_plate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <nav className="space-y-1.5">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    const isTabHidden = store.hiddenReportTabs.includes(item.id);
                    return (
                      <div key={item.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigateToPage(item.id)}
                          className={`flex-1 min-h-[44px] flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors touch-press ${
                            active
                              ? 'glass-button-primary text-white'
                              : isTabHidden
                              ? 'text-slate-400 line-through bg-white/30'
                              : 'text-slate-700 hover:bg-white/80'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon className="w-4.5 h-4.5 shrink-0" />
                            <span>{item.label}</span>
                          </span>
                          {isAdmin && item.id === 'vehicles' && urgentVehicleAlertCount > 0 && (
                            <span
                              className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                                active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {urgentVehicleAlertCount}
                            </span>
                          )}
                          {item.id === 'po' && currentMetrics.missingPoItemCount > 0 && (
                            <span
                              className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                                active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {currentMetrics.missingPoItemCount}
                            </span>
                          )}
                        </button>
                        {effectiveAdminMode && item.id !== 'dashboard' && (
                          <button
                            type="button"
                            onClick={() => store.toggleReportTabVisibility(item.id)}
                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500"
                            title="Ẩn/hiện tab"
                          >
                            {isTabHidden ? (
                              <EyeOff className="w-4 h-4 text-amber-700" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-200/70">
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        store.toggleAdminMode();
                        showToast(
                          store.isAdminMode
                            ? 'Đã chuyển sang Chế độ Xem (áp dụng ẩn các tab/báo cáo).'
                            : 'Đã bật Quyền Admin (hiện ký hiệu ẩn/hiện tab báo cáo).'
                        );
                      }}
                      className={`w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        store.isAdminMode
                          ? 'bg-blue-50/85 border-blue-200 text-blue-800'
                          : 'glass-tile text-slate-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Shield className="w-4 h-4 shrink-0" />
                        {store.isAdminMode ? 'Quyền Admin: Bật' : 'Chế độ Xem'}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {store.isAdminMode ? 'Ẩn/Hiện' : 'Thành viên'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTabletDrawerOpen(false);
                        setImportModalOpen(true);
                      }}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Nhập Excel / CSV (UPSERT)
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setTabletDrawerOpen(false);
                    onLogout();
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-50/90 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200/80"
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
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        {/* Top Bar: Mobile (<640px) has compact brand + user popover + full-width search row; Tablet/Laptop has 3-zone top bar */}
        <header className="px-3 sm:px-6 pt-3 sm:pt-4 pb-2 space-y-2.5 sm:space-y-0 no-print safe-top">
          {/* Mobile Compact Top Strip (< 640px) */}
          <div className="flex sm:hidden items-center justify-between gap-2 relative">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/95 border border-white/90 p-1 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                <img
                  src={COMPANY_LOGO_SRC}
                  alt="THAI VIET CORPORATION"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold tracking-[-0.02em] text-slate-900 leading-tight">
                  THAI VIET CORPORATION
                </div>
                <div className="text-[11px] font-medium text-slate-600 leading-tight">
                  {activePage === 'dashboard' && 'BÁO CÁO BẢO DƯỠNG ĐỘI XE'}
                  {activePage === 'orders' && 'Phiếu bảo dưỡng'}
                  {activePage === 'vehicles' && (selectedVehicleId ? 'Hồ sơ phương tiện' : 'Đội xe & Hồ sơ')}
                  {activePage === 'po' && 'Theo dõi chi phí PO'}
                  {activePage === 'settings' && 'Cài đặt & Nhật ký'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openNewOrder()}
                className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-xl glass-button-primary text-white text-xs font-bold whitespace-nowrap touch-press"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Thêm phiếu</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileUserMenuOpen((prev) => !prev)}
                aria-label="Tài khoản và đăng xuất"
                className={`min-w-[44px] min-h-[44px] rounded-xl glass-panel flex items-center justify-center touch-press ${
                  isAdmin ? 'text-blue-700' : 'text-emerald-700'
                }`}
              >
                {isAdmin ? <Shield className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
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
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-1.5rem)] glass-panel-strong rounded-2xl p-3.5 shadow-xl border border-white/90 space-y-2.5"
                  >
                    <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-200/70">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isAdmin
                            ? 'bg-blue-600/15 text-blue-700'
                            : 'bg-emerald-600/15 text-emerald-700'
                        }`}
                      >
                        {isAdmin ? <Shield className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-slate-950 break-words leading-snug">
                          {displayName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              isAdmin
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-200/80 text-slate-700 border border-slate-300/70'
                            }`}
                          >
                            {isAdmin ? 'Admin' : 'Người dùng'}
                          </span>
                          {profile?.vehicle_plate && (
                            <span className="font-mono text-[10px] font-semibold text-slate-600">
                              {profile.vehicle_plate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            store.toggleAdminMode();
                            setMobileUserMenuOpen(false);
                            showToast(
                              store.isAdminMode
                                ? 'Đã chuyển sang Chế độ Xem (áp dụng ẩn các tab/báo cáo).'
                                : 'Đã bật Quyền Admin (hiện ký hiệu ẩn/hiện tab báo cáo).'
                            );
                          }}
                          className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 rounded-xl glass-tile text-xs font-semibold text-slate-800"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-600" />
                            {store.isAdminMode ? 'Quyền Admin: Bật' : 'Chế độ Xem'}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700 uppercase">
                            {store.isAdminMode ? 'Ẩn/Hiện' : 'Xem'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMobileUserMenuOpen(false);
                            setImportModalOpen(true);
                          }}
                          className="w-full min-h-[44px] flex items-center gap-2 px-3 rounded-xl glass-tile text-xs font-semibold text-blue-700"
                        >
                          <Upload className="w-4 h-4" />
                          Nhập Excel / CSV (UPSERT)
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setMobileUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 rounded-xl bg-red-50 text-red-700 border border-red-200/80 text-xs font-bold"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Full-Width Search Row (< 640px) */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="sm:hidden w-full min-h-[44px] px-3.5 rounded-xl glass-input flex items-center gap-2.5 text-xs text-slate-600 text-left touch-press"
          >
            <Search className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="flex-1">Tìm nhanh biển số, số PO, hạng mục...</span>
          </button>

          {/* Tablet & Desktop Top Bar (>= 640px) */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setTabletDrawerOpen(true)}
                className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl glass-panel text-slate-700 touch-press shrink-0"
                aria-label="Mở rộng menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="fluid-page-title font-extrabold tracking-tight text-slate-900 break-words">
                {activePage === 'dashboard' && 'BÁO CÁO BẢO DƯỠNG ĐỘI XE'}
                {activePage === 'orders' && 'Danh sách phiếu bảo dưỡng'}
                {activePage === 'vehicles' &&
                  (selectedVehicleId ? 'Hồ sơ chi tiết phương tiện' : 'Quản lý đội xe & Hạn bảo dưỡng')}
                {activePage === 'po' && 'Theo dõi chi phí theo số PO'}
                {activePage === 'settings' && 'Cài đặt dữ liệu & Nhật ký thay đổi'}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                className="flex items-center justify-between gap-3 w-56 md:w-72 lg:w-80 min-h-[44px] px-3.5 rounded-xl glass-input text-xs text-slate-500 hover:text-slate-800 shrink-0 touch-press"
              >
                <span className="inline-flex items-center gap-2 min-w-0 truncate">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">Tìm nhanh biển số, PO, hạng mục...</span>
                </span>
                <kbd className="hidden lg:inline-block font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 shrink-0">
                  Ctrl K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => openNewOrder()}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl glass-button-primary text-white text-xs font-bold transition-all whitespace-nowrap shrink-0 touch-press"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Thêm phiếu
              </button>
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

        {/* Main Viewport */}
        <main className="flex-1 px-3 sm:px-6 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:pb-10 pt-2 space-y-4 w-full min-w-0">
          {/* Global Filter Bar on analytical & ledger pages */}
          {(activePage === 'dashboard' || activePage === 'orders' || activePage === 'po') && (
            <GlobalFilterBar
              filters={filters}
              onChange={updateFilters}
              onResetAll={resetAllFilters}
              vehicles={store.vehicles}
              orders={store.orders}
              items={store.items}
              lastUpdated={store.lastUpdated}
              isSyncing={store.isSyncing}
              onRefresh={store.refreshData}
              onExportExcel={handleExportExcel}
              onExportPdf={handleExportPdf}
            />
          )}

          {/* Page Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activePage}_${selectedVehicleId ?? 'list'}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {isAdmin && activePage === 'dashboard' && (
                <>
                  {/* Admin Visibility Control Bar on Dashboard (only visible to Admin in Admin Mode) */}
                  {effectiveAdminMode && (
                    <section
                      aria-label="Quyền Admin ẩn hiện các mục báo cáo"
                      className="glass-tile rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 no-print"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-bold text-blue-900 mr-1">
                          <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          Admin — Ẩn/Hiện tab báo cáo:
                        </span>
                        {store.dashboardBlockOrder.map((blk) => {
                          const hidden = isBlockHidden(blk);
                          return (
                            <button
                              key={blk}
                              type="button"
                              onClick={() => store.toggleDashboardBlockVisibility(blk)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap ${
                                hidden
                                  ? 'bg-amber-50/90 border-amber-300 text-amber-900 line-through'
                                  : 'bg-white/75 border-white/90 text-slate-700 hover:bg-white'
                              }`}
                              title={hidden ? 'Bấm để hiện lại mục báo cáo này' : 'Bấm để ẩn và sắp xếp vị trí mục báo cáo này'}
                            >
                              {hidden ? (
                                <EyeOff className="w-3 h-3 text-amber-700 shrink-0" />
                              ) : (
                                <Eye className="w-3 h-3 text-blue-600 shrink-0" />
                              )}
                              <span>{DASHBOARD_BLOCK_LABELS[blk]}</span>
                            </button>
                          );
                        })}
                      </div>

                      {(store.hiddenDashboardBlocks.length > 0 ||
                        store.hiddenReportTabs.length > 0 ||
                        hasCustomBlockOrder) && (
                        <button
                          type="button"
                          onClick={() => {
                            store.resetReportVisibility();
                            showToast('Đã khôi phục hiển thị và thứ tự mặc định toàn bộ báo cáo.');
                          }}
                          className="text-[11px] font-bold text-blue-700 hover:underline whitespace-nowrap shrink-0"
                        >
                          Hiện tất cả &amp; mặc định
                        </button>
                      )}
                    </section>
                  )}

                  {/* Dynamic Overview Blocks (ordered by store.dashboardBlockOrder) */}
                  {store.dashboardBlockOrder.map((blockId, index) => {
                    // Admin-only alerts center is completely hidden for standard users
                    if (!isAdmin && blockId === 'alerts') {
                      return null;
                    }

                    const hidden = isBlockHidden(blockId);
                    const totalBlocks = store.dashboardBlockOrder.length;
                    const isFirst = index === 0;
                    const isLast = index === totalBlocks - 1;
                    const isDropTarget =
                      draggingBlockId !== null &&
                      dragOverBlockId === blockId &&
                      draggingBlockId !== blockId;

                    // In Member View mode (or standard user role), hidden blocks are completely hidden
                    if (hidden && !effectiveAdminMode) {
                      return null;
                    }

                    // In Admin Mode, hidden blocks collapse into a movable glass bar (Up/Down + Drag-and-Drop)
                    if (hidden && effectiveAdminMode) {
                      return (
                        <motion.div
                          key={blockId}
                          layout="position"
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="no-print"
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggingBlockId(blockId);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggingBlockId && draggingBlockId !== blockId) {
                                setDragOverBlockId(blockId);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverBlockId === blockId) setDragOverBlockId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggingBlockId && draggingBlockId !== blockId) {
                                store.reorderDashboardBlocks(draggingBlockId, blockId);
                              }
                              setDraggingBlockId(null);
                              setDragOverBlockId(null);
                            }}
                            onDragEnd={() => {
                              setDraggingBlockId(null);
                              setDragOverBlockId(null);
                            }}
                            className={`glass-tile rounded-2xl px-4 py-2.5 border border-dashed flex flex-wrap items-center justify-between gap-2.5 transition-all cursor-grab active:cursor-grabbing ${
                              draggingBlockId === blockId
                                ? 'opacity-55 border-blue-400 bg-blue-50/60'
                                : isDropTarget
                                ? 'border-blue-500 ring-2 ring-blue-400/75 bg-blue-50/75'
                                : 'border-amber-300/90 bg-amber-50/55 hover:bg-amber-50/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="p-1 rounded-lg bg-white/75 text-slate-400 hover:text-slate-700 shrink-0"
                                title="Kéo thả để đổi vị trí lên trên hoặc xuống dưới"
                              >
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/90 border border-amber-200 text-amber-800 text-[11px] font-bold whitespace-nowrap shrink-0">
                                <EyeOff className="w-3 h-3 shrink-0" />
                                Đã ẩn
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                {DASHBOARD_BLOCK_LABELS[blockId]}
                              </span>
                              <span className="hidden sm:inline-flex font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-white/70 text-slate-500 tabular-nums shrink-0">
                                Vị trí {index + 1}/{totalBlocks}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => store.moveDashboardBlock(blockId, 'up')}
                                title="Di chuyển ô này lên trên"
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                                  isFirst
                                    ? 'bg-white/30 border-white/50 text-slate-300 cursor-not-allowed'
                                    : 'bg-white/80 border-white/95 text-slate-700 hover:text-blue-700 hover:bg-white shadow-xs'
                                }`}
                              >
                                <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                                <span>Lên trên</span>
                              </button>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => store.moveDashboardBlock(blockId, 'down')}
                                title="Di chuyển ô này xuống dưới"
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                                  isLast
                                    ? 'bg-white/30 border-white/50 text-slate-300 cursor-not-allowed'
                                    : 'bg-white/80 border-white/95 text-slate-700 hover:text-blue-700 hover:bg-white shadow-xs'
                                }`}
                              >
                                <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                                <span>Xuống dưới</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => store.toggleDashboardBlockVisibility(blockId)}
                                title="Hiện lại ô báo cáo tại vị trí này"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                              >
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                                <span>Hiện lại</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    // Visible block wrapped as drop target for dragged hidden blocks
                    let content: React.ReactNode = null;

                    if (blockId === 'monthly_status') {
                      content = (
                        <ComparisonOverview
                          periodLabel={currentRange.label}
                          prevLabel={prevRange.label}
                          vehicleStatuses={vehicleStatuses}
                          onOpenVehicle={openVehicleProfile}
                          onOpenNewOrderForVehicle={(vid) => openNewOrder(vid)}
                          isAdminMode={effectiveAdminMode}
                          onToggleBlock={store.toggleDashboardBlockVisibility}
                        />
                      );
                    } else if (blockId === 'alerts') {
                      content = (
                        <PriorityAlertsPanel
                          alerts={alerts}
                          onOpenVehicle={openVehicleProfile}
                          onApplyFilter={(patch) => updateFilters(patch)}
                          onOpenNewOrderForVehicle={(vid) => openNewOrder(vid)}
                          headerAction={
                            effectiveAdminMode ? (
                              <button
                                type="button"
                                onClick={() => store.toggleDashboardBlockVisibility('alerts')}
                                title="Quyền Admin: Ẩn Góc Cảnh Báo Khẩn"
                                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500 hover:text-red-700 hover:bg-white/85 transition-colors no-print"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                              </button>
                            ) : undefined
                          }
                        />
                      );
                    } else if (blockId === 'charts') {
                      content = (
                        <div className="space-y-2">
                          {effectiveAdminMode && (
                            <div className="flex items-center justify-end no-print">
                              <button
                                type="button"
                                onClick={() => store.toggleDashboardBlockVisibility('charts')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-tile text-[11px] font-semibold text-slate-600 hover:text-red-700"
                              >
                                <EyeOff className="w-3 h-3" />
                                Ẩn khu vực biểu đồ
                              </button>
                            </div>
                          )}
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
                            onFilterChange={updateFilters}
                            onOpenVehicle={openVehicleProfile}
                          />
                        </div>
                      );
                    } else if (blockId === 'orders_table') {
                      content = (
                        <div className="space-y-2">
                          {effectiveAdminMode && (
                            <div className="flex items-center justify-end no-print">
                              <button
                                type="button"
                                onClick={() => store.toggleDashboardBlockVisibility('orders_table')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-tile text-[11px] font-semibold text-slate-600 hover:text-red-700"
                              >
                                <EyeOff className="w-3 h-3" />
                                Ẩn bảng chi tiết phiếu
                              </button>
                            </div>
                          )}
                          <OrdersTable
                            orders={currentFiltered.orders}
                            canModifyOrders={isAdmin}
                            onOpenVehicle={openVehicleProfile}
                            onEditOrder={openEditOrder}
                            onDeleteOrder={(id) => {
                              if (!isAdmin) return;
                              store.deleteOrder(id);
                              showToast('Đã xóa phiếu bảo dưỡng và ghi nhận vào Nhật ký.');
                            }}
                            onFilterByPo={(po) => updateFilters({ poNumber: po })}
                            onAddNew={() => openNewOrder()}
                          />
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={blockId}
                        layout="position"
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onDragOver={(e) => {
                          if (!draggingBlockId) return;
                          e.preventDefault();
                          if (draggingBlockId !== blockId) {
                            setDragOverBlockId(blockId);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverBlockId === blockId) setDragOverBlockId(null);
                        }}
                        onDrop={(e) => {
                          if (!draggingBlockId) return;
                          e.preventDefault();
                          if (draggingBlockId !== blockId) {
                            store.reorderDashboardBlocks(draggingBlockId, blockId);
                          }
                          setDraggingBlockId(null);
                          setDragOverBlockId(null);
                        }}
                        className={
                          isDropTarget
                            ? 'rounded-2xl ring-2 ring-blue-400/80 ring-offset-2 ring-offset-transparent transition-all'
                            : ''
                        }
                      >
                        {content}
                      </motion.div>
                    );
                  })}
                </>
              )}

              {activePage === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 no-print">
                    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/60">
                      <button
                        type="button"
                        onClick={() => updateFilters({ poNumber: '', serviceType: '' })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          !filters.poNumber && !filters.serviceType
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          filters.poNumber === '__MISSING__'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-amber-800 hover:bg-white/60'
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          filters.serviceType === 'Sửa chữa đột xuất'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-white/60'
                        }`}
                      >
                        Sửa chữa đột xuất
                      </button>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setImportModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-panel text-xs font-semibold text-blue-700 hover:bg-white transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Nhập hàng loạt từ Excel / CSV
                      </button>
                    )}
                  </div>

                  <OrdersTable
                    orders={currentFiltered.orders}
                    canModifyOrders={isAdmin}
                    title={`Danh sách phiếu bảo dưỡng — ${currentRange.label}`}
                    subtitle="Bấm vào bất kỳ dòng nào để xem danh sách hạng mục, phụ tùng và số PO"
                    onOpenVehicle={openVehicleProfile}
                    onEditOrder={openEditOrder}
                    onDeleteOrder={(id) => {
                      if (!isAdmin) return;
                      store.deleteOrder(id);
                      showToast('Đã xóa phiếu bảo dưỡng.');
                    }}
                    onFilterByPo={(po) => updateFilters({ poNumber: po })}
                    onAddNew={() => openNewOrder()}
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
                  canAssignPo={isAdmin}
                  onFilterByPo={handleFilterByPoAndGoDashboard}
                  onAssignPo={(itemId, po) => {
                    if (!isAdmin) return;
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
                  onResetDemo={() => {
                    store.resetDemoData();
                    showToast('Đã khôi phục bộ dữ liệu mẫu ban đầu.');
                  }}
                  onUpdateVehicle={(id, upd, opts) => {
                    const res = store.updateVehicle(id, upd);
                    if (res.ok && !opts?.silent) showToast('Đã cập nhật hồ sơ phương tiện.');
                    return res;
                  }}
                  onNotify={showToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (< 640px) — omits Settings for role = user */}
      <nav
        aria-label="Điều hướng điện thoại"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 glass-panel-strong border-t border-white/85 px-1.5 pt-1 safe-bottom no-print"
      >
        <div className="flex items-stretch justify-around gap-0.5">
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
                className={`relative flex-1 min-h-[54px] py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all touch-press ${
                  active ? 'text-blue-700 bg-blue-600/10 font-bold' : 'text-slate-600 font-medium'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                      {badgeCount}
                    </span>
                  )}
                </span>
                <span className="text-[10.5px] leading-tight text-center whitespace-nowrap">
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
            transition={{ duration: 0.16 }}
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 right-3 sm:right-6 left-3 sm:left-auto z-50 glass-panel-strong px-4 py-3 rounded-xl border border-emerald-200 shadow-lg flex items-center gap-2 text-xs font-semibold text-slate-900 no-print"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="break-words">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
          store.saveOrder(orderPayload, itemPayloads);
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
        vehicles={store.vehicles}
        orders={store.orders}
        items={store.items}
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

  return (
    <>
      {showDashboard && (
        <motion.div
          key="dashboard-shell"
          initial={cameFromLamp ? { opacity: 0, scale: 0.98 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <DashboardApp onLogout={handleLogout} />
        </motion.div>
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
