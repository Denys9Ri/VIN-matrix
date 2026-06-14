import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  Calculator,
  Camera,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Copy,
  FileDown,
  FileText,
  Hash,
  Info,
  Loader2,
  Package,
  Phone,
  Plus,
  Printer,
  ScanLine,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import VisitCard from '../components/visits/VisitCard';
import VisitWorkflowPanel from '../components/crm/VisitWorkflowPanel';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppPage, PageHeader, Tabs, useToast } from '../components/ui';

const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';
const emptyCarData = { brand: '', model: '', year: '', engine: '', fuel: '', mileage: '', engine_volume: '', engine_power: '', engine_code: '', engine_review_status: 'manual' };
const emptyManualPart = { name: '', brand: '', article: '', supplier: '', buy_price: '', sell_price: '', quantity: 1, status: 'WAITING' };
const emptyRecommendation = { title: '', description: '', due_date: '', due_mileage: '' };
const arr = (v) => (Array.isArray(v) ? v : []);
const visitId = (v) => v?.id ?? v?.visit_id ?? v?.pk ?? '';
const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const servicesOf = (v) => arr(v?.services || v?.orderservice_set);
const partsOf = (v) => arr(v?.parts || v?.items);
const recommendationsOf = (v) => arr(v?.recommendations || []);
const servicesTotal = (v) => servicesOf(v).reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 1), 0);
const partsTotal = (v) => partsOf(v).reduce((s, x) => s + Number(x.sell_price || x.price || 0) * Number(x.quantity || 1), 0);
const totalOf = (v) => servicesTotal(v) + partsTotal(v);
const dateISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const humanDate = (value) => {
  if (!value) return 'Усі дати';
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? 'Усі дати' : d.toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: 'long' });
};
const timeParts = (raw) => {
  const d = raw ? new Date(raw) : new Date();
  if (Number.isNaN(d.getTime())) return { date: dateISO(), time: '' };
  return { date: dateISO(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
};
const cleanNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
const hasText = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const listOf = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};
const entityId = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') return value.id ?? value.user_id ?? value.pk ?? '';
  return value;
};
const asIdString = (value) => {
  const id = entityId(value);
  return id === undefined || id === null ? '' : String(id);
};
const findById = (items, value) => {
  const id = asIdString(value);
  if (!id) return null;
  return arr(items).find((item) => asIdString(item.id ?? item.user_id ?? item.pk) === id) || null;
};
const mechanicName = (mechanic) => {
  if (!mechanic) return '—';
  return mechanic.full_name || mechanic.name || mechanic.first_name || mechanic.username || mechanic.email || `Майстер #${mechanic.id}`;
};
const mechanicLabel = (value, mechanics = []) => {
  if (!value) return '—';
  if (typeof value === 'object') return mechanicName(value);
  const found = findById(mechanics, value);
  return found ? mechanicName(found) : String(value || '—');
};
const workPostName = (post) => {
  if (!post) return '—';
  return post.name || post.title || `Пост #${post.id}`;
};
const workPostLabel = (value, posts = []) => {
  if (!value) return '—';
  if (typeof value === 'object') return workPostName(value);
  const found = findById(posts, value);
  return found ? workPostName(found) : String(value || '—');
};
const visitWorkPostId = (visit) => asIdString(visit?.work_post ?? visit?.work_post_id);
const visitMechanicId = (visit) => asIdString(visit?.responsible_mechanic ?? visit?.responsible_mechanic_id);
const mechanicDefaultPercent = (mechanic) => {
  const value = mechanic?.commission_percent ?? mechanic?.default_commission_percent ?? '';
  return value === null || value === undefined ? '' : String(value);
};
const servicePayrollTotal = (service) => Number(service?.commission_amount || service?.mechanic_amount || 0);
const servicesPayrollTotal = (visit) => servicesOf(visit).reduce((sum, service) => sum + servicePayrollTotal(service), 0);


const readCarData = (visit) => {
  if (!visit?.delivery_data || typeof visit.delivery_data !== 'string' || !visit.delivery_data.trim().startsWith('{')) return { ...emptyCarData };
  try { return { ...emptyCarData, ...JSON.parse(visit.delivery_data) }; } catch { return { ...emptyCarData }; }
};

const cleanScan = (data = {}) => ({
  plate: data.plate || '',
  vin_code: data.vin_code || data.vin || '',
  vin_candidate: data.vin_candidate || '',
  brand: data.brand || '',
  model: data.model || '',
  year: data.year || '',
  engine: data.engine || data.engine_volume || data.volume || '',
  engine_volume: data.engine_volume || data.volume || data.engine || '',
  engine_power: data.engine_power || data.power || data.kw || '',
  engine_code: data.engine_code || data.engine_number || data.motor_code || '',
  fuel: data.fuel || '',
  document_side: data.document_side || 'unknown',
  warnings: data.warnings || [],
  engine_review_status: data.engine_review_status || 'needs_review',
});

const mergeScanInto = (base = {}, scan = {}) => {
  const s = cleanScan(scan);
  return {
    ...base,
    plate: s.plate || base.plate || '',
    vin_code: s.vin_code || base.vin_code || '',
    brand: s.brand || base.brand || '',
    model: s.model || base.model || '',
    year: base.year || s.year || '',
    engine: s.engine || s.engine_volume || base.engine || '',
    engine_volume: s.engine_volume || s.engine || base.engine_volume || base.engine || '',
    engine_power: s.engine_power || base.engine_power || '',
    engine_code: s.engine_code || base.engine_code || '',
    fuel: s.fuel || base.fuel || '',
    engine_review_status: (s.engine || s.engine_volume || s.engine_power || s.engine_code) ? 'needs_review' : (base.engine_review_status || 'manual'),
  };
};

const visitDate = (visit) => {
  const raw = visit?.scheduled_datetime || visit?.updated_at || visit?.created_at;
  if (!raw) return 'Без дати';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 'Без дати' : d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const supplierBadge = (part = {}) => {
  const key = part.supplier_color || '';
  const supplier = String(part.supplier || '').toUpperCase();
  const normalized = key || (supplier.includes('BM') ? 'supplier-bm' : supplier.includes('OMEGA') ? 'supplier-omega' : supplier.includes('VESNA') ? 'supplier-vesna' : supplier.includes('ТЕХНО') ? 'supplier-tehnomir' : 'supplier-default');
  const styles = {
    'supplier-bm': 'bg-slate-900 text-white border-slate-800',
    'supplier-vesna': 'bg-emerald-600 text-white border-emerald-600',
    'supplier-omega': 'bg-blue-600 text-white border-blue-600',
    'supplier-tehnomir': 'bg-rose-600 text-white border-rose-600',
    'supplier-local': 'bg-amber-100 text-amber-800 border-amber-200',
    'supplier-default': 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return styles[normalized] || styles['supplier-default'];
};

const partCounts = (visit) => {
  const result = { WAITING: 0, IN_TRANSIT: 0, ARRIVED: 0, UNAVAILABLE: 0 };
  partsOf(visit).forEach((p) => { const key = p.status || p.logistics_status || 'WAITING'; result[key] = (result[key] || 0) + 1; });
  return result;
};

const recommendationUrgency = (rec) => {
  if (rec.status === 'done') return { label: 'Виконано', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  if (!rec.due_date) return { label: 'Планово', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(`${rec.due_date}T12:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  if (days <= 0) return { label: 'Терміново', cls: 'bg-rose-50 text-rose-700 border-rose-100' };
  if (days <= 14) return { label: 'Скоро', cls: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: 'Планово', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
};


const STO_DICTIONARY_PATCH = true;
const fallbackStoVisitStatuses = [
  { key: 'SELECTION', label: 'В черзі / Підбір', semantic_role: 'new', color: 'amber', icon: 'clock', sort_order: 10, metadata: { show_on_board: true } },
  { key: 'ORDERED', label: 'В роботі', semantic_role: 'in_progress', color: 'blue', icon: 'wrench', sort_order: 20, metadata: { show_on_board: true } },
  { key: 'WAITING_PARTS', label: 'Чекаємо запчастини', semantic_role: 'waiting', color: 'amber', icon: 'clock', sort_order: 30, metadata: { show_on_board: true } },
  { key: 'DONE', label: 'Готово', semantic_role: 'ready', color: 'emerald', icon: 'check-circle', sort_order: 40, metadata: { show_on_board: true } },
];
const stoStatusAliases = {
  new: ['SELECTION', 'PENDING', 'DRAFT'],
  in_progress: ['ORDERED', 'IN_PROGRESS'],
  waiting: ['WAITING_PARTS'],
  ready: ['DONE'],
  done: ['COMPLETED', 'ISSUED'],
  cancelled: ['CANCELLED'],
};
const stoColumnVariant = (status) => {
  const role = status?.semantic_role;
  const color = status?.color;
  if (['ready', 'done'].includes(role) || color === 'emerald') return 'done';
  if (['in_progress', 'waiting'].includes(role) || ['blue', 'indigo', 'cyan'].includes(color)) return 'progress';
  return 'pending';
};
const stoColumnIcon = (status) => {
  const role = status?.semantic_role;
  const icon = status?.icon;
  if (['ready', 'done'].includes(role) || ['check-circle', 'badge-check'].includes(icon)) return <CheckCircle2 size={18} />;
  if (role === 'in_progress' || icon === 'wrench') return <Wrench size={18} />;
  return <Clock size={18} />;
};
const stoStatusMatches = (visitStatus, option) => {
  const aliases = [...(stoStatusAliases[option?.semantic_role] || []), option?.key].filter(Boolean);
  return aliases.includes(visitStatus);
};
const stoStatusLabel = (statuses, key) => {
  const all = [...(Array.isArray(statuses) ? statuses : []), ...fallbackStoVisitStatuses];
  return all.find((status) => status.key === key)?.label || key || 'SELECTION';
};

const workflowFilled = (data, type) => {
  if (!data || !data.id) return false;
  if (type === 'acceptance') return ['mileage', 'fuel_level', 'exterior_note', 'interior_note', 'damages', 'customer_complaint', 'note'].some((k) => hasText(data[k]));
  if (type === 'diagnostic') {
    if (hasText(data.summary)) return true;
    const checklist = data.checklist || {};
    return Object.values(checklist).some((item) => hasText(item?.note));
  }
  return false;
};

export default function Visits() {
  const navigate = useNavigate();
  const uiToast = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [visits, setVisits] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [workPosts, setWorkPosts] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [settings, setSettings] = useState({ role: 'owner', permissions: {}, company: {} });
  const [stoVisitStatuses, setStoVisitStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState(dateISO());
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visitTab, setVisitTab] = useState('overview');
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const [newVisitData, setNewVisitData] = useState({ plate: '', vin_code: '', client: '', phone: '', date: dateISO(), time: '', work_post: '', responsible_mechanic: '', delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', ...emptyCarData });
  const [scanDraft, setScanDraft] = useState(null);
  const [passportScanDraft, setPassportScanDraft] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [editCarData, setEditCarData] = useState({ ...emptyCarData });
  const [editComment, setEditComment] = useState('');
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: '', quantity: 1, mechanic: '', commission_percent: '', commission_base: '' });
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [showManualPartForm, setShowManualPartForm] = useState(false);
  const [manualPart, setManualPart] = useState({ ...emptyManualPart });
  const [recommendations, setRecommendations] = useState([]);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [newRecommendation, setNewRecommendation] = useState({ ...emptyRecommendation });
  const [workflowInfo, setWorkflowInfo] = useState({ acceptance: {}, diagnostic: {} });
  const [toast, setToast] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [foundExisting, setFoundExisting] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const passportScanInputRef = useRef(null);
  const token = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };
  const isStore = settings.company?.business_type === 'store';


  const fetchStoVisitStatuses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/settings/dictionaries/?mode=sto`, { headers });
      const list = Array.isArray(res.data?.sto_visit_status) ? res.data.sto_visit_status : [];
      setStoVisitStatuses(list.length ? list : fallbackStoVisitStatuses);
    } catch {
      setStoVisitStatuses(fallbackStoVisitStatuses);
    }
  };

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterDate) params.append('date', filterDate);
      const [visitsRes, settingsRes, servicesRes, workPostsRes, mechanicsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/?${params.toString()}`, { headers }),
        axios.get(`${API_BASE}/api/settings/`, { headers }),
        axios.get(`${API_BASE}/api/services/`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/work-posts/`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/mechanics/`, { headers }).catch(() => ({ data: [] })),
      ]);
      setVisits(listOf(visitsRes.data));
      setSettings(settingsRes.data || { role: 'owner', permissions: {}, company: {} });
      setCatalogServices(listOf(servicesRes.data));
      setWorkPosts(listOf(workPostsRes.data));
      setMechanics(listOf(mechanicsRes.data));
      if (searchParams.get('scan') === 'true') setIsCreatingVisit(true);
    } catch (e) {
      if (e.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t); }, [searchQuery, filterDate]);
  useEffect(() => { fetchStoVisitStatuses(); }, []);
  useEffect(() => {
    const data = location.state?.scannedData || location.state?.repeatVisitData;
    if (data) {
      const cleaned = cleanScan(data);
      setNewVisitData((prev) => mergeScanInto(prev, cleaned));
      setScanDraft((prev) => mergeScanInto(prev || newVisitData, cleaned));
      setIsCreatingVisit(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  useEffect(() => {
    if (selectedVisit) {
      setVisitTab('overview');
      setEditComment(selectedVisit.comment || '');
      setEditCarData(readCarData(selectedVisit));
      setPassportScanDraft(null);
      setShowManualPartForm(false);
      setShowRecommendationForm(false);
      setManualPart({ ...emptyManualPart });
      setNewService({
        name: '',
        price: '',
        quantity: 1,
        mechanic: visitMechanicId(selectedVisit),
        commission_percent: '',
        commission_base: '',
      });
      setNewRecommendation({ ...emptyRecommendation });
      fetchRecommendations(selectedVisit);
      fetchWorkflowInfo(selectedVisit);
    }
  }, [selectedVisit?.id]);

  const fetchRecommendations = async (visit) => {
    if (!visit?.id) return;
    try {
      const res = await axios.get(`${API_BASE}/api/recommendations/?visit=${visit.id}`, { headers });
      setRecommendations(listOf(res.data));
    } catch {
      setRecommendations(recommendationsOf(visit));
    }
  };

  const fetchWorkflowInfo = async (visit) => {
    if (!visit?.id) return;
    try {
      const [acceptanceRes, diagnosticRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visit-acceptance-act/?visit=${visit.id}`, { headers }).catch(() => ({ data: {} })),
        axios.get(`${API_BASE}/api/visit-diagnostic-checklist/?visit=${visit.id}`, { headers }).catch(() => ({ data: {} })),
      ]);
      setWorkflowInfo({ acceptance: acceptanceRes.data || {}, diagnostic: diagnosticRes.data || {} });
    } catch {
      setWorkflowInfo({ acceptance: {}, diagnostic: {} });
    }
  };

  const changeBoardDate = (days) => {
    const base = filterDate ? new Date(`${filterDate}T12:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    setFilterDate(dateISO(base));
  };

  const recognizeDocument = async (file) => {
    const dataUrl = await new Promise((resolve) => { const r = new FileReader(); r.onload = (e) => resolve(e.target.result); r.readAsDataURL(file); });
    const img = await new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.src = dataUrl; });
    const canvas = document.createElement('canvas');
    const max = 1200;
    let { width, height } = img;
    if (width > height && width > max) { height *= max / width; width = max; }
    if (height >= width && height > max) { width *= max / height; height = max; }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    const formData = new FormData();
    formData.append('document', blob, 'scan.jpg');
    const res = await axios.post(`${API_BASE}/api/visits/recognize_document/`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
    if (!res.data?.success) throw new Error('scan_failed');
    return cleanScan(res.data);
  };

  const scanNewVisit = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const scan = await recognizeDocument(file);
      setScanDraft((prev) => mergeScanInto(prev || newVisitData, scan));
    } catch {
      uiToast.error('Помилка сканування. Спробуйте інший ракурс.');
    } finally {
      setIsScanning(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const scanExistingVisit = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const scan = await recognizeDocument(file);
      setPassportScanDraft((prev) => mergeScanInto(prev || editCarData, scan));
      setVisitTab('passport');
    } catch {
      uiToast.error('Помилка сканування. Спробуйте інший ракурс.');
    } finally {
      setIsScanning(false);
      if (passportScanInputRef.current) passportScanInputRef.current.value = '';
    }
  };

  const acceptNewScan = () => { if (!scanDraft) return; setNewVisitData((prev) => mergeScanInto(prev, scanDraft)); setScanDraft(null); };
  const acceptPassportScan = () => { if (!passportScanDraft) return; setEditCarData((prev) => mergeScanInto(prev, passportScanDraft)); if (passportScanDraft.plate) patchVisit('plate', passportScanDraft.plate.toUpperCase()); if (passportScanDraft.vin_code) patchVisit('vin_code', passportScanDraft.vin_code.toUpperCase()); setPassportScanDraft(null); };

  const handlePlateBlur = async () => {
    if (!String(newVisitData.plate || '').trim() || String(newVisitData.plate || '').length < 3) return;
    try {
      const res = await axios.get(`${API_BASE}/api/visits/?search=${newVisitData.plate}`, { headers });
      const existing = listOf(res.data).find((v) => v.plate?.toUpperCase() === newVisitData.plate.toUpperCase());
      if (existing) {
        setNewVisitData((p) => ({ ...p, client: existing.client, phone: existing.phone, vin_code: existing.vin_code || p.vin_code }));
        setFoundExisting(true);
        setTimeout(() => setFoundExisting(false), 3500);
      }
    } catch {}
  };

  const createVisit = async (e) => {
    e.preventDefault();
    const carPayload = { brand: newVisitData.brand, model: newVisitData.model, year: newVisitData.year, engine: newVisitData.engine || newVisitData.engine_volume, fuel: newVisitData.fuel, mileage: newVisitData.mileage || '', engine_volume: newVisitData.engine_volume || newVisitData.engine || '', engine_power: newVisitData.engine_power || '', engine_code: newVisitData.engine_code || '', engine_review_status: newVisitData.engine_review_status || 'manual' };
    const payload = {
      plate: newVisitData.plate.toUpperCase(),
      vin_code: newVisitData.vin_code,
      client: newVisitData.client,
      phone: newVisitData.phone,
      scheduled_datetime: !isStore && newVisitData.date && newVisitData.time ? new Date(`${newVisitData.date}T${newVisitData.time}`).toISOString() : null,
      work_post: !isStore && newVisitData.work_post ? Number(newVisitData.work_post) : null,
      responsible_mechanic: !isStore && newVisitData.responsible_mechanic ? Number(newVisitData.responsible_mechanic) : null,
      delivery_type: 'pickup',
      delivery_data: JSON.stringify(carPayload),
      payment_status: 'unpaid',
      prepayment_amount: 0,
    };
    try {
      await axios.post(`${API_BASE}/api/visits/`, payload, { headers });
      setIsCreatingVisit(false);
      setScanDraft(null);
      setNewVisitData({ plate: '', vin_code: '', client: '', phone: '', date: dateISO(), time: '', work_post: '', responsible_mechanic: '', delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', ...emptyCarData });
      fetchData();
    } catch {
      uiToast.error('Помилка створення');
    }
  };

  const patchVisit = async (field, value) => { await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { [field]: value }, { headers }); setSelectedVisit((p) => ({ ...p, [field]: value })); fetchData(); };
  const saveCarData = async () => { await patchVisit('delivery_data', JSON.stringify({ ...emptyCarData, ...editCarData, engine_volume: editCarData.engine_volume || editCarData.engine || '' })); };
  const refreshSelected = async () => { if (!selectedVisit?.id) return; const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers }); setSelectedVisit(res.data); fetchData(); fetchRecommendations(res.data); fetchWorkflowInfo(res.data); };

  const addService = async (e) => {
    e.preventDefault();
    const payload = {
      visit: selectedVisit.id,
      name: newService.name,
      price: Number(newService.price || 0),
      quantity: Number(newService.quantity || 1),
      commission_base: newService.commission_base,
    };

    const allowedCommissionBases = ['services_only', 'services_and_parts_profit', 'order_profit', 'fixed'];
    if (!allowedCommissionBases.includes(payload.commission_base)) delete payload.commission_base;

    if (newService.mechanic) payload.mechanic = Number(newService.mechanic);
    if (newService.commission_percent !== '' && newService.commission_percent !== null && newService.commission_percent !== undefined) {
      payload.commission_percent = Number(newService.commission_percent);
    }

    try {
      await axios.post(`${API_BASE}/api/order-services/`, payload, { headers });
      setNewService({ name: '', price: '', quantity: 1, mechanic: visitMechanicId(selectedVisit), commission_percent: '', commission_base: '' });
      setSelectedCatalogId('');
      setShowServiceForm(false);
      refreshSelected();
    } catch {
      uiToast.error('Помилка додавання роботи');
    }
  };

  const addManualPart = async (e) => {
    e.preventDefault();
    const payload = {
      visit: selectedVisit.id,
      name: manualPart.name.trim(),
      brand: (manualPart.brand || 'Без бренду').trim(),
      article: (manualPart.article || 'manual').trim(),
      supplier: (manualPart.supplier || 'Ручне додавання').trim(),
      supplier_color: 'supplier-local',
      is_local: true,
      buy_price: cleanNumber(manualPart.buy_price, 0),
      sell_price: cleanNumber(manualPart.sell_price, 0),
      quantity: cleanNumber(manualPart.quantity, 1),
      status: manualPart.status || 'WAITING',
    };
    try {
      await axios.post(`${API_BASE}/api/order-parts/`, payload, { headers });
      setManualPart({ ...emptyManualPart });
      setShowManualPartForm(false);
      refreshSelected();
    } catch (error) {
      console.error(error.response?.data || error);
      uiToast.error('Помилка додавання запчастини вручну. Перевірте поля.');
    }
  };

  const addRecommendation = async (e) => {
    e.preventDefault();
    const car = `${editCarData.brand || ''} ${editCarData.model || ''}`.trim();
    try {
      await axios.post(`${API_BASE}/api/recommendations/`, {
        visit: selectedVisit.id,
        client: selectedVisit.client,
        phone: selectedVisit.phone,
        plate: selectedVisit.plate,
        car,
        title: newRecommendation.title,
        description: newRecommendation.description,
        due_date: newRecommendation.due_date || null,
        due_mileage: newRecommendation.due_mileage ? Number(newRecommendation.due_mileage) : null,
        status: 'active',
      }, { headers });
      setNewRecommendation({ ...emptyRecommendation });
      setShowRecommendationForm(false);
      fetchRecommendations(selectedVisit);
    } catch (error) {
      console.error(error.response?.data || error);
      uiToast.error('Не вдалося додати рекомендацію.');
    }
  };

  const markRecommendationDone = async (id) => {
    try {
      await axios.post(`${API_BASE}/api/recommendations/${id}/mark-done/`, {}, { headers });
      fetchRecommendations(selectedVisit);
    } catch {
      uiToast.error('Не вдалося позначити рекомендацію виконаною.');
    }
  };

  const postponeRecommendation = async (rec) => {
    const base = rec.due_date ? new Date(`${rec.due_date}T12:00:00`) : new Date();
    base.setDate(base.getDate() + 30);
    try {
      await axios.patch(`${API_BASE}/api/recommendations/${rec.id}/`, { due_date: dateISO(base), status: 'active' }, { headers });
      fetchRecommendations(selectedVisit);
    } catch {
      uiToast.error('Не вдалося відкласти рекомендацію.');
    }
  };

  const copyText = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} скопійовано`);
      setTimeout(() => setToast(''), 2200);
    } catch {
      uiToast.warning('Не вдалося скопіювати автоматично. Виділіть значення вручну.');
    }
  };

  const askConfirm = ({ title, message, confirmLabel = 'Підтвердити', tone = 'danger', onConfirm }) => {
    setConfirmDialog({ title, message, confirmLabel, tone, onConfirm });
  };

  const deleteService = (id) => {
    askConfirm({
      title: 'Видалити роботу?',
      message: 'Робота буде прибрана з візиту. Сума візиту перерахується після оновлення.',
      confirmLabel: 'Видалити роботу',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers });
          uiToast.success('Роботу видалено.');
          refreshSelected();
        } catch {
          uiToast.error('Не вдалося видалити роботу.');
        }
      },
    });
  };

  const deletePart = (id) => {
    askConfirm({
      title: 'Видалити запчастину?',
      message: 'Запчастина буде прибрана з візиту. Якщо вона була пов’язана зі складом, перевірте резерв після видалення.',
      confirmLabel: 'Видалити запчастину',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers });
          uiToast.success('Запчастину видалено.');
          refreshSelected();
        } catch {
          uiToast.error('Не вдалося видалити запчастину.');
        }
      },
    });
  };

  const updatePartStatus = async (id, status) => { await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status }, { headers }); refreshSelected(); };
  const printPdf = async () => { const w = window.open('', '_blank'); if (!w) return; try { const r = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/pdf/`, { headers, responseType: 'text' }); w.document.write(r.data); w.document.close(); } catch { w.close(); uiToast.error('Не вдалося згенерувати документ'); } };
  const cancelVisit = () => {
    askConfirm({
      title: 'Скасувати запис?',
      message: 'Візит буде скасовано/видалено з дошки. Цю дію варто виконувати тільки якщо запис справді більше не потрібен.',
      confirmLabel: 'Скасувати запис',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers });
          uiToast.success('Запис скасовано.');
          setSelectedVisit(null);
          fetchData();
        } catch {
          uiToast.error('Не вдалося скасувати запис.');
        }
      },
    });
  };

  const boardVisits = listOf(visits);
  const boardStatuses = useMemo(() => {
    const active = listOf(stoVisitStatuses)
      .filter((status) => status.is_active !== false)
      .filter((status) => status.metadata?.show_on_board !== false)
      .filter((status) => !['cancelled'].includes(status.semantic_role));
    const source = active.length ? active : fallbackStoVisitStatuses;
    return [...source].sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100));
  }, [stoVisitStatuses]);

  const grouped = useMemo(() => boardStatuses.map((status) => ({
    key: status.key,
    title: status.label || status.key,
    variant: stoColumnVariant(status),
    icon: stoColumnIcon(status),
    items: boardVisits.filter((visit) => stoStatusMatches(visit.status, status)),
  })), [boardStatuses, boardVisits]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <AppPage>
      <div className="w-full max-w-[1500px] mx-auto space-y-6 pb-16">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <PageHeader
            title={isStore ? 'Дошка замовлень' : 'Дошка візитів'}
            subtitle={isStore ? 'Замовлення, оплати, доставка і швидкий продаж в одному робочому екрані.' : 'Записи, пости, майстри, роботи, запчастини і документи в одному робочому екрані.'}
            icon={<ClipboardList />}
          />
          <button
            onClick={() => setIsCreatingVisit(true)}
            className="w-full sm:w-auto min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition leading-tight whitespace-nowrap"
          >
            <Plus size={18} className="shrink-0" />
            <span>{isStore ? 'Нове замовлення' : 'Новий візит'}</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-[28px] p-3 md:p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1 min-w-0">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isStore ? 'Пошук: №, телефон, клієнт, ТТН, артикул...' : 'Пошук: ID, номер авто, клієнт, телефон, VIN...'}
                className="w-full min-h-[52px] bg-slate-50 border-2 border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm md:text-base font-extrabold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition placeholder:text-slate-400 placeholder:font-bold"
              />
            </div>
            <DateNavigator value={filterDate} setValue={setFilterDate} onPrev={() => changeBoardDate(-1)} onNext={() => changeBoardDate(1)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {grouped.map((column) => (
            <Column key={column.key} variant={column.variant} title={column.title} items={column.items} icon={column.icon} onOpen={setSelectedVisit} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />
          ))}
        </div>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-black shadow-xl">{toast}</div>}
      {isCreatingVisit && <CreateVisitModal data={newVisitData} setData={setNewVisitData} onClose={() => { setIsCreatingVisit(false); setScanDraft(null); }} onSubmit={createVisit} onPlateBlur={handlePlateBlur} foundExisting={foundExisting} isScanning={isScanning} cameraRef={cameraInputRef} galleryRef={galleryInputRef} onScan={scanNewVisit} scanDraft={scanDraft} setScanDraft={setScanDraft} onAcceptScan={acceptNewScan} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />}
      {selectedVisit && <VisitModal visit={selectedVisit} setVisit={setSelectedVisit} tab={visitTab} setTab={setVisitTab} carData={editCarData} setCarData={setEditCarData} onSaveCar={saveCarData} scanRef={passportScanInputRef} onScan={scanExistingVisit} scanDraft={passportScanDraft} setScanDraft={setPassportScanDraft} onAcceptScan={acceptPassportScan} isScanning={isScanning} onPatch={patchVisit} onPrint={printPdf} onCancel={cancelVisit} catalogServices={catalogServices} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} showServiceForm={showServiceForm} setShowServiceForm={setShowServiceForm} newService={newService} setNewService={setNewService} onAddService={addService} onDeleteService={deleteService} onDeletePart={deletePart} onUpdatePartStatus={updatePartStatus} editComment={editComment} setEditComment={setEditComment} showManualPartForm={showManualPartForm} setShowManualPartForm={setShowManualPartForm} manualPart={manualPart} setManualPart={setManualPart} onAddManualPart={addManualPart} recommendations={recommendations} showRecommendationForm={showRecommendationForm} setShowRecommendationForm={setShowRecommendationForm} newRecommendation={newRecommendation} setNewRecommendation={setNewRecommendation} onAddRecommendation={addRecommendation} onRecommendationDone={markRecommendationDone} onRecommendationPostpone={postponeRecommendation} workflowInfo={workflowInfo} stoVisitStatuses={boardStatuses} stoStatusLabel={(key) => stoStatusLabel(boardStatuses, key)} onCopy={copyText} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />}
      {confirmDialog && <ConfirmActionModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}
    </AppPage>
  );
}

function DateNavigator({ value, setValue, onPrev, onNext }) {
  return (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-1.5 shadow-sm w-full lg:w-[300px] shrink-0">
      <div className="grid grid-cols-[46px_1fr_46px] items-center gap-1.5">
        <button type="button" onClick={onPrev} className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:border-blue-300 hover:text-blue-600 transition">
          <ChevronLeft size={18} />
        </button>
        <label className="relative block min-w-0 h-11 rounded-xl bg-white border border-slate-200 px-3 py-1 cursor-pointer hover:border-blue-300 transition">
          <span className="block text-[10px] font-black uppercase text-slate-400 text-center leading-none">Дата дошки</span>
          <input type="date" value={value} onChange={(e) => setValue(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
          <span className="block text-center text-sm font-black text-slate-900 truncate mt-1">{humanDate(value)}</span>
        </label>
        <button type="button" onClick={onNext} className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:border-blue-300 hover:text-blue-600 transition">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
function Column({ title, icon, items = [], onOpen, isStore, workPosts = [], mechanics = [], variant = 'pending' }) {
  const safeItems = listOf(items);
  const styles = {
    pending: { box: 'from-amber-50 to-white border-amber-100', text: 'text-amber-700', badge: 'bg-amber-100' },
    progress: { box: 'from-blue-50 to-white border-blue-100', text: 'text-blue-700', badge: 'bg-blue-100' },
    done: { box: 'from-emerald-50 to-white border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100' },
  };
  const s = styles[variant] || styles.pending;

  return (
    <div className={`bg-gradient-to-br ${s.box} rounded-3xl p-4 border shadow-sm`}>
      <h3 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 ${s.text}`}>
        {icon} {title}
        <span className={`ml-auto px-3 py-1 rounded-xl shadow-sm text-slate-800 ${s.badge}`}>{safeItems.length}</span>
      </h3>

      <div className="space-y-4">
        {safeItems.map((v) => {
          const post = workPostLabel(v.work_post_name || v.work_post_label || v.work_post, workPosts);
          const mechanic = mechanicLabel(v.responsible_mechanic_name || v.responsible_mechanic_label || v.responsible_mechanic, mechanics);
          const showStoMeta = !isStore && (post !== '—' || mechanic !== '—');

          return (
            <div key={v.id} className="space-y-2">
              <VisitCard visit={v} onClick={() => onOpen(v)} isStore={isStore} />
              {showStoMeta && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
                  {post !== '—' && (
                    <button type="button" onClick={() => onOpen(v)} className="bg-white/80 border border-slate-100 rounded-xl px-3 py-2 text-left text-[11px] font-black uppercase text-slate-500 hover:border-blue-200 transition-colors">
                      Пост: <span className="text-slate-800">{post}</span>
                    </button>
                  )}
                  {mechanic !== '—' && (
                    <button type="button" onClick={() => onOpen(v)} className="bg-white/80 border border-slate-100 rounded-xl px-3 py-2 text-left text-[11px] font-black uppercase text-slate-500 hover:border-blue-200 transition-colors">
                      Майстер: <span className="text-slate-800">{mechanic}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {safeItems.length === 0 && <div className="text-center text-slate-400 text-xs font-black uppercase py-10 bg-white/60 rounded-2xl">Пусто</div>}
      </div>
    </div>
  );
}
function CreateVisitModal({
  data,
  setData,
  onClose,
  onSubmit,
  onPlateBlur,
  foundExisting,
  isScanning,
  cameraRef,
  galleryRef,
  onScan,
  scanDraft,
  setScanDraft,
  onAcceptScan,
  isStore,
  workPosts,
  mechanics,
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl mx-auto my-6 p-5 md:p-6 relative shadow-2xl">
        {isScanning && <ScanOverlay />}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-xl"><X size={18} /></button>
        <h2 className="text-2xl font-black uppercase mb-4">Новий візит</h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Camera size={16} /> Камера</button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-xl py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><ScanLine size={16} /> Фото</button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onScan} className="hidden" />
            <input ref={galleryRef} type="file" accept="image/*" onChange={onScan} className="hidden" />
          </div>

          {scanDraft && <ScanReviewCard data={scanDraft} setData={setScanDraft} onApply={onAcceptScan} onCancel={() => setScanDraft(null)} />}

          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Дата візиту" type="date" required value={data.date} onChange={(v) => setData({ ...data, date: v })} />
            <LabeledInput label="Час візиту" type="time" required value={data.time} onChange={(v) => setData({ ...data, time: v })} />
          </div>

          {!isStore && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-[11px] font-black uppercase text-blue-500 tracking-widest mb-3">Пост і майстер</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LabeledSelect label="Пост / підйомник" value={data.work_post} onChange={(v) => setData({ ...data, work_post: v })}>
                  <option value="">Не обрано</option>
                  {arr(workPosts).filter((post) => post.is_active !== false).map((post) => <option key={post.id} value={post.id}>{workPostName(post)}</option>)}
                </LabeledSelect>

                <LabeledSelect label="Відповідальний майстер" value={data.responsible_mechanic} onChange={(v) => setData({ ...data, responsible_mechanic: v })}>
                  <option value="">Не обрано</option>
                  {arr(mechanics).filter((mechanic) => mechanic.is_active !== false).map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanicName(mechanic)}</option>)}
                </LabeledSelect>
              </div>
              <p className="text-[11px] font-bold text-blue-700 mt-3">
                Це допоможе рахувати завантаження постів і зарплату майстрів в аналітиці.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LabeledInput label="ПІБ клієнта" required value={data.client} onChange={(v) => setData({ ...data, client: v })} />
            <LabeledInput label="Телефон" required value={data.phone} onChange={(v) => setData({ ...data, phone: v })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LabeledInput label="Держ. номер" required value={data.plate} onBlur={onPlateBlur} onChange={(v) => setData({ ...data, plate: v.toUpperCase() })} hint={foundExisting ? '✓ Знайдено в базі' : ''} />
            <LabeledInput label="VIN" value={data.vin_code} onChange={(v) => setData({ ...data, vin_code: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) })} />
          </div>

          <CarFields data={data} setData={setData} />
          <button className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black uppercase text-xs">Створити візит</button>
        </form>
      </div>
    </div>
  );
}


const openDocumentPackage = (visit, isStore) => {
  const id = String(visitId(visit) || '').trim();
  if (!id) return;
  window.dispatchEvent(new CustomEvent('vinmatrix:open-documents', {
    detail: {
      id,
      mode: isStore ? 'store' : 'sto',
      title: `${isStore ? 'Замовлення' : 'Візит'} №${id}`,
    },
  }));
};

function VisitModal({ visit, setVisit, tab, setTab, carData, setCarData, onSaveCar, scanRef, onScan, scanDraft, setScanDraft, onAcceptScan, isScanning, onPatch, onPrint, onCancel, catalogServices, selectedCatalogId, setSelectedCatalogId, showServiceForm, setShowServiceForm, newService, setNewService, onAddService, onDeleteService, onDeletePart, onUpdatePartStatus, editComment, setEditComment, showManualPartForm, setShowManualPartForm, manualPart, setManualPart, onAddManualPart, recommendations, showRecommendationForm, setShowRecommendationForm, newRecommendation, setNewRecommendation, onAddRecommendation, onRecommendationDone, onRecommendationPostpone, workflowInfo, stoVisitStatuses = fallbackStoVisitStatuses, stoStatusLabel = (key) => key, onCopy, isStore, workPosts, mechanics }) {
  const tabs = [
    ['overview','Огляд',Info,'Головна інформація'],
    ['passport','Техпаспорт',CarFront,'Авто, VIN, двигун'],
    ['acceptance','Акт',FileText,'Приймання авто'],
    ['diagnostic','Діагностика',ClipboardCheck,'Карта і висновки'],
    ['works','Роботи',Wrench,'Послуги і зарплата'],
    ['parts','Запчастини',Package,'Товари і статуси'],
    ['recommendations','Рекомендації',ClipboardList,'Наступні роботи'],
    ['summary','Підсумок',Calculator,'Фінальний контроль'],
  ];
  const activeTab = tabs.find(([key]) => key === tab) || tabs[0];
  const group = { client: visit.client, phone: visit.phone, plate: visit.plate, vin: visit.vin_code, car: `${carData.brand || ''} ${carData.model || ''}`.trim() || visit.plate };
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reschedule, setReschedule] = useState(timeParts(visit.scheduled_datetime));

  const revenue = totalOf(visit);
  const paid = Number(visit.paid_amount || visit.prepayment_amount || 0);
  const debt = Number(visit.debt_amount || Math.max(revenue - paid, 0));

  const saveReschedule = async () => {
    if (!reschedule.date || !reschedule.time) return;
    await onPatch('scheduled_datetime', new Date(`${reschedule.date}T${reschedule.time}`).toISOString());
    setRescheduleOpen(false);
  };

  const renderContent = () => {
    if (tab === 'overview') return <Overview visit={visit} carData={carData} workPosts={workPosts} mechanics={mechanics} isStore={isStore}/>;
    if (tab === 'passport') return <Passport carData={carData} setCarData={setCarData} onSave={onSaveCar} scanRef={scanRef} onScan={onScan} scanDraft={scanDraft} setScanDraft={setScanDraft} onAcceptScan={onAcceptScan} visit={visit}/>;
    if (tab === 'acceptance') return <VisitWorkflowPanel selectedGroup={group} lastVisit={visit} initialActive="acceptance" standalone/>;
    if (tab === 'diagnostic') return <VisitWorkflowPanel selectedGroup={group} lastVisit={visit} initialActive="diagnostic" standalone/>;
    if (tab === 'works') return <Works visit={visit} catalogServices={catalogServices} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} showServiceForm={showServiceForm} setShowServiceForm={setShowServiceForm} newService={newService} setNewService={setNewService} onAddService={onAddService} onDeleteService={onDeleteService} mechanics={mechanics} isStore={isStore}/>;
    if (tab === 'parts') return <Parts visit={visit} showForm={showManualPartForm} setShowForm={setShowManualPartForm} form={manualPart} setForm={setManualPart} onSubmit={onAddManualPart} onDelete={onDeletePart} onStatus={onUpdatePartStatus}/>;
    if (tab === 'recommendations') return <Recommendations recommendations={recommendations} showForm={showRecommendationForm} setShowForm={setShowRecommendationForm} form={newRecommendation} setForm={setNewRecommendation} onSubmit={onAddRecommendation} onDone={onRecommendationDone} onPostpone={onRecommendationPostpone}/>;
    return <Summary visit={visit} recommendations={recommendations} workflowInfo={workflowInfo} editComment={editComment} setEditComment={setEditComment} onSave={() => onPatch('comment', editComment)} mechanics={mechanics} isStore={isStore} />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm overflow-y-auto px-2 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-[1120px] rounded-[28px] md:rounded-[34px] bg-white shadow-2xl border border-white/60 overflow-hidden relative">
        {isScanning && <ScanOverlay />}

        <div className="bg-white px-4 py-4 md:px-6 md:py-5 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-xl px-3 py-1.5 text-xs font-black uppercase shadow-sm">
                  <Hash size={14}/> {isStore ? 'Замовлення' : 'Візит'} №{visitId(visit)}
                </span>
                <span className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                  {stoStatusLabel(visit.status)}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase text-slate-950 leading-tight tracking-tight break-words">
                {visit.plate || `№${visitId(visit)}`}
              </h2>
              <p className="text-slate-600 text-sm md:text-[15px] font-bold mt-1 break-words">
                {visit.client || 'Клієнт не вказаний'} · {visit.phone || 'телефон не вказаний'}
              </p>
            </div>

            <div className="flex flex-wrap justify-start lg:justify-end gap-2 shrink-0">
              <button
                type="button"
                data-document-dock-anchor="true"
                onClick={() => openDocumentPackage(visit, isStore)}
                className="min-h-[42px] rounded-2xl bg-slate-900 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-black uppercase flex items-center justify-center gap-2 shadow-sm transition whitespace-nowrap"
              >
                <FileText size={16}/> Документи
              </button>
              <MacAction title="Видалити" color="bg-rose-50 !text-rose-500" onClick={onCancel}><Trash2 size={17}/></MacAction>
              <MacAction title="Закрити" color="bg-slate-100 !text-slate-500" onClick={()=>setVisit(null)}><X size={18}/></MacAction>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <HeaderMetric label="Статус" value={stoStatusLabel(visit.status)} />
            <HeaderMetric label="Виручка" value={money(revenue)} />
            <HeaderMetric label="Прибуток" value={money(Number(visit.profit || 0))} good />
            <HeaderMetric label="Оплачено" value={money(paid)} />
            <HeaderMetric label="Борг" value={money(debt)} danger={debt > 0} />
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 bg-slate-50/90 border-b border-slate-200">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-3 items-stretch">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm min-w-0 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Статус з довідника</p>
                  <p className="text-sm font-black text-slate-900 mt-1 truncate">{stoStatusLabel(visit.status)}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {stoVisitStatuses.map((status) => (
                    <StatusBtn key={status.key} active={stoStatusMatches(visit.status, status)} onClick={() => onPatch('status', status.key)} label={status.label || status.key}/>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <QuickActions visit={visit} onCopy={onCopy} />

                <div className="rounded-2xl border border-blue-100 bg-blue-50/45 p-3 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Запис / час візиту</p>
                      <p className="text-sm font-black text-slate-950 mt-1 flex items-center gap-2 min-w-0">
                        <Clock size={15} className="text-blue-600 shrink-0"/>
                        <span className="truncate">{visitDate(visit)}</span>
                      </p>
                    </div>
                    <button type="button" onClick={() => setRescheduleOpen(!rescheduleOpen)} className="min-h-[38px] rounded-xl border border-blue-100 bg-white px-4 py-2 text-[10px] font-black uppercase text-blue-700 hover:border-blue-300 hover:bg-blue-50 transition whitespace-nowrap shrink-0">
                      {rescheduleOpen ? 'Сховати зміну' : 'Змінити запис'}
                    </button>
                  </div>
                  {rescheduleOpen && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                      <LabeledInput label="Нова дата" type="date" value={reschedule.date} onChange={(v)=>setReschedule({...reschedule,date:v})}/>
                      <LabeledInput label="Новий час" type="time" value={reschedule.time} onChange={(v)=>setReschedule({...reschedule,time:v})}/>
                      <button type="button" onClick={saveReschedule} className="min-h-[43px] bg-blue-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase whitespace-nowrap shadow-sm shadow-blue-100 hover:bg-blue-700 transition">Зберегти</button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {!isStore && (
              <section className="rounded-2xl border border-blue-100 bg-blue-50/80 p-3 md:p-4 shadow-sm min-w-0">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Пост і майстер</p>
                  <span className="hidden sm:inline-flex rounded-full bg-white/80 border border-blue-100 px-2 py-1 text-[10px] font-black uppercase text-blue-600">СТО</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                  <LabeledSelect label="Пост / підйомник" value={visitWorkPostId(visit)} onChange={(v) => onPatch('work_post', v ? Number(v) : null)}>
                    <option value="">Не обрано</option>
                    {arr(workPosts).filter((post) => post.is_active !== false).map((post) => <option key={post.id} value={post.id}>{workPostName(post)}</option>)}
                  </LabeledSelect>
                  <LabeledSelect label="Відповідальний майстер" value={visitMechanicId(visit)} onChange={(v) => onPatch('responsible_mechanic', v ? Number(v) : null)}>
                    <option value="">Не обрано</option>
                    {arr(mechanics).filter((mechanic) => mechanic.is_active !== false).map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanicName(mechanic)}</option>)}
                  </LabeledSelect>
                </div>
                <p className="text-[11px] font-bold text-blue-700 mt-2 leading-snug">Пост рахує зайнятість, майстер — виконані роботи і зарплату.</p>
              </section>
            )}
          </div>
        </div>

        <div className="bg-white border-b border-slate-200 px-4 py-3 md:px-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map(([key,label,Icon]) => (
              <button
                key={key}
                type="button"
                onClick={()=>setTab(key)}
                className={`min-h-[42px] inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-[11px] md:text-xs font-black uppercase leading-tight transition border whitespace-nowrap ${tab===key?'bg-blue-600 text-white border-blue-600 shadow-sm':'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
              >
                <Icon size={15}/>{label}
              </button>
            ))}
          </div>
        </div>

        <section className="bg-slate-50 px-3 py-4 md:px-6 md:py-5">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-white px-4 md:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  {React.createElement(activeTab[2], { size: 18 })}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base md:text-lg font-black text-slate-950 uppercase leading-tight truncate">{activeTab[1]}</h3>
                  <p className="text-xs font-bold text-slate-500 truncate">{activeTab[3]}</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 self-start sm:self-auto">
                {isStore ? 'Замовлення' : 'СТО'} №{visitId(visit)}
              </span>
            </div>
            <div className="p-4 md:p-5 overflow-x-hidden">
              {renderContent()}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ModalNavButton({ active, icon, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl px-3 py-3 transition border ${active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase leading-tight truncate">{label}</p>
          <p className={`text-[11px] font-bold leading-snug mt-0.5 line-clamp-2 ${active ? 'text-blue-100' : 'text-slate-400'}`}>{description}</p>
        </div>
      </div>
    </button>
  );
}

function HeaderMetric({ label, value, good, danger }) {
  return (
    <div className={`rounded-2xl border p-3 min-w-0 ${danger ? 'bg-rose-50 border-rose-100' : good ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <p className={`text-sm md:text-base font-black mt-1 truncate ${danger ? 'text-rose-700' : good ? 'text-emerald-700' : 'text-slate-900'}`}>{value || '—'}</p>
    </div>
  );
}

function MacAction({ title, color, onClick, children }) { return <button type="button" title={title} aria-label={title} onClick={onClick} className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center shadow-sm hover:scale-105 transition-transform`}>{children}</button>; }
function StatusBtn({active,onClick,label}){
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-black uppercase leading-tight transition text-center ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
    >
      {label}
    </button>
  );
}

function QuickActions({ visit, onCopy }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5 min-w-0">
      <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Швидкі дії</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <a href={`tel:${visit.phone || ''}`} className="min-h-[40px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl px-3 py-2 text-[11px] font-black uppercase flex items-center justify-center gap-1.5 leading-tight text-center whitespace-nowrap hover:bg-emerald-100 transition">
          <Phone size={14}/> Дзвінок
        </a>
        <QuickBtn onClick={()=>onCopy(visit.phone, 'Телефон')} icon={<Copy size={14}/>} label="Телефон"/>
        <QuickBtn onClick={()=>onCopy(visit.vin_code, 'VIN')} icon={<Copy size={14}/>} label="VIN"/>
        <QuickBtn onClick={()=>onCopy(visit.plate, 'Номер авто')} icon={<Copy size={14}/>} label="Номер"/>
      </div>
    </div>
  );
}

function QuickBtn({ onClick, icon, label }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[40px] bg-slate-50 text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-white hover:text-blue-600 rounded-xl px-3 py-2 text-[11px] font-black uppercase flex items-center justify-center gap-1.5 leading-tight text-center whitespace-nowrap transition">
      {icon}{label}
    </button>
  );
}
function StoAssignmentPanel({ visit, workPosts = [], mechanics = [], onPatch }) {
  const currentPost = visitWorkPostId(visit);
  const currentMechanic = visitMechanicId(visit);

  return (
    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-2xl p-3">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <LabeledSelect label="Пост / підйомник" value={currentPost} onChange={(v) => onPatch('work_post', v ? Number(v) : null)}>
            <option value="">Не обрано</option>
            {arr(workPosts).filter((post) => post.is_active !== false).map((post) => <option key={post.id} value={post.id}>{workPostName(post)}</option>)}
          </LabeledSelect>
        </div>
        <div className="flex-1">
          <LabeledSelect label="Відповідальний майстер" value={currentMechanic} onChange={(v) => onPatch('responsible_mechanic', v ? Number(v) : null)}>
            <option value="">Не обрано</option>
            {arr(mechanics).filter((mechanic) => mechanic.is_active !== false).map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanicName(mechanic)}</option>)}
          </LabeledSelect>
        </div>
      </div>
      <p className="text-[11px] font-bold text-blue-700 mt-2">
        Пост рахує зайнятість, майстер — виконані роботи і зарплату.
      </p>
    </div>
  );
}

function Overview({ visit, carData, workPosts = [], mechanics = [], isStore }) {
  const post = workPostLabel(visit.work_post_name || visit.work_post_label || visit.work_post, workPosts);
  const mechanic = mechanicLabel(visit.responsible_mechanic_name || visit.responsible_mechanic_label || visit.responsible_mechanic, mechanics);
  const payrollTotal = servicesPayrollTotal(visit);
  const paid = Number(visit.paid_amount || visit.prepayment_amount || 0);
  const debt = Number(visit.debt_amount || 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OverviewPanel title="Клієнт" icon={<Phone size={18}/>} tone="blue">
          <OverviewRow label="Імʼя" value={visit.client || '—'} />
          <OverviewRow label="Телефон" value={visit.phone || '—'} />
          <OverviewRow label="Запис" value={visitDate(visit)} />
        </OverviewPanel>

        <OverviewPanel title="Автомобіль" icon={<CarFront size={18}/>} tone="slate">
          <OverviewRow label="Номер" value={visit.plate || '—'} strong />
          <OverviewRow label="VIN" value={visit.vin_code || '—'} />
          <OverviewRow label="Авто" value={`${carData.brand || '—'} ${carData.model || ''} ${carData.year || ''}`.trim()} />
          <OverviewRow label="Двигун / паливо" value={`${carData.engine_volume || carData.engine || '—'}${carData.engine_power ? ` · ${carData.engine_power} кВт` : ''}${carData.fuel ? ` · ${carData.fuel}` : ''}`} />
        </OverviewPanel>

        {!isStore && (
          <OverviewPanel title="СТО" icon={<Wrench size={18}/>} tone="indigo">
            <OverviewRow label="Пост" value={post} strong />
            <OverviewRow label="Майстер" value={mechanic} />
            <OverviewRow label="Нараховано майстрам" value={money(payrollTotal)} />
          </OverviewPanel>
        )}

        <OverviewPanel title="Фінанси" icon={<Calculator size={18}/>} tone={debt > 0 ? 'rose' : 'emerald'}>
          <OverviewRow label="Сума" value={money(totalOf(visit))} strong />
          <OverviewRow label="Оплачено" value={money(paid)} />
          <OverviewRow label="Борг" value={money(debt)} danger={debt > 0} />
          <OverviewRow label="Прибуток" value={money(Number(visit.profit || 0))} good />
        </OverviewPanel>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase text-slate-500 mb-2">Коментар</p>
        <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{visit.comment || 'Коментарів поки немає. Їх можна додати у вкладці “Підсумок”.'}</p>
      </div>
    </div>
  );
}

function OverviewPanel({ title, icon, tone = 'slate', children }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${tones[tone] || tones.slate}`}>{icon}</span>
        <h4 className="text-sm font-black uppercase text-slate-900">{title}</h4>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function OverviewRow({ label, value, strong, good, danger }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
      <span className="text-[11px] font-black uppercase text-slate-400 shrink-0">{label}</span>
      <span className={`text-right text-sm leading-snug ${strong ? 'font-black text-slate-950' : 'font-bold text-slate-700'} ${good ? 'text-emerald-700' : ''} ${danger ? 'text-rose-700' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function Passport({carData,setCarData,onSave,scanRef,onScan,scanDraft,setScanDraft,onAcceptScan,visit}){return <div className="space-y-4"><div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 justify-between"><h3 className="font-black text-slate-800 flex gap-2 items-center"><ScanLine size={17}/> Скан техпаспорта</h3><button onClick={()=>scanRef.current?.click()} className="bg-blue-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase flex gap-2 justify-center"><Camera size={15}/> Сканувати</button><input ref={scanRef} type="file" accept="image/*" onChange={onScan} className="hidden"/></div>{scanDraft&&<ScanReviewCard data={scanDraft} setData={setScanDraft} onApply={onAcceptScan} onCancel={()=>setScanDraft(null)}/>}<CarFields data={carData} setData={setCarData}/><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><InfoCard label="Держ. номер" value={visit.plate}/><InfoCard label="VIN" value={visit.vin_code || '—'}/></div><button onClick={onSave} className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Зберегти техпаспорт</button></div>}
function Works({
  visit,
  catalogServices,
  selectedCatalogId,
  setSelectedCatalogId,
  showServiceForm,
  setShowServiceForm,
  newService,
  setNewService,
  onAddService,
  onDeleteService,
  mechanics = [],
  isStore,
}) {
  const ss = servicesOf(visit);
  const payrollTotal = servicesPayrollTotal(visit);
  const selectedMechanic = findById(mechanics, newService.mechanic);

  const pickMechanic = (mechanicId) => {
    const mechanic = findById(mechanics, mechanicId);
    setNewService({
      ...newService,
      mechanic: mechanicId,
      commission_percent: newService.commission_percent || mechanicDefaultPercent(mechanic),
      commission_base: newService.commission_base || mechanic?.salary_scheme || '',
    });
  };

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-2 ${!isStore ? 'md:grid-cols-3' : ''} gap-3`}>
        <InfoCard label="Робіт" value={ss.length} />
        <InfoCard label="Сума" value={money(servicesTotal(visit))} />
        {!isStore && <InfoCard label="Майстрам" value={money(payrollTotal)} />}
      </div>

      <button onClick={() => setShowServiceForm(!showServiceForm)} className="bg-blue-50 text-blue-700 rounded-xl px-4 py-3 text-xs font-black uppercase flex gap-2">
        <Plus size={14} /> Додати роботу
      </button>

      {showServiceForm && (
        <form onSubmit={onAddService} className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
          <select
            value={selectedCatalogId}
            onChange={(e) => {
              setSelectedCatalogId(e.target.value);
              const s = catalogServices.find((x) => x.id === Number(e.target.value));
              if (s) setNewService({ ...newService, name: s.name, price: s.price || s.default_price || '', quantity: 1 });
            }}
            className="w-full bg-white border rounded-lg p-2 text-xs font-bold"
          >
            <option value="">Ввести вручну</option>
            {catalogServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <input required placeholder="Назва роботи" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} className="w-full bg-white border rounded-lg p-2 text-xs font-bold" />

          <div className="grid grid-cols-2 gap-2">
            <input required type="number" placeholder="Ціна" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} className="bg-white border rounded-lg p-2 text-xs font-bold" />
            <input required type="number" placeholder="К-сть" value={newService.quantity} onChange={(e) => setNewService({ ...newService, quantity: e.target.value })} className="bg-white border rounded-lg p-2 text-xs font-bold" />
          </div>

          {!isStore && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-black uppercase text-slate-400">Майстер і нарахування</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] font-black uppercase text-slate-400 ml-1 block mb-1">Майстер</span>
                  <select value={newService.mechanic || ''} onChange={(e) => pickMechanic(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none">
                    <option value="">Не обрано</option>
                    {arr(mechanics).filter((mechanic) => mechanic.is_active !== false).map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanicName(mechanic)}</option>)}
                  </select>
                </label>

                <LabeledInput
                  label="% майстра"
                  type="number"
                  value={newService.commission_percent}
                  onChange={(v) => setNewService({ ...newService, commission_percent: v })}
                  hint={selectedMechanic && newService.commission_percent === '' ? `За замовчуванням: ${mechanicDefaultPercent(selectedMechanic) || 0}%` : ''}
                />
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-[11px] font-black uppercase text-blue-500">Попередньо майстру</p>
                <p className="text-lg font-black text-blue-800">
                  {money((Number(newService.price || 0) * Number(newService.quantity || 1) * Number(newService.commission_percent || mechanicDefaultPercent(selectedMechanic) || 0)) / 100)}
                </p>
              </div>
            </div>
          )}

          <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs font-black uppercase">Зберегти</button>
        </form>
      )}

      {ss.map((s) => {
        const mechanic = mechanicLabel(s.mechanic_name || s.mechanic_label || s.mechanic, mechanics);
        const commission = servicePayrollTotal(s);
        const serviceSub = [
          `${s.quantity || 1} × ${money(s.price)}`,
          !isStore && mechanic !== '—' ? `майстер: ${mechanic}` : '',
          !isStore && commission > 0 ? `майстру ${money(commission)}` : '',
        ].filter(Boolean).join(' · ');

        return (
          <Row
            key={s.id}
            title={s.name || s.custom_name}
            sub={serviceSub}
            price={money(Number(s.price || 0) * Number(s.quantity || 1))}
            onDelete={() => onDeleteService(s.id)}
          />
        );
      })}

      {!ss.length && <EmptyPanel text="Роботи ще не додані" />}
    </div>
  );
}
function Parts({visit,showForm,setShowForm,form,setForm,onSubmit,onDelete,onStatus}){const ps=partsOf(visit);const c=partCounts(visit);return <div className="space-y-3"><div className="grid grid-cols-2 md:grid-cols-4 gap-2"><MiniStatus label="Очікується" value={c.WAITING} cls="text-amber-600 bg-amber-50 border-amber-100"/><MiniStatus label="В дорозі" value={c.IN_TRANSIT} cls="text-blue-600 bg-blue-50 border-blue-100"/><MiniStatus label="Отримано" value={c.ARRIVED} cls="text-emerald-600 bg-emerald-50 border-emerald-100"/><MiniStatus label="Відмова" value={c.UNAVAILABLE} cls="text-rose-600 bg-rose-50 border-rose-100"/></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><InfoCard label="Позицій" value={ps.length}/><InfoCard label="Сума" value={money(partsTotal(visit))}/><button type="button" onClick={()=>setShowForm(!showForm)} className="bg-blue-600 text-white rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Plus size={15}/> Додати вручну</button></div>{showForm&&<ManualPartForm form={form} setForm={setForm} onSubmit={onSubmit} onCancel={()=>setShowForm(false)}/>} {ps.map(p=><div key={p.id} className="p-3 bg-slate-50 rounded-xl border flex flex-col lg:flex-row lg:items-center gap-3"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2 mb-1"><span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${supplierBadge(p)}`}>{p.supplier || 'Постачальник'}</span><span className="text-[11px] font-black uppercase text-slate-400">к-сть {p.quantity||1}</span></div><p className="font-black text-slate-800 text-sm break-words">{p.name}</p><p className="text-xs uppercase font-bold text-slate-500 break-words">{p.brand} | {p.part_number||p.article}</p><p className="text-xs font-bold text-blue-600 mt-1">{money(p.sell_price||p.price)} · закупка {money(p.buy_price)}</p></div><select value={p.status||p.logistics_status||'WAITING'} onChange={(e)=>onStatus(p.id,e.target.value)} className="border rounded-xl px-3 py-2 text-xs font-black bg-white"><option value="WAITING">Очікується</option><option value="IN_TRANSIT">В дорозі</option><option value="ARRIVED">Доставлено</option><option value="UNAVAILABLE">Відмова</option></select><button onClick={()=>onDelete(p.id)} className="text-red-500 p-2 self-start lg:self-center"><Trash2 size={16}/></button></div>)}{!ps.length&&<EmptyPanel text="Запчастини ще не додані"/>}</div>}
function MiniStatus({label,value,cls}){return <div className={`rounded-2xl border p-3 ${cls}`}><p className="text-[10px] font-black uppercase opacity-80">{label}</p><p className="text-2xl font-black leading-none mt-1">{value}</p></div>}
function ManualPartForm({ form, setForm, onSubmit, onCancel }) { return <form onSubmit={onSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-800 uppercase text-sm">Ручне додавання</h3><button type="button" onClick={onCancel} className="text-slate-400"><X size={18}/></button></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><LabeledInput label="Назва" required value={form.name} onChange={(v)=>setForm({...form,name:v})}/><LabeledInput label="Бренд" value={form.brand} onChange={(v)=>setForm({...form,brand:v})}/><LabeledInput label="Артикул" value={form.article} onChange={(v)=>setForm({...form,article:v})}/><LabeledInput label="Постачальник" value={form.supplier} onChange={(v)=>setForm({...form,supplier:v})}/><LabeledInput label="Закупка" type="number" required value={form.buy_price} onChange={(v)=>setForm({...form,buy_price:v})}/><LabeledInput label="Продаж" type="number" required value={form.sell_price} onChange={(v)=>setForm({...form,sell_price:v})}/><LabeledInput label="Кількість" type="number" required value={form.quantity} onChange={(v)=>setForm({...form,quantity:v})}/><label className="block md:col-span-2"><span className="text-[11px] font-black uppercase text-slate-400 ml-1 block mb-1">Статус</span><select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none"><option value="WAITING">Очікується</option><option value="IN_TRANSIT">В дорозі</option><option value="ARRIVED">Доставлено</option><option value="UNAVAILABLE">Відмова</option></select></label></div><button className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Зберегти запчастину</button></form>}
function Recommendations({ recommendations = [], showForm, setShowForm, form, setForm, onSubmit, onDone, onPostpone }) {
  const safeRecommendations = listOf(recommendations);
  const active = safeRecommendations.filter((r) => r.status !== 'done' && r.status !== 'cancelled');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard label="Активні" value={active.length} />
        <InfoCard label="Всього" value={safeRecommendations.length} />
        <button type="button" onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Plus size={15} /> Додати</button>
      </div>
      {showForm && <RecommendationForm form={form} setForm={setForm} onSubmit={onSubmit} onCancel={() => setShowForm(false)} />}
      {safeRecommendations.map((rec) => {
        const urgency = recommendationUrgency(rec);
        return (
          <div key={rec.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`border rounded-full px-3 py-1 text-[11px] font-black uppercase ${urgency.cls}`}>{urgency.label}</span>
              {rec.due_date && <span className="text-[11px] font-black uppercase text-slate-400">до {rec.due_date}</span>}
              {rec.due_mileage && <span className="text-[11px] font-black uppercase text-slate-400">{rec.due_mileage} км</span>}
            </div>
            <h3 className="font-black text-slate-900 text-sm">{rec.title}</h3>
            {rec.description && <p className="text-sm font-semibold text-slate-500 mt-1 whitespace-pre-wrap">{rec.description}</p>}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => onPostpone(rec)} className="bg-amber-50 text-amber-700 rounded-xl py-2.5 text-[11px] font-black uppercase">Відкласти</button>
              <button onClick={() => onDone(rec.id)} className="bg-emerald-50 text-emerald-700 rounded-xl py-2.5 text-[11px] font-black uppercase">Виконано</button>
            </div>
          </div>
        );
      })}
      {!safeRecommendations.length && <EmptyPanel text="Рекомендації ще не додані" />}
    </div>
  );
}
function RecommendationForm({ form, setForm, onSubmit, onCancel }) { return <form onSubmit={onSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"><div className="flex items-center justify-between"><h3 className="font-black text-slate-800 uppercase text-sm">Нова рекомендація</h3><button type="button" onClick={onCancel} className="text-slate-400"><X size={18}/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><LabeledInput label="Що рекомендуємо" required value={form.title} onChange={(v)=>setForm({...form,title:v})}/><LabeledInput label="Дата" type="date" value={form.due_date} onChange={(v)=>setForm({...form,due_date:v})}/><LabeledInput label="Пробіг" type="number" value={form.due_mileage} onChange={(v)=>setForm({...form,due_mileage:v})}/><label className="block md:col-span-2"><span className="text-[11px] font-black uppercase text-slate-400 ml-1 block mb-1">Опис</span><textarea value={form.description || ''} onChange={(e)=>setForm({...form,description:e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none min-h-[90px]"/></label></div><button className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Зберегти рекомендацію</button></form>}
function Summary({ visit, recommendations, workflowInfo, editComment, setEditComment, onSave, mechanics = [], isStore }) {
  const c = partCounts(visit);
  const safeRecommendations = listOf(recommendations);
  const activeRecs = safeRecommendations.filter((r) => r.status !== 'done' && r.status !== 'cancelled');
  const acceptanceDone = workflowFilled(workflowInfo.acceptance, 'acceptance');
  const diagnosticDone = workflowFilled(workflowInfo.diagnostic, 'diagnostic');
  const payrollTotal = servicesPayrollTotal(visit);
  const notReady = [];

  if (c.WAITING) notReady.push(`${c.WAITING} запчастин очікує замовлення`);
  if (c.IN_TRANSIT) notReady.push(`${c.IN_TRANSIT} запчастин в дорозі`);
  if (activeRecs.length) notReady.push(`${activeRecs.length} активних рекомендацій`);
  if (!acceptanceDone) notReady.push('акт приймання не заповнений');
  if (!diagnosticDone) notReady.push('діагностика не заповнена');

  const canClose = c.WAITING === 0 && c.IN_TRANSIT === 0;

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 ${!isStore ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
        <InfoCard label="Роботи" value={`${servicesOf(visit).length} · ${money(servicesTotal(visit))}`} />
        <InfoCard label="Запчастини" value={`${partsOf(visit).length} · ${money(partsTotal(visit))}`} />
        <InfoCard label="Рекомендації" value={activeRecs.length} />
        <InfoCard label="Разом" value={money(totalOf(visit))} />
        {!isStore && <InfoCard label="Майстрам" value={money(payrollTotal)} />}
      </div>

      {!isStore && servicesOf(visit).some((service) => service.mechanic || service.mechanic_name || service.commission_amount) && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm font-black uppercase text-blue-700 mb-3">Нарахування майстрам по роботах</p>
          <div className="space-y-2">
            {servicesOf(visit).map((service) => (
              <div key={service.id} className="bg-white border border-blue-100 rounded-xl p-3 flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{service.name || service.custom_name}</p>
                  <p className="text-xs font-bold text-slate-500 truncate">{mechanicLabel(service.mechanic_name || service.mechanic_label || service.mechanic, mechanics)}</p>
                </div>
                <p className="text-sm font-black text-blue-700 shrink-0">{money(servicePayrollTotal(service))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-2xl border p-4 ${canClose ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
        <p className={`text-sm font-black uppercase ${canClose ? 'text-emerald-700' : 'text-amber-700'}`}>
          {canClose ? 'Можна закривати по запчастинах' : 'Є що проконтролювати'}
        </p>
        {notReady.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm font-bold text-slate-700">
            {notReady.map((x, i) => <li key={i}>• {x}</li>)}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoCard label="Акт приймання" value={acceptanceDone ? 'Заповнений' : 'Не заповнений'} />
        <InfoCard label="Діагностика" value={diagnosticDone ? 'Заповнена' : 'Не заповнена'} />
      </div>

      <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} className="w-full bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm font-bold min-h-[100px]" placeholder="Внутрішній коментар" />
      <button onClick={onSave} className="bg-amber-400 text-amber-950 rounded-xl px-5 py-3 text-xs font-black uppercase">Зберегти внутрішній коментар</button>
    </div>
  );
}
function CarFields({data,setData}){return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div className="flex justify-between items-center border-b pb-2 mb-3"><p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Дані автомобіля</p><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${data.engine_review_status==='needs_review'?'bg-amber-50 text-amber-700 border-amber-100':'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{data.engine_review_status==='needs_review'?'Двигун перевірити':'Перевірено вручну'}</span></div><div className="grid grid-cols-2 gap-3"><LabeledInput label="Марка" value={data.brand} onChange={(v)=>setData({...data,brand:v})}/><LabeledInput label="Модель" value={data.model} onChange={(v)=>setData({...data,model:v})}/><LabeledInput label="Рік" type="number" value={data.year} onChange={(v)=>setData({...data,year:v})}/><LabeledInput label="Обʼєм см³" type="number" value={data.engine_volume||data.engine} onChange={(v)=>setData({...data,engine:v,engine_volume:v,engine_review_status:'manual'})}/><LabeledInput label="Потужність кВт" type="number" value={data.engine_power} onChange={(v)=>setData({...data,engine_power:v,engine_review_status:'manual'})}/><LabeledInput label="Код двигуна" value={data.engine_code} onChange={(v)=>setData({...data,engine_code:v,engine_review_status:'manual'})}/><div className="col-span-2"><LabeledInput label="Паливо" value={data.fuel} onChange={(v)=>setData({...data,fuel:v,engine_review_status:'manual'})}/></div></div></div>}
function ScanReviewCard({data,setData,onApply,onCancel}){return <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3"><div className="flex gap-2"><AlertTriangle size={18} className="text-amber-600 shrink-0"/><div><p className="font-black text-amber-800 text-sm">Результат скану потребує перевірки</p><p className="text-xs font-semibold text-amber-700">Це обʼєднаний результат: нове фото доповнює вже знайдені дані.</p></div></div><div className="grid grid-cols-2 gap-2"><LabeledInput label="Держ. номер" value={data.plate} onChange={(v)=>setData({...data,plate:v.toUpperCase()})}/><LabeledInput label="VIN" value={data.vin_code||data.vin_candidate} onChange={(v)=>setData({...data,vin_code:v.toUpperCase()})}/><LabeledInput label="Марка" value={data.brand} onChange={(v)=>setData({...data,brand:v})}/><LabeledInput label="Модель" value={data.model} onChange={(v)=>setData({...data,model:v})}/><LabeledInput label="Рік" type="number" value={data.year} onChange={(v)=>setData({...data,year:v})}/><LabeledInput label="Обʼєм см³" type="number" value={data.engine_volume||data.engine} onChange={(v)=>setData({...data,engine:v,engine_volume:v})}/><LabeledInput label="Потужність кВт" type="number" value={data.engine_power} onChange={(v)=>setData({...data,engine_power:v})}/><LabeledInput label="Код двигуна" value={data.engine_code} onChange={(v)=>setData({...data,engine_code:v})}/><div className="col-span-2"><LabeledInput label="Паливо" value={data.fuel} onChange={(v)=>setData({...data,fuel:v})}/></div></div>{data.warnings?.length>0&&<div className="text-xs font-bold text-amber-700 space-y-1">{data.warnings.map((w,i)=><p key={i}>• {w}</p>)}</div>}<div className="flex flex-col sm:flex-row gap-2"><button type="button" onClick={onApply} className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Прийняти дані</button><button type="button" onClick={onCancel} className="flex-1 bg-white border border-amber-200 text-amber-700 rounded-xl py-3 text-xs font-black uppercase">Не використовувати</button></div></div>}

function ConfirmActionModal({ dialog, onClose }) {
  const [saving, setSaving] = useState(false);
  const isDanger = dialog?.tone !== 'safe';

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await dialog?.onConfirm?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="w-full max-w-md rounded-[28px] bg-white shadow-2xl border border-white/70 overflow-hidden">
        <div className={`p-5 ${isDanger ? 'bg-rose-50 border-b border-rose-100' : 'bg-blue-50 border-b border-blue-100'}`}>
          <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${isDanger ? 'text-rose-600' : 'text-blue-600'}`}>Підтвердження дії</p>
          <h3 className="mt-1 text-xl font-black uppercase text-slate-950">{dialog?.title || 'Підтвердити дію?'}</h3>
          {dialog?.message && <p className="mt-2 text-sm font-bold text-slate-600 leading-relaxed">{dialog.message}</p>}
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-60">Не чіпати</button>
          <button type="button" disabled={saving} onClick={handleConfirm} className={`rounded-2xl px-5 py-3 text-xs font-black uppercase text-white shadow-lg disabled:opacity-60 ${isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}>
            {saving ? 'Виконуємо...' : (dialog?.confirmLabel || 'Підтвердити')}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({label,value,onChange,type='text',required,hint,onBlur}){
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-black uppercase text-slate-500 ml-1 block mb-1.5">{label}</span>
      <input
        required={required}
        type={type}
        value={value||''}
        onBlur={onBlur}
        onChange={(e)=>onChange(e.target.value)}
        className="w-full min-h-[46px] bg-white border-2 border-slate-200 rounded-xl py-3 px-3 text-sm font-extrabold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
      />
      {hint&&<span className="text-[11px] font-black text-emerald-600 ml-1 mt-1 block">{hint}</span>}
    </label>
  );
}
function LabeledSelect({ label, value, onChange, children, hint }) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-black uppercase text-slate-500 ml-1 block mb-1.5">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[46px] bg-white border-2 border-slate-200 rounded-xl py-3 px-3 text-sm font-extrabold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
      >
        {children}
      </select>
      {hint && <span className="text-[11px] font-black text-emerald-600 ml-1 mt-1 block">{hint}</span>}
    </label>
  );
}
function InfoCard({label,value}){return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 min-w-0"><p className="text-[11px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-800 text-sm mt-1 break-words">{value||'—'}</p></div>}
function Row({title,sub,price,onDelete}){return <div className="p-3 bg-slate-50 rounded-xl border flex justify-between items-center gap-3"><div><p className="font-bold text-slate-700 text-sm">{title}</p><p className="text-xs text-slate-400">{sub}</p></div><div className="flex items-center gap-3"><p className="font-black text-sm text-slate-800">{price}</p><button onClick={onDelete} className="text-red-500 p-1"><Trash2 size={16}/></button></div></div>}
function EmptyPanel({text}){return <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center text-slate-400 font-bold text-sm">{text}</div>}
function ScanOverlay(){return <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center text-center"><Loader2 className="animate-spin text-white mb-4" size={38}/><h3 className="text-white font-black text-xl">Розпізнаємо техпаспорт</h3><p className="text-slate-300 text-sm font-semibold mt-1">Після скану покажемо дані для перевірки</p></div>}
