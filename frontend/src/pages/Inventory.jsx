import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  History,
  KeyRound,
  Package,
  PackageOpen,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  Download,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AppPage,
  Button,
  Card,
  EmptyState,
  Input as UiInput,
  Modal as UiModal,
  PageHeader,
  Select as UiSelect,
  useToast,
} from '../components/ui';
import api from '../api/axios';

const emptyReceipt = {
  brand: '',
  article: '',
  name: '',
  quantity: 1,
  min_quantity: 0,
  buy_price: '',
  sell_price: '',
  supplier: '',
  supplier_name: '',
  category: '',
  note: '',
  order_part_id: '',
};

const emptyPriceRow = {
  brand: '',
  article: '',
  name: '',
  quantity: 1,
  buy_price: '',
  category: '',
  note: '',
};

const SUPPLIER_TYPES = [
  { value: 'custom', label: 'Інший / вручну', auth: 'none', defaultName: '' },
  { value: 'vesna', label: 'Vesna-auto', auth: 'key', defaultName: 'Vesna-auto' },
  { value: 'omega', label: 'Omega', auth: 'key', defaultName: 'Omega' },
  { value: 'tehnomir', label: 'Техномир', auth: 'key', defaultName: 'Техномир' },
  { value: 'bm', label: 'BM Parts', auth: 'key', defaultName: 'BM Parts' },
  { value: 'utr', label: 'Юнік Трейд', auth: 'login', defaultName: 'Юнік Трейд' },
];

const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const list = (data) => (Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []));
const num = (value) => Number(String(value || 0).replace(',', '.')) || 0;
const mask = (value) => {
  const text = String(value || '');
  if (!text) return 'ключ не додано';
  return text.length > 8 ? `${text.slice(0, 4)}••••••${text.slice(-4)}` : '••••••';
};

const supplierType = (value) => SUPPLIER_TYPES.find((item) => item.value === value) || SUPPLIER_TYPES[0];
const supplierTypeLabel = (value) => supplierType(value).label;
const supplierNeedsApiKey = (value) => supplierType(value).auth === 'key';
const supplierNeedsLogin = (value) => supplierType(value).auth === 'login';
const newSupplierForm = () => ({
  id: '',
  name: '',
  api_type: 'custom',
  api_key: '',
  api_login: '',
  api_password: '',
  browser_fingerprint: '',
  is_active: true,
  price_file: null,
  current: '',
  current_login: '',
  current_password_set: false,
  current_key_set: false,
});

const inferSupplierType = (supplier = {}) => {
  const explicit = supplier.api_type;
  const name = String(supplier.name || '').toLowerCase();
  if (explicit && explicit !== 'custom') return explicit;
  if (name.includes('vesna') || name.includes('весна')) return 'vesna';
  if (name.includes('omega') || name.includes('омега')) return 'omega';
  if (name.includes('tehno') || name.includes('техно')) return 'tehnomir';
  if (name.includes('bm')) return 'bm';
  if (name.includes('utr') || name.includes('uniq') || name.includes('юнік') || name.includes('юник') || name.includes('унік')) return 'utr';
  return 'custom';
};

const movementLabel = (movement = {}) => movement.movement_label || ({
  receipt: 'Прихід',
  reserve: 'Резерв',
  release: 'Зняття резерву',
  write_off: 'Списання',
  adjustment: 'Коригування',
}[movement.movement_type] || 'Рух');

const qtyDisplay = (movement = {}) => movement.quantity_display || `${Number(movement.quantity || 0) > 0 ? '+' : ''}${movement.quantity || 0}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const excelCell = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const availableQty = (item = {}) => Number(item.available_quantity ?? Math.max(Number(item.quantity || 0) - Number(item.reserved_quantity || 0), 0));
const needsRestock = (item = {}) => item.needs_restock || availableQty(item) <= Number(item.min_quantity || 0);
const priceListPrice = (basePrice, markupPercent) => {
  const base = num(basePrice);
  const markup = num(markupPercent);
  if (!base) return 0;
  return Math.round((base + (base * markup / 100)) * 100) / 100;
};

export default function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [tab, setTab] = useState('stock');
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [cat, setCat] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [newCat, setNewCat] = useState('');
  const [supplierForm, setSupplierForm] = useState(newSupplierForm());
  const [receipt, setReceipt] = useState({ ...emptyReceipt });
  const [priceDraft, setPriceDraft] = useState({ ...emptyPriceRow });
  const [priceRows, setPriceRows] = useState([]);
  const [priceMarkupPercent, setPriceMarkupPercent] = useState(() => localStorage.getItem('vinmatrix_price_markup_percent') || '10');

  const load = async () => {
    setLoading(true);
    try {
      const [categoriesRes, inventoryRes, suppliersRes, movementsRes] = await Promise.all([
        api.get('/api/categories/').catch((error) => ({ error, data: [] })),
        api.get('/api/inventory/').catch((error) => ({ error, data: [] })),
        api.get('/api/suppliers/').catch((error) => ({ error, data: [] })),
        api.get('/api/stock-movements/').catch(() => ({ data: [] })),
      ]);

      if (categoriesRes.error?.response?.status === 401 || inventoryRes.error?.response?.status === 401 || suppliersRes.error?.response?.status === 401) {
        navigate('/login');
        return;
      }

      setCategories(list(categoriesRes.data));
      setItems(list(inventoryRes.data));
      setSuppliers(list(suppliersRes.data));
      setMovements(list(movementsRes.data));

      if (categoriesRes.error || inventoryRes.error || suppliersRes.error) {
        setMessage('Частину складу не вдалося завантажити. Перевірте backend або права доступу.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem('vinmatrix_price_markup_percent', String(priceMarkupPercent || '0')); }, [priceMarkupPercent]);

  useEffect(() => {
    const draft = location.state?.receiptDraft;
    if (!draft) return;

    setTab('receipts');
    setReceipt({
      ...emptyReceipt,
      brand: draft.brand || '',
      article: draft.article || '',
      name: draft.name || '',
      quantity: draft.quantity || 1,
      buy_price: draft.buy_price || '',
      sell_price: draft.sell_price || draft.price || '',
      supplier_name: draft.supplier || '',
      order_part_id: draft.id || '',
      note: draft.visit_id ? `З замовлення постачальнику, візит №${draft.visit_id}` : '',
    });
    setModal('receipt');
    window.history.replaceState({}, document.title);
  }, [location.state]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesCategory = !cat || String(item.category || '') === String(cat);
      const text = [item.brand, item.article, item.name, item.category_name, item.supplier_name].filter(Boolean).join(' ').toLowerCase();
      return matchesCategory && (!query || text.includes(query));
    });
  }, [items, cat, search]);

  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + Number(item.buy_price || 0) * Number(item.quantity || 0), 0);
    const reserved = items.reduce((sum, item) => sum + Number(item.reserved_quantity || 0), 0);
    const available = items.reduce((sum, item) => sum + availableQty(item), 0);
    const restock = items.filter(needsRestock).length;
    return { totalValue, reserved, available, restock };
  }, [items]);

  const addCategory = async (event) => {
    event.preventDefault();
    const name = newCat.trim();
    if (!name) return toast.warning('Вкажіть назву категорії.');
    setBusy(true);
    try {
      await api.post('/api/categories/', { name });
      setNewCat('');
      setModal(null);
      toast.success('Категорію додано.');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося додати категорію.');
    } finally {
      setBusy(false);
    }
  };

  const delCategory = (id) => {
    setConfirmState({
      title: 'Видалити категорію?',
      text: 'Категорія зникне зі списку. Якщо вона вже використовується у товарах, backend може заборонити видалення.',
      actionLabel: 'Видалити',
      onConfirm: async () => {
        await api.delete(`/api/categories/${id}/`);
        if (String(cat) === String(id)) setCat('');
        toast.success('Категорію видалено.');
        await load();
      },
    });
  };

  const delItem = (item) => {
    setConfirmState({
      title: 'Видалити товар?',
      text: `${item.brand || ''} ${item.article || ''} буде видалено зі складу.`,
      actionLabel: 'Видалити товар',
      onConfirm: async () => {
        await api.delete(`/api/inventory/${item.id}/`);
        toast.success('Товар видалено.');
        await load();
      },
    });
  };

  const delSupplier = (supplier) => {
    setConfirmState({
      title: 'Видалити постачальника?',
      text: `${supplier.name || 'Постачальник'} буде видалений зі списку підключень.`,
      actionLabel: 'Видалити постачальника',
      onConfirm: async () => {
        await api.delete(`/api/suppliers/${supplier.id}/`);
        toast.success('Постачальника видалено.');
        await load();
      },
    });
  };

  const openSupplier = (supplier = null) => {
    const apiType = inferSupplierType(supplier || {});
    setSupplierForm({
      ...newSupplierForm(),
      id: supplier?.id || '',
      name: supplier?.name || supplierType(apiType).defaultName || '',
      api_type: apiType,
      api_login: supplier?.api_login || '',
      browser_fingerprint: supplier?.browser_fingerprint || '',
      is_active: supplier?.is_active !== false,
      current: supplier?.api_key_masked || mask(supplier?.api_key || ''),
      current_login: supplier?.api_login || '',
      current_password_set: Boolean(supplier?.api_password_set),
      current_key_set: Boolean(supplier?.api_key_set),
    });
    setModal('supplier');
  };

  const saveSupplier = async (event) => {
    event.preventDefault();
    if (!supplierForm.name.trim()) return toast.warning('Вкажіть назву постачальника.');

    const formData = new FormData();
    formData.append('name', supplierForm.name.trim());
    formData.append('api_type', supplierForm.api_type || 'custom');
    formData.append('is_active', supplierForm.is_active ? 'true' : 'false');

    if (supplierNeedsApiKey(supplierForm.api_type) && supplierForm.api_key) {
      formData.append('api_key', supplierForm.api_key);
    }

    if (supplierNeedsLogin(supplierForm.api_type)) {
      formData.append('api_login', supplierForm.api_login || '');
      if (supplierForm.api_password) formData.append('api_password', supplierForm.api_password);
      if (supplierForm.browser_fingerprint) formData.append('browser_fingerprint', supplierForm.browser_fingerprint);
    }


    setBusy(true);
    try {
      if (supplierForm.id) await api.patch(`/api/suppliers/${supplierForm.id}/`, formData);
      else await api.post('/api/suppliers/', formData);
      setModal(null);
      setSupplierForm(newSupplierForm());
      toast.success('Постачальника збережено.');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося зберегти постачальника.');
    } finally {
      setBusy(false);
    }
  };

  const checkSupplier = () => {
    if (supplierNeedsLogin(supplierForm.api_type)) {
      const hasLogin = Boolean(supplierForm.api_login || supplierForm.current_login);
      const hasPassword = Boolean(supplierForm.api_password || supplierForm.current_password_set);
      setMessage(hasLogin && hasPassword
        ? 'Юнік Трейд: логін і пароль додані. Backend отримає token під час пошуку.'
        : 'Для Юнік Трейд потрібно вказати логін і пароль.');
      return;
    }

    if (supplierNeedsApiKey(supplierForm.api_type)) {
      setMessage((!supplierForm.current_key_set && !supplierForm.current && !supplierForm.api_key)
        ? 'Спочатку додайте API ключ / token.'
        : 'Ключ присутній. Повний ключ не показується; для заміни вставте новий і збережіть.');
      return;
    }

    setMessage('Для цього типу постачальника дані доступу не потрібні: працюйте вручну через прихід або прайс-експорт.');
  };

  const receive = async (event) => {
    event.preventDefault();
    if (!receipt.brand.trim() || !receipt.article.trim() || !receipt.name.trim()) {
      return toast.warning('Заповніть бренд, артикул і назву товару.');
    }

    setBusy(true);
    try {
      await api.post('/api/stock/receive/', receipt);
      setReceipt({ ...emptyReceipt });
      setModal(null);
      toast.success('Прихід збережено.');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося провести прихід.');
    } finally {
      setBusy(false);
    }
  };

  const addPriceRow = (event) => {
    event.preventDefault();
    const basePrice = num(priceDraft.buy_price);
    const row = {
      ...priceDraft,
      brand: priceDraft.brand.trim().toUpperCase(),
      article: priceDraft.article.trim().toUpperCase(),
      name: priceDraft.name.trim(),
      category: priceDraft.category.trim(),
      note: priceDraft.note.trim(),
      quantity: num(priceDraft.quantity) || 1,
      buy_price: basePrice,
      markup_percent: num(priceMarkupPercent),
      price: priceListPrice(basePrice, priceMarkupPercent),
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };

    if (!row.article || !row.name) return toast.warning('Вкажіть артикул і назву товару для прайсу.');
    if (!row.buy_price) return toast.warning('Вкажіть закупку / базову ціну. Ціна прайсу рахується від неї.');

    setPriceRows((prev) => [row, ...prev]);
    setPriceDraft({ ...emptyPriceRow });
    toast.success('Товар додано у прайс.');
  };

  const addItemToPrice = (item) => {
    const basePrice = num(item.buy_price || item.sell_price || 0);
    const row = {
      id: `${Date.now()}-${item.id || Math.random().toString(16).slice(2)}`,
      brand: item.brand || '',
      article: item.article || '',
      name: item.name || '',
      quantity: availableQty(item) || item.quantity || 1,
      buy_price: basePrice,
      markup_percent: num(priceMarkupPercent),
      price: priceListPrice(basePrice, priceMarkupPercent),
      category: item.category_name || '',
      note: '',
    };
    setPriceRows((prev) => [row, ...prev]);
    setTab('price');
    toast.success('Товар додано у прайс.');
  };

  const removePriceRow = (id) => setPriceRows((prev) => prev.filter((row) => row.id !== id));

  const clearPriceRows = () => {
    if (!priceRows.length) return;
    setConfirmState({
      title: 'Очистити прайс?',
      text: 'Усі підготовлені позиції для Excel-прайсу буде прибрано зі списку. Склад при цьому не зміниться.',
      actionLabel: 'Очистити',
      onConfirm: async () => {
        setPriceRows([]);
        toast.success('Прайс очищено.');
      },
    });
  };

  const downloadPriceExcel = () => {
    if (!priceRows.length) return toast.warning('Додайте товари у прайс перед завантаженням.');

    const headers = ['Бренд', 'Артикул', 'Назва товару', 'Кількість', 'Ціна прайсу', 'Категорія', 'Примітка'];
    const rowsHtml = priceRows.map((row) => `
      <tr>
        <td>${excelCell(row.brand)}</td>
        <td style="mso-number-format:'\@';">${excelCell(row.article)}</td>
        <td>${excelCell(row.name)}</td>
        <td>${excelCell(row.quantity)}</td>
        <td>${excelCell(row.price)}</td>
        <td>${excelCell(row.category)}</td>
        <td>${excelCell(row.note)}</td>
      </tr>`).join('');

    const html = `<!doctype html>
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table border="1">
            <thead><tr>${headers.map((header) => `<th>${excelCell(header)}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `price-list-${todayISO()}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Excel-прайс завантажено.');
  };

  return (
    <AppPage>
      <PageHeader
        icon={<Package />}
        title="Склад"
        subtitle="Залишки, резерв, доступно, прихід, прайс товарів, постачальники і журнал руху."
        actions={(
          <>
            <Button variant="secondary" onClick={() => setTab('price')} icon={<FileSpreadsheet size={16} />}>Прайс Excel</Button>
            <Button onClick={() => setModal('receipt')} icon={<Plus size={16} />}>Новий прихід</Button>
          </>
        )}
      />

      <TabBar tab={tab} setTab={setTab} />
      {message && <Notice text={message} onClose={() => setMessage('')} />}

      {tab === 'stock' && (
        <Stock
          items={filtered}
          all={items}
          categories={categories}
          cat={cat}
          setCat={setCat}
          search={search}
          setSearch={setSearch}
          stats={stats}
          loading={loading}
          onAddCat={() => setModal('category')}
          onDelCat={delCategory}
          onDelItem={delItem}
          onReceipt={() => setModal('receipt')}
          onAddToPrice={addItemToPrice}
        />
      )}

      {tab === 'receipts' && (
        <Panel>
          <SectionHeader
            title="Прихід товару"
            subtitle="Додавайте товар вручну або з підготовленого замовлення постачальнику."
            actions={<button type="button" onClick={() => setModal('receipt')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"><Plus size={15} /> Новий прихід</button>}
          />
          <ReceiptForm receipt={receipt} setReceipt={setReceipt} suppliers={suppliers} categories={categories} onSubmit={receive} busy={busy} />
        </Panel>
      )}

      {tab === 'price' && (
        <PriceBuilder
          draft={priceDraft}
          setDraft={setPriceDraft}
          rows={priceRows}
          markup={priceMarkupPercent}
          setMarkup={setPriceMarkupPercent}
          onAdd={addPriceRow}
          onRemove={removePriceRow}
          onClear={clearPriceRows}
          onDownload={downloadPriceExcel}
        />
      )}

      {tab === 'history' && (
        <Panel>
          <SectionHeader title="Журнал руху товару" subtitle="Прихід, резерв, списання і коригування залишків." />
          <MovementTable movements={movements} />
        </Panel>
      )}

      {tab === 'suppliers' && (
        <Panel>
          <SectionHeader
            title="Постачальники"
            subtitle="API-ключі, Юнік Трейд login/password і ручні постачальники. Повні ключі не показуємо."
            actions={<button type="button" onClick={() => openSupplier()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"><Plus size={15} /> Додати постачальника</button>}
          />
          <SupplierGrid suppliers={suppliers} onOpen={openSupplier} onDelete={delSupplier} />
        </Panel>
      )}

      {modal === 'category' && (
        <Modal title="Нова категорія" onClose={() => setModal(null)}>
          <form onSubmit={addCategory} className="space-y-4">
            <Input required placeholder="Назва категорії" value={newCat} onChange={setNewCat} />
            <Button type="submit" loading={busy} className="w-full">Зберегти категорію</Button>
          </form>
        </Modal>
      )}

      {modal === 'receipt' && (
        <Modal title="Новий прихід" onClose={() => setModal(null)} wide>
          <ReceiptForm receipt={receipt} setReceipt={setReceipt} suppliers={suppliers} categories={categories} onSubmit={receive} busy={busy} />
        </Modal>
      )}

      {modal === 'supplier' && (
        <Modal title={supplierForm.id ? 'Редагувати постачальника' : 'Новий постачальник'} onClose={() => setModal(null)} wide>
          <SupplierForm
            form={supplierForm}
            setForm={setSupplierForm}
            onSubmit={saveSupplier}
            onCheck={checkSupplier}
            busy={busy}
          />
        </Modal>
      )}

      {confirmState && (
        <ConfirmModal
          state={confirmState}
          onClose={() => setConfirmState(null)}
          onDone={() => setConfirmState(null)}
        />
      )}
    </AppPage>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [
    ['stock', <Package size={16} />, 'Товари'],
    ['receipts', <ClipboardList size={16} />, 'Прихід'],
    ['price', <FileSpreadsheet size={16} />, 'Прайс Excel'],
    ['history', <History size={16} />, 'Журнал'],
    ['suppliers', <Truck size={16} />, 'Постачальники'],
  ];

  return (
    <div className="mb-5 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2">
        {tabs.map(([key, icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-3 text-xs font-black uppercase transition ${tab === key ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {icon}{label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stock({ items, all, categories, cat, setCat, search, setSearch, stats, loading, onAddCat, onDelCat, onDelItem, onReceipt, onAddToPrice }) {
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={<PackageOpen size={17} />} label="Товарів" value={all.length} />
        <Stat icon={<ShieldCheck size={17} />} label="На суму" value={money(stats.totalValue)} />
        <Stat icon={<Package size={17} />} label="У резерві" value={`${stats.reserved} шт`} />
        <Stat icon={<CheckCircle2 size={17} />} label="Доступно" value={`${stats.available} шт`} />
        <Stat icon={<AlertTriangle size={17} />} label="Докупити" value={stats.restock} danger={stats.restock > 0} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-slate-500"><Tag size={15} /> Категорії</h3>
            <button type="button" onClick={onAddCat} className="rounded-xl bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"><Plus size={15} /></button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col [&::-webkit-scrollbar]:hidden">
            <Category active={!cat} onClick={() => setCat('')} label="Усі товари" />
            {categories.map((category) => (
              <div key={category.id} className="flex shrink-0 items-center gap-1 lg:shrink">
                <Category active={String(cat) === String(category.id)} onClick={() => setCat(category.id)} label={category.name} />
                <button type="button" onClick={() => onDelCat(category.id)} className="rounded-xl p-2 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </aside>

        <Panel>
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Пошук по артикулу, бренду, назві, постачальнику..."
                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <button type="button" onClick={onReceipt} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"><Plus size={15} /> Прихід</button>
          </div>

          <div className="space-y-3">
            {loading ? <Empty text="Завантаження складу..." /> : items.map((item) => <Item key={item.id} item={item} onDelete={() => onDelItem(item)} onAddToPrice={() => onAddToPrice(item)} />)}
            {!loading && !items.length && <Empty text="Товарів не знайдено" />}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Item({ item, onDelete, onAddToPrice }) {
  const onStock = Number(item.quantity || 0);
  const reserved = Number(item.reserved_quantity || 0);
  const available = availableQty(item);
  const min = Number(item.min_quantity || 0);
  const restock = needsRestock(item);

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${restock ? 'border-amber-100 bg-amber-50/70' : 'border-slate-100 bg-slate-50/70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-lg font-black text-slate-900">{item.article || 'Без артикула'}</p>
          <p className="text-[10px] font-black uppercase tracking-wide text-blue-600">{item.brand || 'Без бренду'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onAddToPrice} className="rounded-xl bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100" title="Додати у прайс"><FileSpreadsheet size={16} /></button>
          <button type="button" onClick={onDelete} className="rounded-xl p-2 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
        </div>
      </div>

      <p className="mt-2 text-sm font-bold text-slate-700">{item.name || 'Товар без назви'}</p>
      <p className="text-[10px] font-bold uppercase text-slate-400">{item.category_name || 'Без категорії'} {item.supplier_name ? `· ${item.supplier_name}` : ''}</p>
      {restock && <p className="mt-2 inline-flex rounded-xl bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-700">Потрібно докупити</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Small label="На складі" value={`${onStock} шт`} strong />
        <Small label="У резерві" value={`${reserved} шт`} warn={reserved > 0} />
        <Small label="Доступно" value={`${available} шт`} good={available > 0} />
        <Small label="Мінімум" value={`${min} шт`} />
        <Small label="Закупка" value={money(item.buy_price)} />
        <Small label="Продаж" value={money(item.sell_price)} />
      </div>
    </div>
  );
}


function PriceBuilder({ draft, setDraft, rows, markup, setMarkup, onAdd, onRemove, onClear, onDownload }) {
  const total = rows.reduce((sum, row) => sum + (num(row.price) * (num(row.quantity) || 1)), 0);
  const draftPrice = priceListPrice(draft.buy_price, markup);

  return (
    <div className="space-y-5">
      <Card padding="lg" className="overflow-hidden border-blue-100 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-200">Excel-прайс товарів</p>
            <h2 className="mt-2 text-2xl font-black uppercase md:text-3xl">Зібрати прайс вручну</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-300">
              Додавайте позиції руками або кнопкою “у прайс” зі складу. Ціна прайсу рахується від закупки з окремою націнкою для оптового/партнерського прайсу.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
              <p className="text-[10px] font-black uppercase text-blue-200">Позицій</p>
              <p className="mt-1 text-2xl font-black">{rows.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
              <p className="text-[10px] font-black uppercase text-blue-200">Сума прайсу</p>
              <p className="mt-1 text-2xl font-black">{money(total)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md" className="border-emerald-100 bg-emerald-50/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Окрема націнка прайсу</p>
            <p className="mt-1 text-sm font-bold text-emerald-900">Це не ціна для кінцевого клієнта. Це ціна для Excel-прайсу, коли магазин хоче продавати товар як маленький постачальник.</p>
          </div>
          <label className="block md:w-[220px]">
            <span className="mb-1 block text-xs font-black uppercase text-emerald-700">Націнка, %</span>
            <input
              type="number"
              step="0.01"
              value={markup}
              onChange={(event) => setMarkup(event.target.value)}
              className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-900 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <Panel>
          <SectionHeader title="Додати позицію" subtitle="Це не змінює склад. Це тільки рядок для Excel-прайсу." />
          <form onSubmit={onAdd} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
              <Input label="Бренд" value={draft.brand} onChange={(value) => setDraft((prev) => ({ ...prev, brand: value.toUpperCase() }))} placeholder="ZILBERMANN" />
              <Input required label="Артикул" value={draft.article} onChange={(value) => setDraft((prev) => ({ ...prev, article: value.toUpperCase() }))} placeholder="08-214" />
              <Input required label="Назва товару" value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} placeholder="Диск гальмівний задній" />
              <Input type="number" min="1" label="Кількість" value={draft.quantity} onChange={(value) => setDraft((prev) => ({ ...prev, quantity: value }))} />
              <Input required type="number" step="0.01" label="Закупка / база" value={draft.buy_price} onChange={(value) => setDraft((prev) => ({ ...prev, buy_price: value }))} placeholder="160" />
              <Input type="number" step="0.01" label="Націнка прайсу, %" value={markup} onChange={(value) => setMarkup(value)} placeholder="10" />
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase text-emerald-600">Ціна прайсу</p>
                <p className="mt-1 text-2xl font-black text-emerald-700">{money(draftPrice)}</p>
                <p className="mt-1 text-xs font-bold text-emerald-700/80">Рахується окремо від клієнтської ціни продажу.</p>
              </div>
              <Input label="Категорія" value={draft.category} onChange={(value) => setDraft((prev) => ({ ...prev, category: value }))} placeholder="Гальма" />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase text-slate-400">Примітка</span>
              <textarea
                value={draft.note || ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
                placeholder="Додаткова інформація для прайсу"
              />
            </label>
            <Button type="submit" className="w-full" icon={<Plus size={16} />}>Додати у прайс</Button>
          </form>
        </Panel>

        <Panel>
          <SectionHeader
            title="Готовий прайс"
            subtitle="Перевірте позиції перед завантаженням Excel-файлу."
            actions={(
              <>
                <button type="button" onClick={onClear} disabled={!rows.length} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"><Trash2 size={15} /> Очистити</button>
                <button type="button" onClick={onDownload} disabled={!rows.length} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-40"><Download size={15} /> Скачать Excel</button>
              </>
            )}
          />
          <PriceRows rows={rows} onRemove={onRemove} />
        </Panel>
      </div>
    </div>
  );
}

function PriceRows({ rows, onRemove }) {
  if (!rows.length) return <Empty text="Додайте товари у прайс вручну або зі складу" />;

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-lg font-black text-slate-900">{row.article || 'Без артикула'}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-blue-600">{row.brand || 'Без бренду'}</p>
            </div>
            <button type="button" onClick={() => onRemove(row.id)} className="rounded-xl p-2 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-700">{row.name || 'Товар без назви'}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Small label="К-сть" value={`${row.quantity || 1} шт`} strong />
            <Small label="База" value={money(row.buy_price)} />
            <Small label="Націнка" value={`${row.markup_percent || 0}%`} />
            <Small label="Ціна прайсу" value={money(row.price)} good />
            <Small label="Категорія" value={row.category || '—'} />
          </div>
          {row.note && <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-500">{row.note}</p>}
        </div>
      ))}
    </div>
  );
}

function SupplierGrid({ suppliers, onOpen, onDelete }) {
  if (!suppliers.length) return <Empty text="Постачальників ще немає" />;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {suppliers.map((supplier) => <Supplier key={supplier.id} supplier={supplier} onOpen={() => onOpen(supplier)} onDelete={() => onDelete(supplier)} />)}
    </div>
  );
}

function Supplier({ supplier, onOpen, onDelete }) {
  const type = inferSupplierType(supplier);
  const loginBased = supplierNeedsLogin(type);
  const keyBased = supplierNeedsApiKey(type);
  const connected = loginBased ? (supplier.api_login && supplier.api_password_set) : (keyBased ? supplier.api_key_set : true);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-3xl border p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 ${supplier.is_active === false ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-black text-slate-900">{supplier.name}</h3>
          <p className="mt-2 text-xs font-bold text-slate-400">{supplierTypeLabel(type)} · {connected ? 'підключено' : 'потрібні дані доступу'}</p>
        </div>
        <span className={`rounded-2xl border px-3 py-1 text-[10px] font-black uppercase ${connected ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
          {connected ? 'OK' : 'Налаштувати'}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
        <KeyRound size={15} className={type === 'utr' ? 'text-orange-500' : 'text-blue-600'} />
        <span className="min-w-0 truncate text-xs font-black text-slate-700">
          {loginBased
            ? `${supplier.api_login || 'логін не додано'} · ${supplier.api_password_set ? 'пароль додано' : 'пароль не додано'}`
            : (keyBased ? (supplier.api_key_masked || 'ключ не додано') : 'ручний постачальник')}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className={`text-[10px] font-black uppercase ${type === 'utr' ? 'text-orange-600' : 'text-blue-600'}`}>Налаштувати підключення</p>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onDelete(); } }}
          className="rounded-xl p-2 text-slate-300 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={16} />
        </span>
      </div>
    </button>
  );
}

function SupplierForm({ form, setForm, onSubmit, onCheck, busy }) {
  const type = supplierType(form.api_type);
  const needsKey = supplierNeedsApiKey(form.api_type);
  const needsLogin = supplierNeedsLogin(form.api_type);

  const changeType = (apiType) => {
    setForm((prev) => ({
      ...prev,
      api_type: apiType,
      name: prev.name || supplierType(apiType).defaultName || '',
      api_key: '',
      api_login: apiType === 'utr' ? (prev.api_login || prev.current_login || '') : prev.api_login,
      api_password: '',
      browser_fingerprint: apiType === 'utr' ? prev.browser_fingerprint : '',
    }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input required label="Назва постачальника" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
        <Select label="Тип постачальника" value={form.api_type} onChange={changeType}>
          {SUPPLIER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-blue-700">{type.label}</p>
        <p className="mt-1 text-sm font-semibold text-blue-700">
          {needsLogin ? 'Для Юнік Трейд зберігаємо login/password. Token отримує backend під час пошуку.' : needsKey ? 'Для цього постачальника потрібен API ключ або token.' : 'Ручний постачальник: працює через прихід товару і прайс-експорт.'}
        </p>
      </div>

      {needsKey && (
        <div className="space-y-3">
          <StatusPill icon={<KeyRound size={15} />} label="Поточний ключ" value={form.current_key_set || form.current ? (form.current || 'ключ збережено') : 'ключ не додано'} ok={form.current_key_set || form.current} />
          <Input
            label="Новий API key / token"
            placeholder="Вставте тільки якщо потрібно замінити ключ"
            value={form.api_key}
            onChange={(value) => setForm((prev) => ({ ...prev, api_key: value }))}
          />
        </div>
      )}

      {needsLogin && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Логін Юнік Трейд"
              value={form.api_login}
              onChange={(value) => setForm((prev) => ({ ...prev, api_login: value }))}
              placeholder="login / email"
            />
            <Input
              type="password"
              label={form.current_password_set ? 'Новий пароль Юнік Трейд' : 'Пароль Юнік Трейд'}
              value={form.api_password}
              onChange={(value) => setForm((prev) => ({ ...prev, api_password: value }))}
              placeholder={form.current_password_set ? 'Заповніть тільки для заміни' : 'Пароль'}
            />
          </div>
          <StatusPill icon={<ShieldCheck size={15} />} label="Поточні дані" value={`${form.api_login || form.current_login || 'логін не додано'} · ${form.current_password_set ? 'пароль збережено' : 'пароль не додано'}`} ok={(form.api_login || form.current_login) && (form.current_password_set || form.api_password)} />
          <Input
            label="Browser fingerprint"
            value={form.browser_fingerprint}
            onChange={(value) => setForm((prev) => ({ ...prev, browser_fingerprint: value }))}
            placeholder="Необовʼязково, якщо backend не вимагає"
          />
        </div>
      )}


      <label className={`flex cursor-pointer items-start gap-3 rounded-3xl border p-4 ${form.is_active ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-200 bg-slate-50'}`}>
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
          className="mt-1"
        />
        <span>
          <span className="block font-black text-slate-900">Постачальник активний</span>
          <span className="mt-1 block text-xs font-semibold text-slate-500">Якщо вимкнути, він залишиться в системі, але не буде основним у роботі.</span>
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={onCheck} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white px-5 py-3 text-xs font-black uppercase text-blue-700 shadow-sm transition hover:bg-blue-50"><RefreshCcw size={15} /> Перевірити дані</button>
        <Button type="submit" loading={busy} className="w-full">Зберегти постачальника</Button>
      </div>
    </form>
  );
}

function ReceiptForm({ receipt, setReceipt, suppliers, categories, onSubmit, busy }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Select label="Постачальник" value={receipt.supplier} onChange={(value) => setReceipt({ ...receipt, supplier: value, supplier_name: '' })}>
          <option value="">Ручний / новий</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </Select>
        {!receipt.supplier && <Input label="Назва постачальника" placeholder="Напр. місцевий магазин" value={receipt.supplier_name} onChange={(value) => setReceipt({ ...receipt, supplier_name: value })} />}
        <Select label="Категорія" value={receipt.category} onChange={(value) => setReceipt({ ...receipt, category: value })}>
          <option value="">Без категорії</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
        <Input required label="Бренд" value={receipt.brand} onChange={(value) => setReceipt({ ...receipt, brand: value.toUpperCase() })} />
        <Input required label="Артикул" value={receipt.article} onChange={(value) => setReceipt({ ...receipt, article: value.toUpperCase() })} />
        <Input required type="number" min="1" label="Кількість" value={receipt.quantity} onChange={(value) => setReceipt({ ...receipt, quantity: value })} />
        <Input type="number" min="0" label="Мін. залишок" value={receipt.min_quantity} onChange={(value) => setReceipt({ ...receipt, min_quantity: value })} />
        <Input required label="Назва товару" className="md:col-span-2" value={receipt.name} onChange={(value) => setReceipt({ ...receipt, name: value })} />
        <Input required type="number" step="0.01" label="Закупка" value={receipt.buy_price} onChange={(value) => setReceipt({ ...receipt, buy_price: value })} />
        <Input type="number" step="0.01" label="Продаж" value={receipt.sell_price} onChange={(value) => setReceipt({ ...receipt, sell_price: value })} />
        <label className="block md:col-span-3">
          <span className="mb-1 block text-xs font-black uppercase text-slate-400">Примітка</span>
          <textarea
            value={receipt.note || ''}
            onChange={(event) => setReceipt({ ...receipt, note: event.target.value })}
            className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
          />
        </label>
      </div>
      <Button type="submit" loading={busy} className="w-full">Провести прихід</Button>
    </form>
  );
}

function MovementTable({ movements }) {
  if (!movements.length) return <Empty text="Рухів ще немає" />;

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full min-w-[850px] text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-[10px] font-black uppercase text-slate-400">
            <th className="px-3 py-3">Дата</th>
            <th className="px-3 py-3">Тип</th>
            <th className="px-3 py-3">Товар</th>
            <th className="px-3 py-3 text-center">Кількість</th>
            <th className="px-3 py-3">Замовлення №</th>
            <th className="px-3 py-3">Причина</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => {
            const quantity = String(qtyDisplay(movement));
            return (
              <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-3 font-bold text-slate-500">{movement.created_at ? new Date(movement.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="px-3 py-3"><span className="rounded-xl bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700">{movementLabel(movement)}</span></td>
                <td className="px-3 py-3"><p className="font-black text-slate-900">{movement.brand} {movement.article}</p><p className="text-xs font-bold text-slate-500">{movement.name}</p></td>
                <td className={`px-3 py-3 text-center font-black ${quantity.startsWith('+') ? 'text-emerald-600' : quantity.startsWith('-') ? 'text-rose-600' : 'text-slate-500'}`}>{quantity}</td>
                <td className="px-3 py-3 font-black text-slate-700">{movement.order_id ? `№${movement.order_id}` : '-'}</td>
                <td className="max-w-[280px] px-3 py-3 text-xs font-semibold text-slate-500">{movement.reason_display || movement.note || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmModal({ state, onClose, onDone }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await state.onConfirm();
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося виконати дію.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <UiModal open onClose={onClose} title={state.title} size="md">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-600">{state.text}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700">Скасувати</button>
          <button type="button" disabled={saving} onClick={handleConfirm} className="rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? 'Виконую...' : state.actionLabel}</button>
        </div>
      </div>
    </UiModal>
  );
}

function StatusPill({ icon, label, value, ok }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-3 ${ok ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-100 bg-amber-50/70'}`}>
      <div className={ok ? 'text-emerald-600' : 'text-amber-600'}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
        <p className="text-sm font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-start">
      <div>
        <h2 className="text-xl font-black uppercase text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:items-center">{actions}</div>}
    </div>
  );
}

function Panel({ children }) { return <Card padding="lg" className="min-w-0">{children}</Card>; }
function Notice({ text, onClose }) { return <div className="mb-5"><Alert variant="info"><div className="flex items-start justify-between gap-3"><span>{text}</span>{onClose && <button type="button" onClick={onClose}><X size={16} /></button>}</div></Alert></div>; }
function Modal({ title, onClose, children, wide }) { return <UiModal open onClose={onClose} title={title} size={wide ? 'lg' : 'md'}>{children}</UiModal>; }
function Stat({ icon, label, value, danger }) { return <Card variant="metric" padding="sm"><div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">{icon}{label}</div><p className={`mt-2 text-xl font-black ${danger ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></Card>; }
function Category({ active, onClick, label }) { return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black ${active ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{label}</button>; }
function Small({ label, value, strong, warn, good }) { return <div className={`rounded-xl border p-2 ${warn ? 'border-amber-100 bg-amber-50' : good ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-white'}`}><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className={`break-words text-xs font-black ${strong ? 'text-slate-900' : warn ? 'text-amber-700' : good ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p></div>; }
function Input({ value, onChange, ...props }) { return <UiInput {...props} value={value || ''} onChange={(event) => onChange(event.target.value)} />; }
function Select({ label, value, onChange, children }) { return <UiSelect label={label} value={value || ''} onChange={(event) => onChange(event.target.value)}>{children}</UiSelect>; }
function Empty({ text }) { return <EmptyState title={text} />; }
