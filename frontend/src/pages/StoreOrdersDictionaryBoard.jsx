import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  PackageCheck,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
  UserRound,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import api from '../api/axios';

const field =
  'w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500';

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';

const greenBtn =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed';

const navBtn =
  'w-10 h-10 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 transition';

const emptyOrder = {
  client: '',
  phone: '',
  plate: '',
  vin_code: '',
  source: 'Телефон',
  delivery_type: 'pickup',
  payment_status: 'unpaid',
  comment: '',
};

const emptyPart = {
  name: '',
  brand: '',
  article: '',
  supplier: '',
  buy_price: '',
  sell_price: '',
  quantity: 1,
  status: 'WAITING',
};

const emptyQuick = {
  name: '',
  brand: '',
  article: '',
  supplier: 'Склад / магазин',
  buy_price: '',
  sell_price: '',
  quantity: 1,
  payment_status: 'paid',
  comment: '',
};

const emptyTtnForm = {
  novapost_profile_id: '',
  recipient_name: '',
  recipient_phone: '',
  recipient_city: '',
  recipient_city_ref: '',
  recipient_warehouse: '',
  recipient_warehouse_ref: '',
  description: '',
  cost: '',
  weight: '1',
  seats_amount: '1',
  payer_type: 'Recipient',
  payment_method: 'Cash',
  cod_enabled: false,
  cod_amount: '',
};

const arr = (v) => (Array.isArray(v) ? v : []);

const num = (v) => Number(String(v || 0).replace(',', '.')) || 0;

const money = (v) =>
  `${Number(v || 0).toLocaleString('uk-UA', {
    maximumFractionDigits: 2,
  })} ₴`;

const dateISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const shiftDate = (v, days) => {
  const d = new Date(`${v}T12:00:00`);
  d.setDate(d.getDate() + days);
  return dateISO(d);
};

const orderDate = (o) => dateISO(new Date(o?.scheduled_datetime || o?.created_at || Date.now()));

const parseDelivery = (o) => {
  try {
    const raw = o?.delivery_data;
    if (!raw) return {};

    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      return JSON.parse(raw);
    }

    return typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const pay = {
  unpaid: 'Не оплачено',
  prepaid: 'Передплата',
  paid: 'Оплачено',
  cod: 'Післяплата',
  debt: 'Борг',
};

const fallbackLabels = {
  NEW: 'Нове',
  SELECTION: 'В обробці',
  PENDING: 'В обробці',
  DRAFT: 'В обробці',
  PROCESSING: 'В обробці',
  ORDERED: 'Очікує товар',
  IN_PROGRESS: 'Очікує товар',
  WAITING: 'Очікує товар',
  READY: 'Готове',
  DONE: 'Готове',
  SHIPPED: 'Відправлено',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано',
  RETURNED: 'Повернення',
};

const statusAliases = {
  new: ['NEW'],
  in_progress: ['PROCESSING', 'SELECTION', 'PENDING', 'DRAFT'],
  waiting: ['WAITING', 'ORDERED', 'IN_PROGRESS'],
  ready: ['READY', 'DONE'],
  shipped: ['SHIPPED'],
  done: ['COMPLETED'],
  cancelled: ['CANCELLED'],
  returned: ['RETURNED'],
};

const colorStyle = {
  blue: 'border-blue-200 bg-blue-50/70 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
  orange: 'border-orange-200 bg-orange-50/70 text-orange-700',
  rose: 'border-rose-200 bg-rose-50/70 text-rose-700',
  indigo: 'border-indigo-200 bg-indigo-50/70 text-indigo-700',
  purple: 'border-purple-200 bg-purple-50/70 text-purple-700',
  slate: 'border-slate-200 bg-slate-50/70 text-slate-700',
  cyan: 'border-cyan-200 bg-cyan-50/70 text-cyan-700',
  green: 'border-green-200 bg-green-50/70 text-green-700',
  sky: 'border-sky-200 bg-sky-50/70 text-sky-700',
  pink: 'border-pink-200 bg-pink-50/70 text-pink-700',
  yellow: 'border-yellow-200 bg-yellow-50/70 text-yellow-700',
};

const iconMap = {
  clock: Clock,
  truck: Truck,
  send: Send,
  'check-circle': CheckCircle2,
  'badge-check': CheckCircle2,
  'x-circle': XCircle,
  'rotate-ccw': PackageCheck,
  sparkles: PackageCheck,
};

function calc(p) {
  const q = num(p.quantity) || 1;
  const buy = num(p.buy_price);
  const sell = num(p.sell_price);
  const revenue = q * sell;
  const cost = q * buy;
  const profit = revenue - cost;

  return {
    q,
    buy,
    sell,
    revenue,
    cost,
    profit,
    margin: revenue ? (profit / revenue) * 100 : 0,
  };
}

function totals(o) {
  const t = arr(o?.parts).reduce(
    (a, p) => {
      const c = calc(p);
      a.revenue += c.revenue;
      a.cost += c.cost;
      a.profit += c.profit;
      return a;
    },
    { revenue: 0, cost: 0, profit: 0 }
  );

  t.count = arr(o?.parts).length;
  t.margin = t.revenue ? (t.profit / t.revenue) * 100 : 0;

  return t;
}

function smartStatus(order, patch = null) {
  const d = {
    ...parseDelivery(order),
    ...(patch || {}),
  };

  const parts = arr(order?.parts);

  if (d.delivery_status === 'sent') return 'SHIPPED';
  if (!parts.length) return 'PROCESSING';

  if (parts.some((p) => ['WAITING', 'IN_TRANSIT', 'ORDERED'].includes(p.status || 'WAITING'))) {
    return 'WAITING';
  }

  if (parts.every((p) => ['ARRIVED', 'UNAVAILABLE', 'INSTALLED'].includes(p.status || 'WAITING'))) {
    return 'READY';
  }

  return order?.status || 'PROCESSING';
}

function hint(order, statusLabel) {
  const d = parseDelivery(order);
  const parts = arr(order?.parts);

  if (d.delivery_status === 'sent') {
    return `Статус: ${statusLabel}. Замовлення відправлено.`;
  }

  if (!parts.length) {
    return `Статус: ${statusLabel}. Додайте товари, щоб вести замовлення далі.`;
  }

  if (parts.some((p) => ['WAITING', 'IN_TRANSIT', 'ORDERED'].includes(p.status || 'WAITING'))) {
    return `Статус: ${statusLabel}. Є товари в очікуванні.`;
  }

  return `Статус: ${statusLabel}. Усі товари отримано.`;
}

export default function StoreOrdersDictionaryBoard() {
  const location = useLocation();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [day, setDay] = useState(dateISO());
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('client');
  const [busy, setBusy] = useState(false);

  const [statuses, setStatuses] = useState([]);
  const [partStatuses, setPartStatuses] = useState([]);

  const [orderForm, setOrderForm] = useState({ ...emptyOrder });
  const [partForm, setPartForm] = useState({ ...emptyPart });
  const [quick, setQuick] = useState({ ...emptyQuick });

  const [ttnForm, setTtnForm] = useState({ ...emptyTtnForm });
  const [ttnProfiles, setTtnProfiles] = useState([]);
  const [ttnCities, setTtnCities] = useState([]);
  const [ttnWarehouses, setTtnWarehouses] = useState([]);
  const [ttnError, setTtnError] = useState('');

  const loadDictionaries = async () => {
    try {
      const r = await api.get('/api/settings/dictionaries/?mode=store');
      setStatuses(arr(r.data?.store_order_status));
      setPartStatuses(arr(r.data?.part_status));
    } catch {
      setStatuses([]);
      setPartStatuses([]);
    }
  };

  const load = async () => {
    setLoading(true);

    try {
      const r = await api.get(`/api/visits/?date=${day}`);
      setOrders(Array.isArray(r.data) ? r.data : []);
    } catch {
      setMessage('Не вдалося завантажити замовлення.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDictionaries();
  }, []);

  useEffect(() => {
    load();
  }, [day]);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const id = p.get('visit_id');

    if (!id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);

      try {
        const r = await api.get(`/api/visits/${id}/`);

        if (cancelled) return;

        const order = r.data;
        const targetDay = orderDate(order);

        setSelected(order);
        setTab(p.get('tab') || 'parts');
        setSearch(String(order.id));

        setOrders((prev) =>
          prev.some((x) => Number(x.id) === Number(order.id))
            ? prev.map((x) => (Number(x.id) === Number(order.id) ? order : x))
            : [order, ...prev]
        );

        if (targetDay && targetDay !== day) {
          setDay(targetDay);
        }
      } catch {
        if (!cancelled) {
          setMessage('Не вдалося відкрити замовлення.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search]);

  useEffect(() => {
    if (modal !== 'create-ttn') return;

    let cancelled = false;

    (async () => {
      setTtnError('');

      try {
        const r = await api.get('/api/delivery/novapost/profiles/');
        const rowsFromProfiles = arr(r.data?.profiles);
        const rowsFromResults = arr(r.data?.results);
        const rows = rowsFromProfiles.length ? rowsFromProfiles : rowsFromResults;

        if (cancelled) return;

        setTtnProfiles(rows);

        const defaultProfile = rows.find((profile) => profile.is_default) || rows[0];

        if (defaultProfile) {
          setTtnForm((prev) => ({
            ...prev,
            novapost_profile_id: prev.novapost_profile_id || defaultProfile.id,
          }));
        }

        if (!rows.length) {
          setTtnError('Додайте активний профіль Нової пошти в налаштуваннях доставки.');
        }
      } catch (error) {
        if (cancelled) return;

        setTtnProfiles([]);
        setTtnError(
          error.response?.data?.error ||
            error.response?.data?.message ||
            'Не вдалося завантажити профілі Нової пошти.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modal]);

  const statusLabelMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.key, s.label])),
    [statuses]
  );

  const getStatusLabel = (status) => statusLabelMap[status] || fallbackLabels[status] || status || '—';

  const boardStatuses = useMemo(() => {
    const active = statuses.filter(
      (s) =>
        s.is_active !== false &&
        s.metadata?.show_on_board !== false &&
        !['cancelled', 'returned'].includes(s.semantic_role)
    );

    const list = active.length
      ? active
      : [
          {
            key: 'PROCESSING',
            label: 'В обробці',
            semantic_role: 'in_progress',
            color: 'amber',
            icon: 'clock',
          },
          {
            key: 'WAITING',
            label: 'Очікує товар',
            semantic_role: 'waiting',
            color: 'blue',
            icon: 'truck',
          },
          {
            key: 'READY',
            label: 'Готове',
            semantic_role: 'ready',
            color: 'indigo',
            icon: 'check-circle',
          },
          {
            key: 'SHIPPED',
            label: 'Відправлено',
            semantic_role: 'shipped',
            color: 'emerald',
            icon: 'send',
          },
        ];

    return list.sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100));
  }, [statuses]);

  const matchesStatus = (order, option) => {
    const aliases = [...(statusAliases[option.semantic_role] || []), option.key];
    return aliases.includes(order.status);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim().replace('№', '');

    return orders.filter((o) => {
      const d = parseDelivery(o);

      const text = [
        o.id,
        o.client,
        o.phone,
        o.plate,
        o.vin_code,
        d.ttn,
        getStatusLabel(o.status),
        ...arr(o.parts).flatMap((p) => [p.brand, p.article, p.name, p.supplier]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !q || text.includes(q);
    });
  }, [orders, search, statusLabelMap]);

  const groups = useMemo(
    () =>
      boardStatuses.map((s) => ({
        ...s,
        title: s.label,
        orders: filtered.filter((o) => matchesStatus(o, s)),
        iconComponent: iconMap[s.icon] || PackageCheck,
        style: colorStyle[s.color] || colorStyle.slate,
      })),
    [boardStatuses, filtered]
  );

  const setFresh = (o) => {
    setSelected(o);

    setOrders((p) => (p.some((x) => x.id === o.id) ? p.map((x) => (x.id === o.id ? o : x)) : [o, ...p]));

    return o;
  };

  const refresh = async (id = selected?.id) => {
    if (!id) return null;

    try {
      const r = await api.get(`/api/visits/${id}/`);
      return setFresh(r.data);
    } catch {
      load();
      return null;
    }
  };

  const patchOrder = async (payload, id = selected?.id) => {
    if (!id) return null;

    setBusy(true);

    try {
      const r = await api.patch(`/api/visits/${id}/`, payload);
      return setFresh(r.data);
    } catch {
      setMessage('Не вдалося оновити замовлення.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async (e) => {
    e.preventDefault();
    setBusy(true);

    try {
      const delivery = {
        source: orderForm.source,
        delivery_status: 'draft',
        mode: 'store',
      };

      const r = await api.post('/api/visits/', {
        client: orderForm.client.trim() || 'Новий покупець',
        phone: orderForm.phone.trim() || '0000000000',
        plate: (orderForm.plate || `ORDER-${Date.now()}`).trim().toUpperCase(),
        vin_code: orderForm.vin_code.trim().toUpperCase() || null,
        status: 'PROCESSING',
        delivery_type: orderForm.delivery_type,
        delivery_data: JSON.stringify(delivery),
        payment_status: orderForm.payment_status,
        prepayment_amount: 0,
        comment: orderForm.comment,
        scheduled_datetime: new Date(`${day}T12:00:00`).toISOString(),
      });

      setFresh(r.data);
      setModal(null);
      setTab('parts');
    } catch (e2) {
      setMessage(e2.response?.data?.error || 'Не вдалося створити замовлення.');
    } finally {
      setBusy(false);
    }
  };

  const addPart = async (e) => {
    e.preventDefault();

    if (!selected?.id) return;

    setBusy(true);

    try {
      await api.post('/api/order-parts/', {
        visit: selected.id,
        name: partForm.name.trim(),
        brand: (partForm.brand || 'Без бренду').trim(),
        article: (partForm.article || 'manual').trim(),
        supplier: (partForm.supplier || 'Ручне додавання').trim(),
        buy_price: num(partForm.buy_price),
        sell_price: num(partForm.sell_price),
        quantity: num(partForm.quantity) || 1,
        status: partForm.status || 'WAITING',
      });

      setPartForm({ ...emptyPart });

      const fresh = await refresh();

      if (fresh) {
        await patchOrder({ status: smartStatus(fresh) }, fresh.id);
      }

      setMessage('Товар додано.');
    } catch {
      setMessage('Не вдалося додати товар.');
    } finally {
      setBusy(false);
    }
  };

  const updatePartStatus = async (part, status) => {
    setBusy(true);

    try {
      await api.patch(`/api/order-parts/${part.id}/`, { status });

      const fresh = await refresh();

      if (fresh) {
        await patchOrder({ status: smartStatus(fresh) }, fresh.id);
      }
    } catch {
      setMessage('Не вдалося змінити статус товару.');
    } finally {
      setBusy(false);
    }
  };

  const deletePart = async (part) => {
    if (!window.confirm('Видалити товар із замовлення?')) return;

    setBusy(true);

    try {
      await api.delete(`/api/order-parts/${part.id}/`);

      const fresh = await refresh();

      if (fresh) {
        await patchOrder({ status: smartStatus(fresh) }, fresh.id);
      }
    } catch {
      setMessage('Не вдалося видалити товар.');
    } finally {
      setBusy(false);
    }
  };

  const updateDelivery = async (patch) => {
    const delivery = {
      ...parseDelivery(selected),
      ...patch,
      mode: 'store',
    };

    await patchOrder({
      delivery_data: JSON.stringify(delivery),
      status: smartStatus(selected, patch),
    });
  };

  const openCreateTtn = () => {
    const d = parseDelivery(selected);

    setTtnForm({
      ...emptyTtnForm,
      recipient_name: selected?.client || '',
      recipient_phone: selected?.phone || '',
      recipient_city: d.recipient_city || '',
      recipient_city_ref: d.recipient_city_ref || '',
      recipient_warehouse: d.recipient_warehouse || '',
      recipient_warehouse_ref: d.recipient_warehouse_ref || '',
      description: d.description || 'Автозапчастини',
      cost: d.cost || d.declared_value || '',
      weight: d.weight || '1',
      seats_amount: d.seats_amount || '1',
      payer_type: d.payer_type || 'Recipient',
      payment_method: d.payment_method || 'Cash',
      cod_enabled: selected?.payment_status === 'cod',
      cod_amount: d.cod_amount || '',
    });

    setTtnCities([]);
    setTtnWarehouses([]);
    setTtnError('');
    setModal('create-ttn');
  };

  const markPaid = async (total) => {
    await patchOrder({
      payment_status: 'paid',
      prepayment_amount: num(total),
    });
  };

  const savePrepay = async (amount) => {
    const value = num(amount);
    const t = totals(selected);

    await patchOrder({
      payment_status: value >= t.revenue ? 'paid' : 'prepaid',
      prepayment_amount: value,
    });
  };

  const cancelOrder = async (reason) => {
    const delivery = {
      ...parseDelivery(selected),
      cancel_reason: reason,
    };

    await patchOrder({
      status: 'CANCELLED',
      delivery_data: JSON.stringify(delivery),
    });

    setModal(null);
  };

  const quickSale = async (e) => {
    e.preventDefault();
    setBusy(true);

    try {
      const order = await api.post('/api/visits/', {
        client: 'Роздрібний покупець',
        phone: '0000000000',
        plate: `SALE-${Date.now()}`.slice(0, 20),
        vin_code: null,
        status: 'COMPLETED',
        delivery_type: 'pickup',
        delivery_data: JSON.stringify({
          source: 'Швидкий продаж',
          mode: 'store',
          quick_sale: true,
          delivery_status: 'received',
        }),
        payment_status: quick.payment_status,
        prepayment_amount: 0,
        comment: quick.comment || 'Швидкий продаж',
        scheduled_datetime: new Date(`${day}T12:00:00`).toISOString(),
      });

      const part = await api.post('/api/order-parts/', {
        visit: order.data.id,
        name: quick.name.trim(),
        brand: (quick.brand || 'Без бренду').trim(),
        article: (quick.article || 'manual').trim(),
        supplier: (quick.supplier || 'Швидкий продаж').trim(),
        buy_price: num(quick.buy_price),
        sell_price: num(quick.sell_price),
        quantity: num(quick.quantity) || 1,
        status: 'ARRIVED',
      });

      setFresh({
        ...order.data,
        parts: [part.data],
      });

      setModal(null);
      setQuick({ ...emptyQuick });
    } catch {
      setMessage('Не вдалося створити швидкий продаж.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-3 md:p-8 md:pl-72 min-h-screen pb-24">
      <Top setModal={setModal} setOrderForm={setOrderForm} setQuick={setQuick} />

      {message && <Notice message={message} onClose={() => setMessage('')} />}

      <SearchDate
        search={search}
        setSearch={setSearch}
        day={day}
        setDay={setDay}
        count={filtered.length}
      />

      {loading ? (
        <Empty text="Завантаження..." />
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${groups.length >= 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
          {groups.map((c) => (
            <Column
              key={c.key}
              c={c}
              onOpen={(o) => {
                setSelected(o);
                setTab('client');
              }}
            />
          ))}
        </div>
      )}

      {selected && (
        <Drawer
          order={selected}
          tab={tab}
          setTab={setTab}
          setOrder={setSelected}
          onPatch={patchOrder}
          onPay={markPaid}
          onPrepay={savePrepay}
          onUpdateDelivery={updateDelivery}
          onCreateTtn={openCreateTtn}
          onCancel={() => setModal('cancel')}
          partForm={partForm}
          setPartForm={setPartForm}
          onAddPart={addPart}
          onPartStatus={updatePartStatus}
          onDelete={deletePart}
          statuses={boardStatuses}
          partStatuses={partStatuses}
          getStatusLabel={getStatusLabel}
        />
      )}

      {modal === 'order' && (
        <Modal title="Нове замовлення" onClose={() => setModal(null)}>
          <OrderForm form={orderForm} setForm={setOrderForm} onSubmit={createOrder} busy={busy} />
        </Modal>
      )}

      {modal === 'quick' && (
        <Modal title="Швидкий продаж" onClose={() => setModal(null)}>
          <QuickForm form={quick} setForm={setQuick} onSubmit={quickSale} busy={busy} />
        </Modal>
      )}

      {modal === 'cancel' && selected && (
        <CancelModal onClose={() => setModal(null)} onSubmit={cancelOrder} busy={busy} />
      )}

      {modal === 'create-ttn' && selected && (
        <Modal title="Створити ТТН Нової пошти" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {ttnError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {ttnError}
              </div>
            )}

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
              Форма створення ТТН буде додана наступним етапом. Профілі Нової пошти вже завантажуються автоматично.
            </div>

            <div className="grid gap-2 text-sm">
              <Info label="Одержувач" value={ttnForm.recipient_name} />
              <Info label="Телефон" value={ttnForm.recipient_phone} />
              <Info label="Місто" value={ttnForm.recipient_city || 'Буде обрано в формі'} />
              <Info label="Відділення" value={ttnForm.recipient_warehouse || 'Буде обрано в формі'} />
              <Info label="Опис" value={ttnForm.description} />
              <Info label="Вага" value={ttnForm.weight} />
              <Info label="Місць" value={ttnForm.seats_amount} />
              <Info label="Платник доставки" value={ttnForm.payer_type === 'Recipient' ? 'Одержувач' : 'Відправник'} />
              <Info label="Післяплата" value={ttnForm.cod_enabled ? `Так, ${ttnForm.cod_amount || 0} ₴` : 'Ні'} />
              <Info label="Профілі відправника" value={`${ttnProfiles.length} завантажено`} />
              <Info label="Знайдені міста" value={`${ttnCities.length} варіантів`} />
              <Info label="Знайдені відділення" value={`${ttnWarehouses.length} варіантів`} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Top({ setModal, setOrderForm, setQuick }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase italic flex items-center gap-2">
          <PackageCheck className="text-blue-600" />
          Дошка замовлень
        </h1>
        <p className="text-slate-500 font-semibold text-sm mt-1">
          Статуси колонок беруться з налаштувань довідників.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => {
            setQuick({ ...emptyQuick });
            setModal('quick');
          }}
          className={greenBtn}
        >
          <ShoppingCart size={16} />
          Швидкий продаж
        </button>

        <button
          type="button"
          onClick={() => {
            setOrderForm({ ...emptyOrder });
            setModal('order');
          }}
          className={primaryBtn}
        >
          <Plus size={16} />
          Нове замовлення
        </button>
      </div>
    </div>
  );
}

function SearchDate({ search, setSearch, day, setDay, count }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="bg-white border rounded-3xl shadow-sm p-3 sm:p-4 mb-5 grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук по №, клієнту, телефону, ТТН, артикулу..."
          className={field.replace('px-4', 'pl-9 pr-4')}
        />
      </div>

      <div className="relative flex items-center gap-2 bg-slate-50 border rounded-xl px-2 py-2">
        <button type="button" onClick={() => setDay(shiftDate(day, -1))} className={navBtn}>
          <ChevronLeft size={16} />
        </button>

        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-black text-xs uppercase flex items-center gap-2 min-w-[190px] justify-center shadow-sm hover:bg-blue-50 hover:text-blue-700 transition"
        >
          <CalendarDays size={15} />
          {new Date(`${day}T12:00:00`).toLocaleDateString('uk-UA', {
            weekday: 'short',
            day: '2-digit',
            month: 'long',
          })}
          {' '}• {count}
        </button>

        {pickerOpen && (
          <div className="absolute right-12 top-full mt-2 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3">
            <input
              type="date"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setPickerOpen(false);
              }}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-black outline-none focus:bg-white focus:border-blue-500"
            />

            <button
              type="button"
              onClick={() => {
                setDay(dateISO());
                setPickerOpen(false);
              }}
              className="mt-2 w-full rounded-xl bg-blue-50 text-blue-700 px-3 py-2 text-xs font-black uppercase"
            >
              Сьогодні
            </button>
          </div>
        )}

        <button type="button" onClick={() => setDay(shiftDate(day, 1))} className={navBtn}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function Column({ c, onOpen }) {
  const Icon = c.iconComponent || PackageCheck;

  return (
    <div className={`rounded-3xl border shadow-sm p-4 min-h-[280px] ${c.style}`}>
      <h3 className="font-black uppercase text-sm flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-2xl flex items-center justify-center bg-white/80">
          <Icon size={18} />
        </span>
        {c.title}
        <span className="ml-auto bg-white/80 px-3 py-1 rounded-xl text-slate-700">
          {c.orders.length}
        </span>
      </h3>

      <div className="space-y-3">
        {c.orders.map((o) => (
          <Card key={o.id} order={o} onOpen={() => onOpen(o)} />
        ))}

        {!c.orders.length && <Empty text="Пусто" />}
      </div>
    </div>
  );
}

function Card({ order, onOpen }) {
  const t = totals(order);
  const paid = num(order.prepayment_amount);
  const left = Math.max(t.revenue - paid, 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white/90 hover:bg-white border border-white/80 hover:border-blue-200 rounded-2xl p-4 shadow-sm"
    >
      <p className="font-black text-slate-900">
        №{order.id} • {order.client || 'Покупець'}
      </p>

      <p className="text-xs font-bold text-slate-500 mt-1">
        {order.phone || '-'} • {order.plate || 'Без авто'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{t.count} поз.</Badge>
        <Badge>{money(t.revenue)}</Badge>
        <Badge>{fallbackLabels[order.status] || order.status}</Badge>
        <Badge>{pay[order.payment_status] || 'Оплата'}</Badge>

        {left > 0 && order.payment_status !== 'paid' ? (
          <Badge>Залишок {money(left)}</Badge>
        ) : null}
      </div>
    </button>
  );
}

function Drawer(p) {
  const {
    order,
    tab,
    setTab,
    setOrder,
    onPatch,
    onPay,
    onPrepay,
    onUpdateDelivery,
    onCreateTtn,
    onCancel,
    partForm,
    setPartForm,
    onAddPart,
    onPartStatus,
    onDelete,
    statuses,
    partStatuses,
    getStatusLabel,
  } = p;

  const d = parseDelivery(order);
  const t = totals(order);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-white w-full max-w-5xl h-full overflow-y-auto shadow-2xl p-4 md:p-7">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-black uppercase">Замовлення №{order.id}</h2>
            <p className="text-sm font-bold text-slate-500">
              {order.client} • {order.phone}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <XCircle size={18} />
            </button>

            <button
              type="button"
              onClick={() => onPatch({ status: 'COMPLETED' })}
              className="p-2 bg-emerald-50 text-emerald-700 rounded-xl"
            >
              <CheckCircle2 size={18} />
            </button>

            <button type="button" onClick={() => setOrder(null)} className="p-2 bg-slate-100 rounded-xl">
              <X size={18} />
            </button>
          </div>
        </div>

        <Summary order={order} totals={t} getStatusLabel={getStatusLabel} />

        <StatusSwitcher order={order} statuses={statuses} onPatch={onPatch} />

        <PaymentBar order={order} totals={t} onPay={onPay} onPrepay={onPrepay} />

        <div className="bg-slate-50 border rounded-2xl p-3 mb-4 text-sm font-bold text-slate-600">
          💡 {hint(order, getStatusLabel(order.status))}
        </div>

        <Tabs active={tab} setActive={setTab} />

        {tab === 'client' && (
          <Panel title="Покупець">
            <Info label="Клієнт" value={order.client} />
            <Info label="Телефон" value={order.phone} />
            <Info label="Авто / VIN" value={`${order.plate || '-'} ${order.vin_code || ''}`} />
            <Info label="Джерело" value={d.source || '-'} />
          </Panel>
        )}

        {tab === 'parts' && (
          <PartsPanel
            parts={arr(order.parts)}
            partForm={partForm}
            setPartForm={setPartForm}
            onAddPart={onAddPart}
            onPartStatus={onPartStatus}
            onDelete={onDelete}
            partStatuses={partStatuses}
          />
        )}

        {tab === 'delivery' && (
          <DeliveryPanel
            order={order}
            delivery={d}
            onPatch={onPatch}
            onUpdateDelivery={onUpdateDelivery}
            onCreateTtn={onCreateTtn}
          />
        )}
      </div>
    </div>
  );
}

function StatusSwitcher({ order, statuses, onPatch }) {
  return (
    <div className="bg-white border rounded-2xl p-3 mb-4">
      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
        Статус замовлення з довідника
      </p>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onPatch({ status: s.key })}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase border ${
              order.status === s.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaymentBar({ order, totals: t, onPay, onPrepay }) {
  const paidStatus = order.payment_status === 'paid';
  const paid = paidStatus ? t.revenue : num(order.prepayment_amount);
  const left = Math.max(t.revenue - paid, 0);

  const [draft, setDraft] = useState(String(paid || ''));

  useEffect(() => {
    setDraft(String(paid || ''));
  }, [order.id, order.prepayment_amount, t.revenue, paidStatus]);

  return (
    <div
      className={`mb-4 rounded-2xl border p-3 md:p-4 ${
        paidStatus ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
      }`}
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              paidStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <CreditCard size={19} />
          </span>

          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Оплата</p>
            <p className={`font-black ${paidStatus ? 'text-emerald-700' : 'text-amber-800'}`}>
              {pay[order.payment_status] || 'Не оплачено'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 flex-1">
          <PayMini label="Сума" value={money(t.revenue)} />
          <PayMini label="Внесено" value={money(paid)} />
          <PayMini label="Залишилось" value={money(left)} bad={left > 0 && !paidStatus} good={left <= 0} />
        </div>
      </div>

      {!paidStatus && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 mt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Сума передплати"
            className={field}
          />

          <button type="button" onClick={() => onPrepay(draft)} className={primaryBtn}>
            Зберегти передплату
          </button>

          <button type="button" onClick={() => onPay(t.revenue)} className={greenBtn}>
            Оплачено повністю
          </button>
        </div>
      )}
    </div>
  );
}

function Tabs({ active, setActive }) {
  const tabs = [
    ['client', UserRound, 'Клієнт'],
    ['parts', Wrench, 'Запчастини'],
    ['delivery', Truck, 'Доставка'],
  ];

  return (
    <div className="bg-slate-100 rounded-2xl p-1 grid grid-cols-3 gap-1 mb-4 sticky top-0 z-10">
      {tabs.map(([k, Icon, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => setActive(k)}
          className={`rounded-xl p-3 font-black uppercase text-xs flex items-center justify-center gap-2 ${
            active === k ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-white'
          }`}
        >
          <Icon size={15} />
          {l}
        </button>
      ))}
    </div>
  );
}

function Summary({ order, totals: t, getStatusLabel }) {
  const paid = order.payment_status === 'paid' ? t.revenue : num(order.prepayment_amount);
  const left = Math.max(t.revenue - paid, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
      <PayMini label="Статус" value={getStatusLabel(order.status)} />
      <PayMini label="Виручка" value={money(t.revenue)} />
      <PayMini label="Прибуток" value={money(t.profit)} good />
      <PayMini label="Оплачено" value={money(paid)} />
      <PayMini label="Борг" value={money(left)} bad={left > 0 && order.payment_status !== 'paid'} />
    </div>
  );
}

function PartsPanel({
  parts,
  partForm,
  setPartForm,
  onAddPart,
  onPartStatus,
  onDelete,
  partStatuses,
}) {
  const options = partStatuses.length
    ? partStatuses
    : [
        { key: 'WAITING', label: 'Очікує' },
        { key: 'ORDERED', label: 'Замовлено' },
        { key: 'ARRIVED', label: 'Приїхало' },
        { key: 'UNAVAILABLE', label: 'Немає' },
      ];

  return (
    <Panel title="Запчастини">
      <form onSubmit={onAddPart} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
        <input
          required
          placeholder="Назва"
          value={partForm.name}
          onChange={(e) => setPartForm({ ...partForm, name: e.target.value })}
          className={field}
        />

        <input
          placeholder="Бренд"
          value={partForm.brand}
          onChange={(e) => setPartForm({ ...partForm, brand: e.target.value })}
          className={field}
        />

        <input
          placeholder="Артикул"
          value={partForm.article}
          onChange={(e) => setPartForm({ ...partForm, article: e.target.value })}
          className={field}
        />

        <input
          placeholder="Постачальник"
          value={partForm.supplier}
          onChange={(e) => setPartForm({ ...partForm, supplier: e.target.value })}
          className={field}
        />

        <input
          placeholder="Закупка"
          value={partForm.buy_price}
          onChange={(e) => setPartForm({ ...partForm, buy_price: e.target.value })}
          className={field}
        />

        <input
          placeholder="Продаж"
          value={partForm.sell_price}
          onChange={(e) => setPartForm({ ...partForm, sell_price: e.target.value })}
          className={field}
        />

        <input
          placeholder="К-сть"
          value={partForm.quantity}
          onChange={(e) => setPartForm({ ...partForm, quantity: e.target.value })}
          className={field}
        />

        <select
          value={partForm.status}
          onChange={(e) => setPartForm({ ...partForm, status: e.target.value })}
          className={field}
        >
          {options.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <button type="submit" className={`${primaryBtn} md:col-span-4`}>
          <Plus size={16} />
          Додати товар
        </button>
      </form>

      <div className="space-y-2">
        {parts.map((p) => {
          const c = calc(p);

          return (
            <div key={p.id} className="bg-slate-50 border rounded-2xl p-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">
                    {p.name || 'Товар'} • {p.brand || 'Без бренду'}
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    {p.article || '-'} • {p.supplier || '-'} • {p.quantity || 1} шт.
                  </p>
                  <p className="text-xs font-black text-slate-700 mt-1">
                    Продаж: {money(c.revenue)} • Закупка: {money(c.cost)} • Прибуток: {money(c.profit)}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={p.status || 'WAITING'}
                    onChange={(e) => onPartStatus(p, e.target.value)}
                    className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none"
                  >
                    {options.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-xs font-black uppercase text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 size={14} />
                    Видалити
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!parts.length && <Empty text="Товарів ще немає" />}
      </div>
    </Panel>
  );
}

function DeliveryPanel({ delivery, onPatch, onUpdateDelivery, onCreateTtn }) {
  const [ttn, setTtn] = useState(delivery.ttn || '');

  useEffect(() => {
    setTtn(delivery.ttn || '');
  }, [delivery.ttn]);

  return (
    <Panel title="Нова пошта / доставка">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <input
          value={ttn}
          onChange={(e) => setTtn(e.target.value)}
          placeholder="ТТН"
          className={field}
        />

        <button
          type="button"
          onClick={() => onUpdateDelivery({ ttn })}
          className={primaryBtn}
        >
          Зберегти ТТН
        </button>

        <button
          type="button"
          onClick={() => onUpdateDelivery({ delivery_status: 'sent', ttn })}
          className={greenBtn}
        >
          <Send size={16} />
          Відправлено
        </button>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button type="button" className={primaryBtn} onClick={onCreateTtn}>
          <Truck size={16} />
          Створити ТТН
        </button>

        <button
          type="button"
          onClick={() => onPatch({ status: 'COMPLETED' })}
          className="bg-slate-900 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase"
        >
          Закрити як виконане
        </button>
      </div>
    </Panel>
  );
}

function OrderForm({ form, setForm, onSubmit, busy }) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
      <input
        required
        placeholder="Клієнт"
        value={form.client}
        onChange={(e) => setForm({ ...form, client: e.target.value })}
        className={field}
      />

      <input
        placeholder="Телефон"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className={field}
      />

      <input
        placeholder="Авто / номер"
        value={form.plate}
        onChange={(e) => setForm({ ...form, plate: e.target.value })}
        className={field}
      />

      <input
        placeholder="VIN"
        value={form.vin_code}
        onChange={(e) => setForm({ ...form, vin_code: e.target.value })}
        className={field}
      />

      <textarea
        placeholder="Коментар"
        value={form.comment}
        onChange={(e) => setForm({ ...form, comment: e.target.value })}
        className={field}
      />

      <button disabled={busy} className={primaryBtn}>
        Створити
      </button>
    </form>
  );
}

function QuickForm({ form, setForm, onSubmit, busy }) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
      <input
        required
        placeholder="Назва товару"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className={field}
      />

      <input
        placeholder="Бренд"
        value={form.brand}
        onChange={(e) => setForm({ ...form, brand: e.target.value })}
        className={field}
      />

      <input
        placeholder="Артикул"
        value={form.article}
        onChange={(e) => setForm({ ...form, article: e.target.value })}
        className={field}
      />

      <input
        placeholder="Закупка"
        value={form.buy_price}
        onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
        className={field}
      />

      <input
        required
        placeholder="Продаж"
        value={form.sell_price}
        onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
        className={field}
      />

      <input
        placeholder="Кількість"
        value={form.quantity}
        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        className={field}
      />

      <button disabled={busy} className={greenBtn}>
        Продати
      </button>
    </form>
  );
}

function CancelModal({ onClose, onSubmit, busy }) {
  const [reason, setReason] = useState('Клієнт передумав');

  return (
    <Modal title="Скасувати замовлення" onClose={onClose}>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
        <option>Клієнт передумав</option>
        <option>Дорого</option>
        <option>Немає в наявності</option>
        <option>Довго чекати</option>
        <option>Інше</option>
      </select>

      <button
        type="button"
        disabled={busy}
        onClick={() => onSubmit(reason)}
        className="mt-3 w-full bg-rose-600 text-white rounded-2xl py-3 font-black uppercase text-xs"
      >
        Скасувати
      </button>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-black text-xl uppercase">{title}</h2>

          <button type="button" onClick={onClose} className="p-2 bg-slate-100 rounded-xl">
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-white border rounded-3xl p-4 mb-4">
      <h3 className="font-black uppercase text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-3 mb-2">
      <p className="text-[10px] uppercase font-black text-slate-400">{label}</p>
      <p className="font-bold text-slate-800">{value || '—'}</p>
    </div>
  );
}

function PayMini({ label, value, good, bad }) {
  return (
    <div className="bg-white/80 rounded-2xl border border-white/70 p-3">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className={`font-black ${good ? 'text-emerald-700' : bad ? 'text-rose-700' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase">
      {children}
    </span>
  );
}

function Empty({ text }) {
  return (
    <div className="bg-white/50 border border-white/70 rounded-2xl p-6 text-center text-slate-400 font-black uppercase text-xs">
      {text}
    </div>
  );
}

function Notice({ message, onClose }) {
  return (
    <div className="fixed top-20 right-4 z-[70] bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3">
      <span className="font-bold text-sm">{message}</span>

      <button type="button" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
