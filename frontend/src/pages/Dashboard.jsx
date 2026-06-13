import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Plus,
  CalendarDays,
  AlertCircle,
  Wallet,
  Search,
  CarFront,
  Package,
  ArrowRight,
  Settings2,
  X,
  Clock,
  CheckCircle2,
  Loader2,
  Camera,
  ImagePlus,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Users,
  Boxes,
  Truck,
  BarChart3,
  Eye,
  EyeOff,
  RotateCcw,
  RefreshCw,
  FileDown,
} from 'lucide-react';

import api from '../api/axios';
import AttentionCenter from '../components/notifications/AttentionCenter';

const LAYOUT_STORAGE_KEY = 'vinMatrixDashboardLayout';
const LEGACY_WIDGETS_KEY = 'vinMatrixDashboardWidgets';

const DEFAULT_WIDGET_ORDER = [
  'welcome',
  'businessKpis',
  'attentionCenter',
  'quickActions',
  'financialPulse',
  'novaPostPulse',
  'stockPulse',
  'topProducts',
  'topClients',
  'aiScanner',
  'todayTasks',
  'recommendations',
  'alerts',
];

const DEFAULT_WIDGETS = {
  welcome: true,
  businessKpis: true,
  attentionCenter: true,
  quickActions: true,
  financialPulse: true,
  novaPostPulse: true,
  stockPulse: true,
  topProducts: true,
  topClients: true,
  aiScanner: true,
  todayTasks: true,
  recommendations: true,
  alerts: true,
};

const WIDGET_META = {
  welcome: {
    label: 'Привітання та пошук',
    description: 'Великий верхній блок з пошуком запчастин.',
    icon: LayoutGrid,
  },
  businessKpis: {
    label: 'Головні KPI',
    description: 'Виручка, прибуток, борги, активні замовлення.',
    icon: BarChart3,
  },
  attentionCenter: {
    label: 'Центр повідомлень',
    description: 'Борги, доставка, склад, прострочені задачі.',
    icon: AlertCircle,
  },
  quickActions: {
    label: 'Швидкі дії',
    description: 'Нове замовлення, пошук, склад, експорт.',
    icon: Plus,
  },
  financialPulse: {
    label: 'Фінансовий пульс',
    description: 'Виручка за сьогодні, 7 днів, місяць і середній чек.',
    icon: Wallet,
  },
  novaPostPulse: {
    label: 'Нова пошта',
    description: 'Повернення, післяплата, отримані посилки, довга доставка.',
    icon: Truck,
  },
  stockPulse: {
    label: 'Склад',
    description: 'Низькі залишки і вартість складу.',
    icon: Boxes,
  },
  topProducts: {
    label: 'Топ товари',
    description: 'Найкращі товари за місяць по виручці.',
    icon: Package,
  },
  topClients: {
    label: 'Топ клієнти',
    description: 'Клієнти з найбільшою виручкою за місяць.',
    icon: Users,
  },
  aiScanner: {
    label: 'Хмарний ШІ-сканер',
    description: 'OCR-скан техпаспорта.',
    icon: Camera,
  },
  todayTasks: {
    label: 'План на сьогодні',
    description: 'Активні замовлення або візити на сьогодні.',
    icon: CalendarDays,
  },
  recommendations: {
    label: 'Рекомендації CRM',
    description: 'Сервісні рекомендації, які скоро треба виконати.',
    icon: ClipboardList,
  },
  alerts: {
    label: 'Алерти',
    description: 'Короткий список проблем, які потребують уваги.',
    icon: AlertCircle,
  },
};

const safeJsonParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const buildDefaultLayout = () => {
  const legacy = safeJsonParse(localStorage.getItem(LEGACY_WIDGETS_KEY), {});
  return {
    version: 2,
    widgets: {
      ...DEFAULT_WIDGETS,
      ...(legacy || {}),
    },
    order: [...DEFAULT_WIDGET_ORDER],
  };
};

const loadDashboardLayout = () => {
  const saved = safeJsonParse(localStorage.getItem(LAYOUT_STORAGE_KEY), null);

  if (!saved || !Array.isArray(saved.order) || !saved.widgets || typeof saved.widgets !== 'object') {
    return buildDefaultLayout();
  }

  const knownKeys = Object.keys(DEFAULT_WIDGETS);
  const order = [
    ...saved.order.filter((key) => knownKeys.includes(key)),
    ...knownKeys.filter((key) => !saved.order.includes(key)),
  ];

  return {
    version: 2,
    widgets: {
      ...DEFAULT_WIDGETS,
      ...saved.widgets,
    },
    order,
  };
};

const saveDashboardLayout = (layout) => {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
};

const formatMoney = (value) => {
  const number = Number(value || 0);
  return `${number.toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ₴`;
};

const formatNumber = (value) => Number(value || 0).toLocaleString('uk-UA');

const percentBadge = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number === 0) return null;

  const positive = number > 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(number).toFixed(0)}%
    </span>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [scannerError, setScannerError] = useState('');

  const dashCameraRef = useRef(null);
  const dashGalleryRef = useRef(null);
  const [isDashboardScanning, setIsDashboardScanning] = useState(false);

  const [layout, setLayout] = useState(loadDashboardLayout);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [draggedWidgetKey, setDraggedWidgetKey] = useState(null);
  const [dragOverWidgetKey, setDragOverWidgetKey] = useState(null);

  const activeWidgets = layout.widgets;
  const widgetOrder = layout.order;

  const loadSummary = async () => {
    setLoading(true);
    setPageError('');

    try {
      const response = await api.get('/api/dashboard/summary/');
      setSummary(response.data || {});
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login');
        return;
      }

      setPageError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Не вдалося завантажити Панель. Спробуйте ще раз.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const updateLayout = (nextLayout) => {
    setLayout(nextLayout);
    saveDashboardLayout(nextLayout);
  };

  const toggleWidget = (key) => {
    updateLayout({
      ...layout,
      widgets: {
        ...layout.widgets,
        [key]: !layout.widgets[key],
      },
    });
  };

  const reorderWidgets = (activeKey, overKey) => {
    if (!activeKey || !overKey || activeKey === overKey) return;

    const currentIndex = layout.order.indexOf(activeKey);
    const nextIndex = layout.order.indexOf(overKey);

    if (currentIndex < 0 || nextIndex < 0) return;

    const nextOrder = [...layout.order];
    const [item] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, item);

    updateLayout({
      ...layout,
      order: nextOrder,
    });
  };

  const handleWidgetDragStart = (event, key) => {
    setDraggedWidgetKey(key);
    setDragOverWidgetKey(key);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', key);
    }
  };

  const handleWidgetDragOver = (event, key) => {
    event.preventDefault();

    if (!draggedWidgetKey || draggedWidgetKey === key) return;
    setDragOverWidgetKey(key);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleWidgetDrop = (event, key) => {
    event.preventDefault();

    const activeKey = draggedWidgetKey || event.dataTransfer?.getData('text/plain');
    reorderWidgets(activeKey, key);

    setDraggedWidgetKey(null);
    setDragOverWidgetKey(null);
  };

  const handleWidgetDragEnd = () => {
    setDraggedWidgetKey(null);
    setDragOverWidgetKey(null);
  };

  const resetLayout = () => {
    const nextLayout = buildDefaultLayout();
    updateLayout(nextLayout);
  };

  const handleDashboardScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScannerError('');
    setIsDashboardScanning(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('document', blob, 'scan.jpg');

          try {
            const response = await api.post('/api/visits/recognize_document/', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.data?.success) {
              navigate('/visits', { state: { scannedData: response.data } });
            } else {
              setScannerError('Не вдалося розпізнати документ. Спробуйте чіткіше фото.');
            }
          } catch {
            setScannerError('Не вдалося розпізнати документ. Спробуйте чіткіше фото.');
          } finally {
            setIsDashboardScanning(false);
            if (dashCameraRef.current) dashCameraRef.current.value = '';
            if (dashGalleryRef.current) dashGalleryRef.current.value = '';
          }
        }, 'image/jpeg', 0.8);
      };

      img.onerror = () => {
        setScannerError('Не вдалося прочитати фото. Спробуйте інший файл.');
        setIsDashboardScanning(false);
      };
    };

    reader.onerror = () => {
      setScannerError('Не вдалося прочитати фото. Спробуйте інший файл.');
      setIsDashboardScanning(false);
    };
  };

  const businessType = summary?.business_type || summary?.company?.business_type || 'sto';
  const isStore = businessType === 'store';
  const user = summary?.user || {};
  const company = summary?.company || {};

  const periods = summary?.periods || {};
  const today = periods.today || {};
  const week = periods.last_7_days || {};
  const month = periods.month || {};
  const money = summary?.money || {};
  const orders = summary?.orders || {};
  const stock = summary?.stock || {};
  const novapost = summary?.novapost || {};
  const topProducts = summary?.top_products || [];
  const topClients = summary?.top_clients || [];
  const todayTasks = summary?.tasks?.today || [];
  const recommendations = summary?.crm?.recommendations || {};
  const attention = summary?.attention || [];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Доброго ранку';
    if (hour < 18) return 'Добрий день';
    return 'Добрий вечір';
  }, []);

  const enabledCount = Object.values(activeWidgets).filter(Boolean).length;

  const renderWidget = (key) => {
    switch (key) {
      case 'welcome':
        return activeWidgets.welcome ? (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="relative z-10">
              <p className="text-blue-200 font-bold text-sm md:text-base uppercase tracking-widest mb-1">{greeting},</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-2">
                {user.first_name || user.username || 'Користувач'}
              </h2>
              <p className="text-blue-100 font-medium text-sm md:text-base max-w-md">
                {company.name ? `${company.name} • ` : ''}
                Це ваша бізнес-панель: гроші, замовлення, склад, доставка і проблеми в одному місці.
              </p>
            </div>

            <div className="relative z-10 w-full md:w-96 shrink-0">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-600 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Швидкий пошук запчастин..."
                  className="w-full bg-white/95 focus:bg-white border-4 border-transparent focus:border-blue-300 rounded-2xl pl-12 pr-4 py-4 outline-none font-bold text-slate-800 shadow-xl transition-all placeholder:text-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ) : null;

      case 'businessKpis':
        return activeWidgets.businessKpis ? (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              icon={Wallet}
              title="Виручка сьогодні"
              value={formatMoney(today.revenue)}
              subtitle={`${formatNumber(today.orders_count)} ${isStore ? 'замовлень' : 'візитів'}`}
              tone="emerald"
              onClick={() => navigate('/analytics')}
            />
            <KpiCard
              icon={TrendingUp}
              title="Прибуток сьогодні"
              value={formatMoney(today.profit)}
              subtitle="Товари + роботи"
              tone="blue"
              onClick={() => navigate('/analytics')}
            />
            <KpiCard
              icon={AlertCircle}
              title="Борги"
              value={formatMoney(money.debt_total)}
              subtitle={`${formatNumber(money.debt_orders_count)} проблемних замовлень`}
              tone="rose"
              onClick={() => navigate('/clients?filter=debt')}
            />
            <KpiCard
              icon={ClipboardList}
              title="У роботі"
              value={formatNumber(orders.active)}
              subtitle={`Прострочено: ${formatNumber(orders.overdue)}`}
              tone="amber"
              onClick={() => navigate('/visits')}
            />
          </div>
        ) : null;

      case 'attentionCenter':
        return activeWidgets.attentionCenter ? <AttentionCenter /> : null;

      case 'quickActions':
        return activeWidgets.quickActions ? (
          <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Швидкі дії</h3>
              <span className="text-[10px] font-black uppercase text-slate-300">Старт роботи</span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <QuickAction
                icon={Plus}
                title={isStore ? 'Нове замовлення' : 'Новий запис'}
                tone="blue"
                onClick={() => navigate('/visits')}
              />
              <QuickAction
                icon={Package}
                title="Підбір деталі"
                tone="indigo"
                onClick={() => navigate('/search')}
              />
              <QuickAction
                icon={Boxes}
                title="Склад"
                tone="emerald"
                onClick={() => navigate('/inventory')}
              />
              <QuickAction
                icon={FileDown}
                title="Експорт"
                tone="slate"
                onClick={() => navigate('/data')}
              />
            </div>
          </div>
        ) : null;

      case 'financialPulse':
        return activeWidgets.financialPulse ? (
          <div onClick={() => navigate('/analytics')} className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                  <Wallet size={18} className="text-emerald-500" />
                  Фінансовий пульс
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Виручка, прибуток і середній чек</p>
              </div>
              <ArrowRight size={18} className="text-slate-300" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniMetric title="Сьогодні" value={formatMoney(today.revenue)} subtitle={`Прибуток ${formatMoney(today.profit)}`} />
              <MiniMetric title="7 днів" value={formatMoney(week.revenue)} subtitle={`Прибуток ${formatMoney(week.profit)}`} />
              <MiniMetric title="Місяць" value={formatMoney(month.revenue)} subtitle={`Сер. чек ${formatMoney(month.average_check)}`} />
            </div>
          </div>
        ) : null;

      case 'novaPostPulse':
        return activeWidgets.novaPostPulse ? (
          <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                  <Truck size={18} className="text-red-500" />
                  Нова пошта
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Контроль доставок і післяплати</p>
              </div>
              <button onClick={() => navigate('/visits?tab=delivery')} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                Доставка <ArrowRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatusMetric title="Проблем" value={novapost.problem_count} tone="rose" />
              <StatusMetric title="Повернення" value={novapost.returns_count} tone="rose" />
              <StatusMetric title="У дорозі >3 дн." value={novapost.in_transit_over_3_days_count} tone="amber" />
              <StatusMetric title="Післяплата" value={novapost.cod_waiting_count} tone="emerald" subtitle={formatMoney(novapost.cod_waiting_total)} />
            </div>
          </div>
        ) : null;

      case 'stockPulse':
        return activeWidgets.stockPulse ? (
          <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                  <Boxes size={18} className="text-indigo-500" />
                  Склад
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Залишки і товарні гроші</p>
              </div>
              <button onClick={() => navigate('/inventory')} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                Склад <ArrowRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <MiniMetric title="Низький склад" value={formatNumber(stock.low_stock_count)} subtitle="позицій" />
              <MiniMetric title="Закупка" value={formatMoney(stock.buy_value)} subtitle="на складі" />
              <MiniMetric title="Потенціал" value={formatMoney(stock.potential_profit)} subtitle="маржа" />
            </div>

            <div className="space-y-2">
              {(stock.items || []).length > 0 ? stock.items.slice(0, 4).map((item) => (
                <button key={item.id || item.title} onClick={() => navigate(item.url || '/inventory')} className="w-full text-left bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl p-3 transition-colors">
                  <p className="text-sm font-black text-slate-800 truncate">{item.title}</p>
                  <p className="text-xs font-bold text-slate-500 truncate">{item.subtitle || item.meta}</p>
                </button>
              )) : (
                <div className="bg-slate-50 rounded-2xl p-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                  Критичних залишків немає
                </div>
              )}
            </div>
          </div>
        ) : null;

      case 'topProducts':
        return activeWidgets.topProducts ? (
          <ListWidget
            icon={Package}
            title="Топ товари"
            subtitle="Найкращі позиції за місяць"
            actionLabel="Склад"
            onAction={() => navigate('/inventory')}
          >
            {topProducts.length > 0 ? topProducts.slice(0, 6).map((item, index) => (
              <div key={`${item.brand}-${item.article}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{item.brand} {item.article}</p>
                  <p className="text-xs font-bold text-slate-500 truncate">{item.name || 'Товар'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-800">{formatMoney(item.revenue)}</p>
                  <p className="text-[10px] font-bold text-emerald-600">+{formatMoney(item.profit)} • {formatNumber(item.quantity)} шт</p>
                </div>
              </div>
            )) : <EmptySmall text="Продажів товарів за місяць ще немає" />}
          </ListWidget>
        ) : null;

      case 'topClients':
        return activeWidgets.topClients ? (
          <ListWidget
            icon={Users}
            title="Топ клієнти"
            subtitle="Клієнти з найбільшою виручкою за місяць"
            actionLabel="Клієнти"
            onAction={() => navigate('/clients')}
          >
            {topClients.length > 0 ? topClients.slice(0, 6).map((item, index) => (
              <button key={`${item.phone}-${index}`} onClick={() => navigate(item.url || '/clients')} className="w-full flex items-center justify-between gap-3 rounded-2xl bg-slate-50 hover:bg-blue-50 p-3 border border-slate-100 hover:border-blue-200 transition-colors text-left">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{item.client || 'Клієнт'}</p>
                  <p className="text-xs font-bold text-slate-500 truncate">{item.phone || 'без телефону'} • {formatNumber(item.orders_count)} зам.</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-800">{formatMoney(item.revenue)}</p>
                  <p className={`text-[10px] font-bold ${Number(item.debt || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    Борг {formatMoney(item.debt)}
                  </p>
                </div>
              </button>
            )) : <EmptySmall text="Клієнтів з продажами за місяць ще немає" />}
          </ListWidget>
        ) : null;

      case 'aiScanner':
        return activeWidgets.aiScanner ? (
          <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white border border-slate-700 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            {isDashboardScanning && (
              <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
                <div className="relative w-36 h-24 border border-emerald-500 rounded-lg overflow-hidden bg-slate-900/50 mb-3">
                  <div className="laser-line"></div>
                </div>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400">ШІ розпізнає техпаспорт...</p>
              </div>
            )}

            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded mb-3 inline-block">
                ШІ-Модуль
              </span>
              <h3 className="text-base font-black uppercase italic leading-tight mb-1 flex items-center gap-2">
                <Camera size={18} className="text-emerald-400" />
                Швидкий OCR Скан
              </h3>
              <p className="text-[11px] text-slate-400 font-bold max-w-xs leading-tight">
                Завантажте техпаспорт для миттєвого заповнення картки
              </p>
            </div>

            {scannerError && (
              <div className="mt-4 rounded-2xl border border-rose-800 bg-rose-950/40 p-3 text-[11px] font-bold text-rose-100">
                {scannerError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-4 z-10">
              <button onClick={() => dashCameraRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/50">
                <Camera size={14} /> Камера
              </button>
              <button onClick={() => dashGalleryRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 text-white font-black uppercase text-[10px] tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all">
                <ImagePlus size={14} /> Галерея
              </button>
            </div>

            <input type="file" accept="image/*" capture="environment" className="hidden" ref={dashCameraRef} onChange={handleDashboardScan} />
            <input type="file" accept="image/*" className="hidden" ref={dashGalleryRef} onChange={handleDashboardScan} />
          </div>
        ) : null;

      case 'todayTasks':
        return activeWidgets.todayTasks ? (
          <div className="col-span-1 md:col-span-2 lg:row-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-500" />
                У роботі сьогодні
              </h3>
              <span className="bg-blue-100 text-blue-600 font-black px-3 py-1 rounded-lg text-xs">
                {todayTasks.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[400px]">
              {todayTasks.length > 0 ? todayTasks.map((visit) => (
                <div key={visit.id} onClick={() => navigate(visit.url || '/visits')} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-lg text-slate-800 group-hover:text-blue-600 transition-colors uppercase">
                      {visit.plate || `№${visit.id}`}
                    </span>
                    {visit.scheduled_datetime ? (
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(visit.scheduled_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-2 py-1 rounded-md text-amber-700">
                        В черзі
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5 truncate">
                    <CarFront size={14} className="text-slate-400 shrink-0" />
                    {visit.client || 'Клієнт'}
                  </p>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3 py-10">
                  <div className="bg-slate-50 p-4 rounded-full">
                    <CheckCircle2 size={32} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest">Немає активних задач на сьогодні</p>
                </div>
              )}
            </div>

            {todayTasks.length > 0 && (
              <button onClick={() => navigate('/visits')} className="w-full mt-4 bg-slate-50 text-slate-500 font-black text-[10px] uppercase py-3 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                Всі {isStore ? 'замовлення' : 'візити'} <ArrowRight size={14} />
              </button>
            )}
          </div>
        ) : null;

      case 'recommendations':
        return activeWidgets.recommendations ? (
          <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col min-h-[220px]">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                <ClipboardList size={18} className="text-indigo-500" />
                Рекомендації
              </h3>
              <button onClick={() => navigate('/crm/recommendations')} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                CRM <ArrowRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100">
                <p className="text-[9px] font-black uppercase text-blue-400">Активні</p>
                <p className="text-xl font-black text-blue-700">{formatNumber(recommendations.active)}</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100">
                <p className="text-[9px] font-black uppercase text-amber-500">Скоро</p>
                <p className="text-xl font-black text-amber-700">{formatNumber(recommendations.soon)}</p>
              </div>
              <div className="bg-rose-50 rounded-2xl p-3 border border-rose-100">
                <p className="text-[9px] font-black uppercase text-rose-500">Простр.</p>
                <p className="text-xl font-black text-rose-700">{formatNumber(recommendations.overdue)}</p>
              </div>
            </div>

            <div className="space-y-2 flex-1">
              {(recommendations.priority || []).length > 0 ? recommendations.priority.map((item) => (
                <div key={item.id} onClick={() => navigate(item.url || '/crm/recommendations')} className={`p-3 rounded-2xl border cursor-pointer transition-colors ${item.state === 'overdue' ? 'bg-rose-50 border-rose-100 hover:bg-rose-100' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}`}>
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-black text-slate-800 truncate">{item.plate || 'Без номера'}</p>
                    <span className="text-[10px] font-black uppercase text-slate-500 shrink-0">{item.state_label}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-600 truncate">{item.title}</p>
                </div>
              )) : (
                <div className="flex items-center justify-center py-6 text-slate-400 text-xs font-black uppercase tracking-wider bg-slate-50 rounded-2xl">
                  Немає термінових рекомендацій
                </div>
              )}
            </div>
          </div>
        ) : null;

      case 'alerts':
        return activeWidgets.alerts ? (
          <div className="col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col min-h-[220px]">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              Увага потребують
            </h3>

            <div className="space-y-3 flex-1">
              {attention.length > 0 ? attention.slice(0, 4).map((item) => (
                <button key={item.key} onClick={() => navigate(item.url || '/attention')} className={`w-full p-3 rounded-xl border cursor-pointer transition-colors flex justify-between items-center text-left ${item.severity === 'critical' ? 'bg-red-50 hover:bg-red-100 border-red-100' : item.severity === 'warning' ? 'bg-orange-50 hover:bg-orange-100 border-orange-100' : 'bg-blue-50 hover:bg-blue-100 border-blue-100'}`}>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-black uppercase tracking-wide mb-0.5 truncate ${item.severity === 'critical' ? 'text-red-500' : item.severity === 'warning' ? 'text-orange-600' : 'text-blue-600'}`}>
                      {item.title}
                    </p>
                    <p className={`text-sm font-black truncate ${item.severity === 'critical' ? 'text-red-700' : item.severity === 'warning' ? 'text-orange-800' : 'text-blue-800'}`}>
                      {formatNumber(item.count)} {Number(item.amount || 0) > 0 ? `• ${formatMoney(item.amount)}` : ''}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 shrink-0" />
                </button>
              )) : (
                <div className="flex flex-col items-center justify-center text-center text-slate-400 py-6">
                  <CheckCircle2 size={30} className="mb-2 text-slate-300" />
                  <p className="text-xs font-black uppercase tracking-wider">Критичних алертів немає</p>
                </div>
              )}
            </div>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen font-black italic text-blue-600">
        <Loader2 className="animate-spin mr-2" />
        ЗАВАНТАЖЕННЯ ПАНЕЛІ...
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="max-w-[900px] mx-auto p-6 min-h-screen flex items-center justify-center">
        <div className="bg-white border border-rose-100 rounded-3xl p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center">
            <AlertCircle className="text-rose-500" size={28} />
          </div>
          <h1 className="text-xl font-black text-slate-800 mb-2">Панель не завантажилась</h1>
          <p className="text-sm font-bold text-slate-500 mb-5">{pageError}</p>
          <button onClick={loadSummary} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white hover:bg-blue-700 transition-colors">
            <RefreshCw size={16} />
            Повторити
          </button>
        </div>
      </div>
    );
  }

  const visibleWidgets = widgetOrder.filter((key) => activeWidgets[key]);

  return (
    <div className="max-w-[1600px] mx-auto p-3 md:p-8 min-h-screen flex flex-col w-full overflow-x-hidden pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-4 md:mt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800 flex items-center gap-2">
            <LayoutGrid className="text-blue-600" />
            Панель
          </h1>
          <p className="text-xs md:text-sm font-bold text-slate-400 mt-1">
            Бізнес-огляд: {isStore ? 'магазин автозапчастин' : 'СТО'} • {enabledCount} активних віджетів
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadSummary}
            className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 p-2 md:px-4 md:py-2.5 rounded-xl font-black uppercase text-[10px] md:text-xs flex items-center gap-2 transition-all shadow-sm"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Оновити</span>
          </button>

          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 p-2 md:px-4 md:py-2.5 rounded-xl font-black uppercase text-[10px] md:text-xs flex items-center gap-2 transition-all shadow-sm"
          >
            <Settings2 size={16} />
            <span className="hidden sm:inline">Налаштувати віджети</span>
          </button>
        </div>
      </div>

      {visibleWidgets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center">
            <EyeOff className="text-slate-300" size={30} />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Усі віджети приховані</h2>
          <p className="text-sm font-bold text-slate-500 mb-5">Увімкніть потрібні блоки в налаштуваннях Панелі.</p>
          <button onClick={resetLayout} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white hover:bg-blue-700 transition-colors">
            <RotateCcw size={16} />
            Скинути налаштування
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-min">
          {widgetOrder.map((key) => (
            <React.Fragment key={key}>
              {renderWidget(key)}
            </React.Fragment>
          ))}
        </div>
      )}

      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-hidden flex flex-col">
            <button
              onClick={() => setIsConfigModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="pr-10 mb-5">
              <h2 className="text-lg font-black uppercase flex items-center gap-2 text-slate-800">
                <Settings2 size={20} className="text-blue-500" />
                Налаштування Панелі
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Виберіть, що показувати, і перетягніть блоки мишею в потрібному порядку.
              </p>
            </div>

            <div className="overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {layout.order.map((key, index) => {
                const meta = WIDGET_META[key];
                if (!meta) return null;

                const Icon = meta.icon || LayoutGrid;
                const enabled = Boolean(layout.widgets[key]);

                const isDragging = draggedWidgetKey === key;
                const isDragTarget = dragOverWidgetKey === key && draggedWidgetKey !== key;

                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(event) => handleWidgetDragStart(event, key)}
                    onDragOver={(event) => handleWidgetDragOver(event, key)}
                    onDragEnter={(event) => handleWidgetDragOver(event, key)}
                    onDrop={(event) => handleWidgetDrop(event, key)}
                    onDragEnd={handleWidgetDragEnd}
                    className={`rounded-2xl border p-4 transition-all select-none cursor-grab active:cursor-grabbing ${
                      enabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 opacity-70'
                    } ${
                      isDragging ? 'opacity-50 scale-[0.98] shadow-lg' : ''
                    } ${
                      isDragTarget ? 'border-blue-400 bg-blue-50/80 shadow-md translate-y-0.5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-8 rounded-xl flex items-center justify-center shrink-0 text-slate-300 hover:text-blue-500 transition-colors" title="Затисніть і перетягніть">
                        <span className="text-2xl leading-none font-black tracking-[-6px] pr-1">⋮⋮</span>
                      </div>

                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${enabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'}`}>
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-800 truncate">{meta.label}</p>
                        <p className="text-xs font-bold text-slate-400 truncate">{meta.description}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleWidget(key);
                          }}
                          onDragStart={(event) => event.preventDefault()}
                          className={`h-9 px-3 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 ${enabled ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'}`}
                        >
                          {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                          {enabled ? 'Показано' : 'Сховано'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-5 border-t border-slate-100">
              <button
                onClick={resetLayout}
                className="sm:w-auto w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-5 rounded-xl font-black uppercase transition-all tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                Скинути
              </button>

              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-lg shadow-blue-200 transition-all tracking-widest text-xs"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ icon: Icon, title, value, subtitle, tone = 'blue', onClick }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  return (
    <button onClick={onClick} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-left hover:shadow-md hover:border-blue-200 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${tones[tone] || tones.blue}`}>
          <Icon size={21} />
        </div>
        <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
      <p className="text-2xl md:text-3xl font-black text-slate-800 leading-none mb-2">{value}</p>
      <p className="text-xs font-bold text-slate-500">{subtitle}</p>
    </button>
  );
};

const QuickAction = ({ icon: Icon, title, tone = 'blue', onClick }) => {
  const iconColors = {
    blue: 'text-blue-500',
    indigo: 'text-indigo-500',
    emerald: 'text-emerald-500',
    slate: 'text-slate-500',
  };

  const hoverColors = {
    blue: 'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700',
    indigo: 'hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700',
    emerald: 'hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700',
    slate: 'hover:bg-slate-100 hover:border-slate-200 hover:text-slate-800',
  };

  return (
    <button onClick={onClick} className={`bg-slate-50 border border-slate-100 text-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group ${hoverColors[tone] || hoverColors.blue}`}>
      <div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
        <Icon size={24} className={iconColors[tone] || iconColors.blue} />
      </div>
      <span className="font-bold text-xs md:text-sm uppercase text-center">{title}</span>
    </button>
  );
};

const MiniMetric = ({ title, value, subtitle }) => (
  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{title}</p>
    <p className="text-lg font-black text-slate-800 leading-tight truncate">{value}</p>
    {subtitle && <p className="text-[10px] font-bold text-slate-500 truncate mt-1">{subtitle}</p>}
  </div>
);

const StatusMetric = ({ title, value, tone = 'blue', subtitle }) => {
  const tones = {
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
  };

  return (
    <div className={`rounded-2xl p-3 border ${tones[tone] || tones.blue}`}>
      <p className="text-[9px] font-black uppercase opacity-70 tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-black leading-none">{formatNumber(value)}</p>
      {subtitle && <p className="text-[10px] font-bold mt-1 opacity-80">{subtitle}</p>}
    </div>
  );
};

const ListWidget = ({ icon: Icon, title, subtitle, actionLabel, onAction, children }) => (
  <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
    <div className="flex items-start justify-between mb-5">
      <div>
        <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
          <Icon size={18} className="text-blue-500" />
          {title}
        </h3>
        <p className="text-xs font-bold text-slate-400 mt-1">{subtitle}</p>
      </div>

      {actionLabel && (
        <button onClick={onAction} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
          {actionLabel} <ArrowRight size={13} />
        </button>
      )}
    </div>

    <div className="space-y-2">
      {children}
    </div>
  </div>
);

const EmptySmall = ({ text }) => (
  <div className="flex items-center justify-center py-8 text-slate-400 text-xs font-black uppercase tracking-wider bg-slate-50 rounded-2xl">
    {text}
  </div>
);

export default Dashboard;
