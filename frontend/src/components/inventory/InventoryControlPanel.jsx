import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Download, Package, Search, ShieldAlert, Sparkles, TrendingDown, TrendingUp, Truck, Wallet } from 'lucide-react';

const arr = (value) => (Array.isArray(value) ? value : []);
const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const qty = (value) => Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 1 });
const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function InventoryControlPanel({ insights, loading, onReceipt }) {
  const [section, setSection] = useState('purchases');
  const [query, setQuery] = useState('');
  const summary = insights?.summary || {};
  const purchaseList = arr(insights?.purchase_list);
  const slowMoving = arr(insights?.slow_moving);
  const margin = insights?.margin || {};
  const bySupplier = arr(insights?.purchase_by_supplier);
  const minStock = arr(insights?.min_stock);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filter = (row) => !q || [row.brand, row.article, row.name, row.supplier_name, row.category_name].filter(Boolean).join(' ').toLowerCase().includes(q);
    return {
      purchases: purchaseList.filter(filter),
      slow: slowMoving.filter(filter),
      below: arr(margin.below_cost).filter(filter),
      low: arr(margin.low_margin).filter(filter),
      high: arr(margin.high_margin).filter(filter),
      missing: arr(margin.missing_sell_price).filter(filter),
      minStock: minStock.filter(filter),
    };
  }, [query, purchaseList, slowMoving, margin, minStock]);

  const exportPurchases = () => {
    const data = [
      ['Постачальник', 'Бренд', 'Артикул', 'Назва', 'Доступно', 'Мінімум', 'Дозамовити', 'Закупка/шт', 'Сума закупки', 'Ціна продажу', 'Очікуваний прибуток', 'Маржа %'],
      ...rows.purchases.map((item) => [item.supplier_name, item.brand, item.article, item.name, item.available_quantity, item.min_quantity, item.reorder_qty, item.buy_price, item.reorder_purchase_value, item.missing_sell_price ? 'не задано' : item.sell_price, item.missing_sell_price ? '' : item.reorder_expected_profit, item.missing_sell_price ? '' : item.margin_percent]),
    ];
    downloadCsv(`purchase-list-${new Date().toISOString().slice(0, 10)}.csv`, data);
  };

  if (loading && !insights) return <EmptyPanel text="Завантаження контролю складу..." />;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.25),transparent_35%)]" />
        <div className="relative p-5 md:p-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">
                <Wallet size={15} /> Контроль грошей складу
              </div>
              <h2 className="mt-4 text-3xl font-black uppercase italic leading-tight tracking-tight md:text-4xl">Склад і закупки</h2>
              <p className="mt-3 max-w-3xl text-sm font-bold text-slate-300 md:text-base">
                Тут видно що треба дозамовити, які гроші заморожені в неліквіді, де низька маржа і скільки потенційного прибутку лежить у складі.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[420px]">
              <HeroMetric label="Закупка складу" value={money(summary.stock_buy_value)} />
              <HeroMetric label="Продаж складу" value={money(summary.stock_sell_value)} />
              <HeroMetric label="Потенц. прибуток" value={money(summary.potential_profit)} good />
              <HeroMetric label="Заморожено" value={money(summary.frozen_money)} danger={summary.frozen_money > 0} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
        <Stat icon={<Package size={17} />} label="Позицій" value={summary.items_count || 0} />
        <Stat icon={<Truck size={17} />} label="Дозамовити" value={summary.restock_count || 0} danger={summary.restock_count > 0} />
        <Stat icon={<Wallet size={17} />} label="Сума закупки" value={money(summary.purchase_value)} />
        <Stat icon={<TrendingUp size={17} />} label="Очікув. прибуток" value={money(summary.purchase_expected_profit)} good />
        <Stat icon={<ShieldAlert size={17} />} label="Неліквід" value={summary.slow_count || 0} danger={summary.slow_count > 0} />
        <Stat icon={<AlertTriangle size={17} />} label="Без ціни продажу" value={summary.missing_sell_price_count || 0} danger={summary.missing_sell_price_count > 0} />
        <Stat icon={<AlertTriangle size={17} />} label="Нижче закупки" value={summary.below_cost_count || 0} danger={summary.below_cost_count > 0} />
        <Stat icon={<TrendingDown size={17} />} label="Низька маржа" value={summary.low_margin_count || 0} danger={summary.low_margin_count > 0} />
        <Stat icon={<Sparkles size={17} />} label="Висока маржа" value={summary.high_margin_count || 0} good={summary.high_margin_count > 0} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Розділи</p>
            <h3 className="text-lg font-black uppercase text-slate-900">Що контролюємо</h3>
          </div>
          <div className="space-y-2">
            <SideButton active={section === 'purchases'} onClick={() => setSection('purchases')} icon={<Truck size={16}/>} label="Закупівельний список" count={rows.purchases.length} />
            <SideButton active={section === 'suppliers'} onClick={() => setSection('suppliers')} icon={<ClipboardList size={16}/>} label="По постачальниках" count={bySupplier.length} />
            <SideButton active={section === 'slow'} onClick={() => setSection('slow')} icon={<ShieldAlert size={16}/>} label="Неліквід" count={rows.slow.length} />
            <SideButton active={section === 'missing'} onClick={() => setSection('missing')} icon={<AlertTriangle size={16}/>} label="Без ціни продажу" count={rows.missing.length} />
            <SideButton active={section === 'below'} onClick={() => setSection('below')} icon={<AlertTriangle size={16}/>} label="Нижче закупки" count={rows.below.length} />
            <SideButton active={section === 'low'} onClick={() => setSection('low')} icon={<TrendingDown size={16}/>} label="Низька маржа" count={rows.low.length} />
            <SideButton active={section === 'high'} onClick={() => setSection('high')} icon={<TrendingUp size={16}/>} label="Висока маржа" count={rows.high.length} />
            <SideButton active={section === 'min'} onClick={() => setSection('min')} icon={<BarChart3 size={16}/>} label="Мінімальні залишки" count={rows.minStock.length} />
          </div>
          <button type="button" onClick={onReceipt} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700">
            <Package size={15} /> До приходу
          </button>
        </aside>

        <main className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Аналітика складу</p>
              <h3 className="text-xl font-black uppercase text-slate-900">{sectionTitle(section)}</h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук по бренду, артикулу, назві..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white" />
              </div>
              {section === 'purchases' && (
                <button type="button" onClick={exportPurchases} disabled={!rows.purchases.length} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-40">
                  <Download size={15} /> CSV
                </button>
              )}
            </div>
          </div>

          {section === 'purchases' && <PurchaseList rows={rows.purchases} />}
          {section === 'suppliers' && <SupplierSummary rows={bySupplier} />}
          {section === 'slow' && <SlowList rows={rows.slow} />}
          {section === 'missing' && <MarginList rows={rows.missing} mode="missing" />}
          {section === 'below' && <MarginList rows={rows.below} mode="below" />}
          {section === 'low' && <MarginList rows={rows.low} mode="low" />}
          {section === 'high' && <MarginList rows={rows.high} mode="high" />}
          {section === 'min' && <PurchaseList rows={rows.minStock} compact />}
        </main>
      </div>
    </div>
  );
}

function sectionTitle(section) {
  return {
    purchases: 'Закупівельний список',
    suppliers: 'Потреба по постачальниках',
    slow: 'Неліквід і заморожені гроші',
    missing: 'Товари без ціни продажу',
    below: 'Продаж нижче закупки',
    low: 'Низька маржа',
    high: 'Висока маржа',
    min: 'Товари на мінімальному залишку',
  }[section] || 'Контроль складу';
}

function PurchaseList({ rows, compact = false }) {
  if (!rows.length) return <EmptyPanel text="Позицій для дозамовлення немає." />;
  return <div className="space-y-3">{rows.map((item) => <StockMoneyRow key={`${item.id}-${compact ? 'min' : 'purchase'}`} item={item} type="purchase" />)}</div>;
}

function SupplierSummary({ rows }) {
  if (!rows.length) return <EmptyPanel text="Поки немає потреби по постачальниках." />;
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <div key={row.supplier_name} className="rounded-3xl border border-blue-100 bg-blue-50/50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Постачальник</p><h4 className="mt-1 text-lg font-black text-slate-900">{row.supplier_name}</h4><div className="mt-3 grid grid-cols-2 gap-2"><Mini label="Позицій" value={row.positions} /><Mini label="К-сть" value={qty(row.reorder_qty)} /><Mini label="Закупка" value={money(row.purchase_value)} /><Mini label="Прибуток" value={money(row.expected_profit)} good /></div></div>)}</div>;
}

function SlowList({ rows }) {
  if (!rows.length) return <EmptyPanel text="Неліквіду не знайдено. Склад рухається нормально." />;
  return <div className="space-y-3">{rows.map((item) => <StockMoneyRow key={`${item.id}-slow`} item={item} type="slow" />)}</div>;
}

function MarginList({ rows, mode }) {
  if (!rows.length) return <EmptyPanel text="Позицій у цьому розділі немає." />;
  return <div className="space-y-3">{rows.map((item) => <StockMoneyRow key={`${item.id}-${mode}`} item={item} type={mode} />)}</div>;
}

function StockMoneyRow({ item, type }) {
  const isBad = type === 'below' || type === 'low' || type === 'slow' || type === 'missing' || item.missing_sell_price;
  const isGood = type === 'high';
  const hasSellPrice = item.has_sell_price !== false && !item.missing_sell_price;
  return (
    <div className={`rounded-3xl border p-4 ${isBad ? 'border-amber-100 bg-amber-50/60' : isGood ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/70'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="break-words text-lg font-black text-slate-900">{item.brand} {item.article}</p>
          <p className="mt-1 break-words text-sm font-bold text-slate-700">{item.name}</p>
          <p className="mt-1 text-[10px] font-black uppercase text-slate-400">{item.category_name || 'Без категорії'} · {item.supplier_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.needs_restock && <Pill tone="blue">Дозамовити {qty(item.reorder_qty)} шт</Pill>}
          {item.missing_sell_price && <Pill tone="amber">Ціна продажу не задана</Pill>}
          {item.below_cost && <Pill tone="red">Нижче закупки</Pill>}
          {item.low_margin && <Pill tone="amber">Низька маржа</Pill>}
          {item.high_margin && <Pill tone="emerald">Висока маржа</Pill>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
        <Mini label="На складі" value={`${qty(item.quantity)} шт`} />
        <Mini label="Доступно" value={`${qty(item.available_quantity)} шт`} good={item.available_quantity > 0} />
        <Mini label="Мінімум" value={`${qty(item.min_quantity)} шт`} />
        <Mini label="Закупка" value={money(item.buy_price)} />
        <Mini label="Продаж" value={hasSellPrice ? money(item.sell_price) : 'Не задано'} bad={!hasSellPrice} />
        <Mini label="Маржа" value={hasSellPrice ? `${money(item.margin_value)} / ${qty(item.margin_percent)}%` : '—'} good={hasSellPrice && item.margin_value > 0} bad={hasSellPrice && item.margin_value < 0} />
        <Mini label={type === 'slow' ? 'Заморожено' : 'Сума закупки'} value={money(type === 'slow' ? item.frozen_money : item.reorder_purchase_value)} bad={type === 'slow'} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <InfoLine icon={<CheckCircle2 size={14}/>} label="Продажі 90 днів" value={`${qty(item.sold_qty_90d)} шт · середньо ${qty(item.avg_monthly_sales)} / міс`} />
        <InfoLine icon={<AlertTriangle size={14}/>} label="Без продажу" value={item.days_without_sale == null ? 'Немає продажів у журналі' : `${item.days_without_sale} днів`} />
        <InfoLine icon={<BarChart3 size={14}/>} label="Останній рух" value={fmtDate(item.last_movement_at)} />
      </div>
    </div>
  );
}

function HeroMetric({ label, value, danger, good }) {
  return <div className="rounded-3xl border border-white/10 bg-white/10 p-4"><p className="text-[10px] font-black uppercase text-blue-200">{label}</p><p className={`mt-1 text-xl font-black ${danger ? 'text-rose-200' : good ? 'text-emerald-200' : 'text-white'}`}>{value}</p></div>;
}

function Stat({ icon, label, value, danger, good }) {
  return <div className={`rounded-3xl border bg-white p-4 shadow-sm ${danger ? 'border-rose-100' : good ? 'border-emerald-100' : 'border-slate-100'}`}><div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${danger ? 'bg-rose-50 text-rose-600' : good ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{icon}</div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${danger ? 'text-rose-600' : good ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</p></div>;
}

function Mini({ label, value, good, bad }) {
  return <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 truncate text-xs font-black ${bad ? 'text-rose-600' : good ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</p></div>;
}

function InfoLine({ icon, label, value }) {
  return <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold text-slate-500"><span className="text-blue-600">{icon}</span><span className="text-slate-400">{label}:</span><span className="font-black text-slate-700">{value}</span></div>;
}

function SideButton({ active, onClick, icon, label, count }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-xs font-black uppercase transition ${active ? 'bg-slate-950 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}><span className="inline-flex items-center gap-2">{icon}{label}</span><span className={`rounded-lg px-2 py-0.5 ${active ? 'bg-white/15 text-white' : 'bg-white text-slate-400'}`}>{count || 0}</span></button>;
}

function Pill({ children, tone }) {
  const cls = tone === 'red' ? 'bg-rose-100 text-rose-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700';
  return <span className={`inline-flex rounded-xl px-3 py-1 text-[10px] font-black uppercase ${cls}`}>{children}</span>;
}

function EmptyPanel({ text }) {
  return <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">{text}</div>;
}
