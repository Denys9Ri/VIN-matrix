import React, { useEffect, useRef, useState } from 'react';
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [visits, setVisits] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [workPosts, setWorkPosts] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [settings, setSettings] = useState({ role: 'owner', permissions: {}, company: {} });
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
  const [newService, setNewService] = useState({ name: '', price: '', quantity: 1, mechanic: '', commission_percent: '', commission_base: 'service' });
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [showManualPartForm, setShowManualPartForm] = useState(false);
  const [manualPart, setManualPart] = useState({ ...emptyManualPart });
  const [recommendations, setRecommendations] = useState([]);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [newRecommendation, setNewRecommendation] = useState({ ...emptyRecommendation });
  const [workflowInfo, setWorkflowInfo] = useState({ acceptance: {}, diagnostic: {} });
  const [toast, setToast] = useState('');
  const [foundExisting, setFoundExisting] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const passportScanInputRef = useRef(null);
  const token = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };
  const isStore = settings.company?.business_type === 'store';

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
      setVisits(visitsRes.data || []);
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
        commission_base: 'service',
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
      setRecommendations(res.data || []);
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
      alert('Помилка сканування. Спробуйте інший ракурс.');
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
      alert('Помилка сканування. Спробуйте інший ракурс.');
    } finally {
      setIsScanning(false);
      if (passportScanInputRef.current) passportScanInputRef.current.value = '';
    }
  };

  const acceptNewScan = () => { if (!scanDraft) return; setNewVisitData((prev) => mergeScanInto(prev, scanDraft)); setScanDraft(null); };
  const acceptPassportScan = () => { if (!passportScanDraft) return; setEditCarData((prev) => mergeScanInto(prev, passportScanDraft)); if (passportScanDraft.plate) patchVisit('plate', passportScanDraft.plate.toUpperCase()); if (passportScanDraft.vin_code) patchVisit('vin_code', passportScanDraft.vin_code.toUpperCase()); setPassportScanDraft(null); };

  const handlePlateBlur = async () => {
    if (!newVisitData.plate || newVisitData.plate.length < 3) return;
    try {
      const res = await axios.get(`${API_BASE}/api/visits/?search=${newVisitData.plate}`, { headers });
      const existing = (res.data || []).find((v) => v.plate?.toUpperCase() === newVisitData.plate.toUpperCase());
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
      alert('Помилка створення');
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
      commission_base: newService.commission_base || 'service',
    };

    if (newService.mechanic) payload.mechanic = Number(newService.mechanic);
    if (newService.commission_percent !== '' && newService.commission_percent !== null && newService.commission_percent !== undefined) {
      payload.commission_percent = Number(newService.commission_percent);
    }

    try {
      await axios.post(`${API_BASE}/api/order-services/`, payload, { headers });
      setNewService({ name: '', price: '', quantity: 1, mechanic: visitMechanicId(selectedVisit), commission_percent: '', commission_base: 'service' });
      setSelectedCatalogId('');
      setShowServiceForm(false);
      refreshSelected();
    } catch {
      alert('Помилка додавання роботи');
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
      alert('Помилка додавання запчастини вручну. Перевірте поля.');
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
      alert('Не вдалося додати рекомендацію.');
    }
  };

  const markRecommendationDone = async (id) => {
    try {
      await axios.post(`${API_BASE}/api/recommendations/${id}/mark-done/`, {}, { headers });
      fetchRecommendations(selectedVisit);
    } catch {
      alert('Не вдалося позначити рекомендацію виконаною.');
    }
  };

  const postponeRecommendation = async (rec) => {
    const base = rec.due_date ? new Date(`${rec.due_date}T12:00:00`) : new Date();
    base.setDate(base.getDate() + 30);
    try {
      await axios.patch(`${API_BASE}/api/recommendations/${rec.id}/`, { due_date: dateISO(base), status: 'active' }, { headers });
      fetchRecommendations(selectedVisit);
    } catch {
      alert('Не вдалося відкласти рекомендацію.');
    }
  };

  const copyText = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} скопійовано`);
      setTimeout(() => setToast(''), 2200);
    } catch {
      window.prompt('Скопіюйте значення:', value);
    }
  };

  const deleteService = async (id) => { if (window.confirm('Видалити роботу?')) { await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers }); refreshSelected(); } };
  const deletePart = async (id) => { if (window.confirm('Видалити запчастину?')) { await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers }); refreshSelected(); } };
  const updatePartStatus = async (id, status) => { await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status }, { headers }); refreshSelected(); };
  const printPdf = async () => { const w = window.open('', '_blank'); if (!w) return; try { const r = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/pdf/`, { headers, responseType: 'text' }); w.document.write(r.data); w.document.close(); } catch { w.close(); alert('Не вдалося згенерувати документ'); } };
  const cancelVisit = async () => { if (!window.confirm('Скасувати запис?')) return; await axios.delete(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers }); setSelectedVisit(null); fetchData(); };

  const grouped = {
    pending: visits.filter((v) => ['PENDING', 'SELECTION', 'DRAFT'].includes(v.status)),
    progress: visits.filter((v) => ['IN_PROGRESS', 'ORDERED'].includes(v.status)),
    done: visits.filter((v) => v.status === 'DONE'),
    completed: visits.filter((v) => v.status === 'COMPLETED'),
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen overflow-x-hidden">
      <div className="flex flex-col xl:flex-row gap-4 justify-between mb-6">
        <h1 className="text-3xl sm:text-2xl font-black uppercase italic tracking-wide">{isStore ? 'Замовлення' : 'Дошка Візитів'}</h1>
        <div className="flex flex-col md:flex-row gap-3 flex-1 xl:justify-center">
          <div className="relative w-full md:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Пошук ID, номер, клієнт..." className="w-full bg-white border border-slate-200 rounded-2xl pl-9 pr-4 py-3 text-sm font-bold outline-none shadow-sm" /></div>
          <DateNavigator value={filterDate} setValue={setFilterDate} onPrev={() => changeBoardDate(-1)} onNext={() => changeBoardDate(1)} />
        </div>
        <button onClick={() => setIsCreatingVisit(true)} className="bg-blue-600 text-white px-5 py-3.5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-100 leading-none"><Plus size={16} className="shrink-0" /> <span>Новий візит</span></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Column variant="pending" title="В черзі / Підбір" items={grouped.pending} icon={<Clock size={18} />} onOpen={setSelectedVisit} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />
        <Column variant="progress" title="В роботі" items={grouped.progress} icon={<Wrench size={18} />} onOpen={setSelectedVisit} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />
        <Column variant="done" title="Готово" items={isStore ? [...grouped.done, ...grouped.completed] : grouped.done} icon={<CheckCircle2 size={18} />} onOpen={setSelectedVisit} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />
      </div>
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white px-4 py-3 rounded-2xl text-xs font-black shadow-xl">{toast}</div>}
      {isCreatingVisit && <CreateVisitModal data={newVisitData} setData={setNewVisitData} onClose={() => { setIsCreatingVisit(false); setScanDraft(null); }} onSubmit={createVisit} onPlateBlur={handlePlateBlur} foundExisting={foundExisting} isScanning={isScanning} cameraRef={cameraInputRef} galleryRef={galleryInputRef} onScan={scanNewVisit} scanDraft={scanDraft} setScanDraft={setScanDraft} onAcceptScan={acceptNewScan} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />}
      {selectedVisit && <VisitModal visit={selectedVisit} setVisit={setSelectedVisit} tab={visitTab} setTab={setVisitTab} carData={editCarData} setCarData={setEditCarData} onSaveCar={saveCarData} scanRef={passportScanInputRef} onScan={scanExistingVisit} scanDraft={passportScanDraft} setScanDraft={setPassportScanDraft} onAcceptScan={acceptPassportScan} isScanning={isScanning} onPatch={patchVisit} onPrint={printPdf} onCancel={cancelVisit} catalogServices={catalogServices} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} showServiceForm={showServiceForm} setShowServiceForm={setShowServiceForm} newService={newService} setNewService={setNewService} onAddService={addService} onDeleteService={deleteService} onDeletePart={deletePart} onUpdatePartStatus={updatePartStatus} editComment={editComment} setEditComment={setEditComment} showManualPartForm={showManualPartForm} setShowManualPartForm={setShowManualPartForm} manualPart={manualPart} setManualPart={setManualPart} onAddManualPart={addManualPart} recommendations={recommendations} showRecommendationForm={showRecommendationForm} setShowRecommendationForm={setShowRecommendationForm} newRecommendation={newRecommendation} setNewRecommendation={setNewRecommendation} onAddRecommendation={addRecommendation} onRecommendationDone={markRecommendationDone} onRecommendationPostpone={postponeRecommendation} workflowInfo={workflowInfo} onCopy={copyText} isStore={isStore} workPosts={workPosts} mechanics={mechanics} />}
    </div>
  );
}

function DateNavigator({ value, setValue, onPrev, onNext }) { return <div className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm w-full md:w-auto"><div className="grid grid-cols-[44px_1fr_44px] items-center gap-1"><button type="button" onClick={onPrev} className="h-11 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center"><ChevronLeft size={18} /></button><label className="relative block min-w-0"><span className="block text-[9px] font-black uppercase text-slate-400 text-center leading-none pt-1">Дата дошки</span><input type="date" value={value} onChange={(e) => setValue(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" /><span className="block text-center text-sm font-black text-slate-800 truncate px-1 pb-1">{humanDate(value)}</span></label><button type="button" onClick={onNext} className="h-11 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center"><ChevronRight size={18} /></button></div></div>; }
function Column({ title, icon, items, onOpen, isStore, workPosts = [], mechanics = [], variant = 'pending' }) {
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
        <span className={`ml-auto px-3 py-1 rounded-xl shadow-sm text-slate-800 ${s.badge}`}>{items.length}</span>
      </h3>

      <div className="space-y-4">
        {items.map((v) => {
          const post = workPostLabel(v.work_post_name || v.work_post_label || v.work_post, workPosts);
          const mechanic = mechanicLabel(v.responsible_mechanic_name || v.responsible_mechanic_label || v.responsible_mechanic, mechanics);
          const showStoMeta = !isStore && (post !== '—' || mechanic !== '—');

          return (
            <div key={v.id} className="space-y-2">
              <VisitCard visit={v} onClick={() => onOpen(v)} isStore={isStore} />
              {showStoMeta && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
                  {post !== '—' && (
                    <button type="button" onClick={() => onOpen(v)} className="bg-white/80 border border-slate-100 rounded-xl px-3 py-2 text-left text-[10px] font-black uppercase text-slate-500 hover:border-blue-200 transition-colors">
                      Пост: <span className="text-slate-800">{post}</span>
                    </button>
                  )}
                  {mechanic !== '—' && (
                    <button type="button" onClick={() => onOpen(v)} className="bg-white/80 border border-slate-100 rounded-xl px-3 py-2 text-left text-[10px] font-black uppercase text-slate-500 hover:border-blue-200 transition-colors">
                      Майстер: <span className="text-slate-800">{mechanic}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {items.length === 0 && <div className="text-center text-slate-400 text-xs font-black uppercase py-10 bg-white/60 rounded-2xl">Пусто</div>}
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
              <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-3">Пост і майстер</p>
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

function VisitModal({ visit, setVisit, tab, setTab, carData, setCarData, onSaveCar, scanRef, onScan, scanDraft, setScanDraft, onAcceptScan, isScanning, onPatch, onPrint, onCancel, catalogServices, selectedCatalogId, setSelectedCatalogId, showServiceForm, setShowServiceForm, newService, setNewService, onAddService, onDeleteService, onDeletePart, onUpdatePartStatus, editComment, setEditComment, showManualPartForm, setShowManualPartForm, manualPart, setManualPart, onAddManualPart, recommendations, showRecommendationForm, setShowRecommendationForm, newRecommendation, setNewRecommendation, onAddRecommendation, onRecommendationDone, onRecommendationPostpone, workflowInfo, onCopy, isStore, workPosts, mechanics }) {
  const tabs = [['overview','Огляд',Info],['passport','Техпаспорт',CarFront],['acceptance','Акт',FileText],['diagnostic','Діагностика',ClipboardCheck],['works','Роботи',Wrench],['parts','Запчастини',Package],['recommendations','Рекомендації',ClipboardList],['summary','Підсумок',Calculator]];
  const group = { client: visit.client, phone: visit.phone, plate: visit.plate, vin: visit.vin_code, car: `${carData.brand || ''} ${carData.model || ''}`.trim() || visit.plate };
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reschedule, setReschedule] = useState(timeParts(visit.scheduled_datetime));
  const saveReschedule = async () => { if (!reschedule.date || !reschedule.time) return; await onPatch('scheduled_datetime', new Date(`${reschedule.date}T${reschedule.time}`).toISOString()); setRescheduleOpen(false); };
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto sm:overflow-hidden flex items-stretch sm:items-start justify-center sm:p-4"><div className="bg-white w-full sm:max-w-5xl sm:rounded-3xl shadow-2xl flex flex-col min-h-[100dvh] sm:min-h-0 sm:max-h-[calc(100dvh-3rem)] relative overflow-y-visible sm:overflow-hidden">{isScanning && <ScanOverlay />}<div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 shrink-0"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2 mb-2"><span className="bg-blue-600 text-white rounded-xl px-3 py-1 text-xs font-black uppercase flex items-center gap-1"><Hash size={13}/> Візит №{visitId(visit)}</span><span className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-xs font-black uppercase text-slate-500">{visit.status || 'SELECTION'}</span></div><h2 className="text-2xl font-black uppercase break-words">{visit.plate}</h2><p className="text-slate-500 text-sm font-bold break-words">{visit.client} · {visit.phone}</p></div><div className="flex gap-2 shrink-0"><MacAction title="Друк" color="bg-blue-400" onClick={onPrint}><Printer size={16}/></MacAction><MacAction title="Видалити" color="bg-red-400" onClick={onCancel}><Trash2 size={16}/></MacAction><MacAction title="Закрити" color="bg-slate-300" onClick={() => setVisit(null)}><X size={16}/></MacAction></div></div><div className="mt-4 grid grid-cols-3 gap-2"><StatusBtn active={['PENDING','DRAFT','SELECTION'].includes(visit.status)} onClick={() => onPatch('status','PENDING')} label="В черзі"/><StatusBtn active={['IN_PROGRESS','ORDERED'].includes(visit.status)} onClick={() => onPatch('status','IN_PROGRESS')} label="В роботі"/><StatusBtn active={visit.status === 'DONE'} onClick={() => onPatch('status','DONE')} label="Готово"/></div><div className="mt-3 bg-white border border-slate-200 rounded-2xl p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase text-slate-400">Запис</p><p className="font-black text-slate-800 text-sm flex items-center gap-2"><Clock size={15} className="text-blue-600"/> {visitDate(visit)}</p></div></div>{rescheduleOpen && <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2"><LabeledInput label="Нова дата" type="date" value={reschedule.date} onChange={(v)=>setReschedule({...reschedule,date:v})}/><LabeledInput label="Новий час" type="time" value={reschedule.time} onChange={(v)=>setReschedule({...reschedule,time:v})}/><button type="button" onClick={saveReschedule} className="bg-blue-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase self-end">Зберегти</button></div>}</div>{!isStore && <StoAssignmentPanel visit={visit} workPosts={workPosts} mechanics={mechanics} onPatch={onPatch} />}<QuickActions visit={visit} onPrint={onPrint} onCopy={onCopy} onReschedule={() => setRescheduleOpen(!rescheduleOpen)} /></div><div className="px-4 md:px-6 pt-3 bg-white border-b border-slate-100 overflow-x-auto shrink-0"><div className="flex gap-2 min-w-max pb-3">{tabs.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase whitespace-nowrap ${tab===key?'bg-blue-600 text-white':'bg-slate-50 text-slate-500'}`}><Icon size={15}/>{label}</button>)}</div></div><div className="p-4 md:p-6 sm:overflow-y-auto sm:flex-1">{tab==='overview'&&<Overview visit={visit} carData={carData} workPosts={workPosts} mechanics={mechanics} isStore={isStore}/>} {tab==='passport'&&<Passport carData={carData} setCarData={setCarData} onSave={onSaveCar} scanRef={scanRef} onScan={onScan} scanDraft={scanDraft} setScanDraft={setScanDraft} onAcceptScan={onAcceptScan} visit={visit}/>} {tab==='acceptance'&&<VisitWorkflowPanel selectedGroup={group} lastVisit={visit} initialActive="acceptance" standalone/>} {tab==='diagnostic'&&<VisitWorkflowPanel selectedGroup={group} lastVisit={visit} initialActive="diagnostic" standalone/>} {tab==='works'&&<Works visit={visit} catalogServices={catalogServices} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} showServiceForm={showServiceForm} setShowServiceForm={setShowServiceForm} newService={newService} setNewService={setNewService} onAddService={onAddService} onDeleteService={onDeleteService} mechanics={mechanics} isStore={isStore}/>} {tab==='parts'&&<Parts visit={visit} showForm={showManualPartForm} setShowForm={setShowManualPartForm} form={manualPart} setForm={setManualPart} onSubmit={onAddManualPart} onDelete={onDeletePart} onStatus={onUpdatePartStatus}/>} {tab==='recommendations'&&<Recommendations recommendations={recommendations} showForm={showRecommendationForm} setShowForm={setShowRecommendationForm} form={newRecommendation} setForm={setNewRecommendation} onSubmit={onAddRecommendation} onDone={onRecommendationDone} onPostpone={onRecommendationPostpone}/>} {tab==='summary'&&<Summary visit={visit} recommendations={recommendations} workflowInfo={workflowInfo} editComment={editComment} setEditComment={setEditComment} onSave={() => onPatch('comment', editComment)} mechanics={mechanics} isStore={isStore} />}</div></div></div>;
}

function MacAction({ title, color, onClick, children }) { return <button type="button" title={title} aria-label={title} onClick={onClick} className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center shadow-sm hover:scale-105 transition-transform`}>{children}</button>; }
function StatusBtn({active,onClick,label}){return <button onClick={onClick} className={`py-2.5 rounded-xl text-[10px] font-black uppercase ${active?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200'}`}>{label}</button>}
function QuickActions({ visit, onPrint, onCopy, onReschedule }) { return <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"><a href={`tel:${visit.phone || ''}`} className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-2.5 px-2 text-[10px] font-black uppercase flex items-center justify-center gap-1"><Phone size={13}/> Подзвонити</a><QuickBtn onClick={()=>onCopy(visit.phone, 'Телефон')} icon={<Copy size={13}/>} label="Телефон"/><QuickBtn onClick={()=>onCopy(visit.vin_code, 'VIN')} icon={<Copy size={13}/>} label="VIN"/><QuickBtn onClick={()=>onCopy(visit.plate, 'Номер авто')} icon={<Copy size={13}/>} label="Номер"/><QuickBtn onClick={onPrint} icon={<FileDown size={13}/>} label="PDF-звіт"/><QuickBtn onClick={onReschedule} icon={<Clock size={13}/>} label="Змінити запис"/></div>; }
function QuickBtn({ onClick, icon, label }) { return <button type="button" onClick={onClick} className="bg-white text-slate-600 border border-slate-200 rounded-xl py-2.5 px-2 text-[10px] font-black uppercase flex items-center justify-center gap-1">{icon}{label}</button>; }
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
      <p className="text-[10px] font-bold text-blue-700 mt-2">
        Пост рахує зайнятість, майстер — виконані роботи і зарплату.
      </p>
    </div>
  );
}

function Overview({ visit, carData, workPosts = [], mechanics = [], isStore }) {
  const post = workPostLabel(visit.work_post_name || visit.work_post_label || visit.work_post, workPosts);
  const mechanic = mechanicLabel(visit.responsible_mechanic_name || visit.responsible_mechanic_label || visit.responsible_mechanic, mechanics);
  const payrollTotal = servicesPayrollTotal(visit);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <InfoCard label="ID" value={`№${visitId(visit)}`} />
      <InfoCard label="Дата" value={visitDate(visit)} />
      <InfoCard label="Сума" value={money(totalOf(visit))} />
      {!isStore && <InfoCard label="Пост" value={post} />}
      {!isStore && <InfoCard label="Майстер" value={mechanic} />}
      {!isStore && <InfoCard label="Нараховано майстрам" value={money(payrollTotal)} />}
      <InfoCard label="Клієнт" value={visit.client} />
      <InfoCard label="Телефон" value={visit.phone} />
      <InfoCard label="Авто" value={`${carData.brand || '—'} ${carData.model || ''} ${carData.year || ''}`} />
      <InfoCard label="VIN" value={visit.vin_code || '—'} />
      <InfoCard label="Двигун" value={`${carData.engine_volume || carData.engine || '—'} см³ ${carData.engine_power ? `· ${carData.engine_power} кВт` : ''}`} />
      <InfoCard label="Паливо" value={carData.fuel || '—'} />
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
              <p className="text-[10px] font-black uppercase text-slate-400">Майстер і нарахування</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Майстер</span>
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
                <p className="text-[10px] font-black uppercase text-blue-500">Попередньо майстру</p>
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
function Parts({visit,showForm,setShowForm,form,setForm,onSubmit,onDelete,onStatus}){const ps=partsOf(visit);const c=partCounts(visit);return <div className="space-y-3"><div className="grid grid-cols-2 md:grid-cols-4 gap-2"><MiniStatus label="Очікується" value={c.WAITING} cls="text-amber-600 bg-amber-50 border-amber-100"/><MiniStatus label="В дорозі" value={c.IN_TRANSIT} cls="text-blue-600 bg-blue-50 border-blue-100"/><MiniStatus label="Отримано" value={c.ARRIVED} cls="text-emerald-600 bg-emerald-50 border-emerald-100"/><MiniStatus label="Відмова" value={c.UNAVAILABLE} cls="text-rose-600 bg-rose-50 border-rose-100"/></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><InfoCard label="Позицій" value={ps.length}/><InfoCard label="Сума" value={money(partsTotal(visit))}/><button type="button" onClick={()=>setShowForm(!showForm)} className="bg-blue-600 text-white rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Plus size={15}/> Додати вручну</button></div>{showForm&&<ManualPartForm form={form} setForm={setForm} onSubmit={onSubmit} onCancel={()=>setShowForm(false)}/>} {ps.map(p=><div key={p.id} className="p-3 bg-slate-50 rounded-xl border flex flex-col lg:flex-row lg:items-center gap-3"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2 mb-1"><span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${supplierBadge(p)}`}>{p.supplier || 'Постачальник'}</span><span className="text-[10px] font-black uppercase text-slate-400">к-сть {p.quantity||1}</span></div><p className="font-black text-slate-800 text-sm break-words">{p.name}</p><p className="text-xs uppercase font-bold text-slate-500 break-words">{p.brand} | {p.part_number||p.article}</p><p className="text-xs font-bold text-blue-600 mt-1">{money(p.sell_price||p.price)} · закупка {money(p.buy_price)}</p></div><select value={p.status||p.logistics_status||'WAITING'} onChange={(e)=>onStatus(p.id,e.target.value)} className="border rounded-xl px-3 py-2 text-xs font-black bg-white"><option value="WAITING">Очікується</option><option value="IN_TRANSIT">В дорозі</option><option value="ARRIVED">Доставлено</option><option value="UNAVAILABLE">Відмова</option></select><button onClick={()=>onDelete(p.id)} className="text-red-500 p-2 self-start lg:self-center"><Trash2 size={16}/></button></div>)}{!ps.length&&<EmptyPanel text="Запчастини ще не додані"/>}</div>}
function MiniStatus({label,value,cls}){return <div className={`rounded-2xl border p-3 ${cls}`}><p className="text-[9px] font-black uppercase opacity-80">{label}</p><p className="text-2xl font-black leading-none mt-1">{value}</p></div>}
function ManualPartForm({ form, setForm, onSubmit, onCancel }) { return <form onSubmit={onSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-800 uppercase text-sm">Ручне додавання</h3><button type="button" onClick={onCancel} className="text-slate-400"><X size={18}/></button></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><LabeledInput label="Назва" required value={form.name} onChange={(v)=>setForm({...form,name:v})}/><LabeledInput label="Бренд" value={form.brand} onChange={(v)=>setForm({...form,brand:v})}/><LabeledInput label="Артикул" value={form.article} onChange={(v)=>setForm({...form,article:v})}/><LabeledInput label="Постачальник" value={form.supplier} onChange={(v)=>setForm({...form,supplier:v})}/><LabeledInput label="Закупка" type="number" required value={form.buy_price} onChange={(v)=>setForm({...form,buy_price:v})}/><LabeledInput label="Продаж" type="number" required value={form.sell_price} onChange={(v)=>setForm({...form,sell_price:v})}/><LabeledInput label="Кількість" type="number" required value={form.quantity} onChange={(v)=>setForm({...form,quantity:v})}/><label className="block md:col-span-2"><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Статус</span><select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none"><option value="WAITING">Очікується</option><option value="IN_TRANSIT">В дорозі</option><option value="ARRIVED">Доставлено</option><option value="UNAVAILABLE">Відмова</option></select></label></div><button className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Зберегти запчастину</button></form>}
function Recommendations({ recommendations, showForm, setShowForm, form, setForm, onSubmit, onDone, onPostpone }) { const active = recommendations.filter(r => r.status !== 'done' && r.status !== 'cancelled'); return <div className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><InfoCard label="Активні" value={active.length}/><InfoCard label="Всього" value={recommendations.length}/><button type="button" onClick={()=>setShowForm(!showForm)} className="bg-blue-600 text-white rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Plus size={15}/> Додати</button></div>{showForm&&<RecommendationForm form={form} setForm={setForm} onSubmit={onSubmit} onCancel={()=>setShowForm(false)}/>} {recommendations.map((rec)=>{const urgency=recommendationUrgency(rec);return <div key={rec.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2 mb-2"><span className={`border rounded-full px-3 py-1 text-[10px] font-black uppercase ${urgency.cls}`}>{urgency.label}</span>{rec.due_date&&<span className="text-[10px] font-black uppercase text-slate-400">до {rec.due_date}</span>}{rec.due_mileage&&<span className="text-[10px] font-black uppercase text-slate-400">{rec.due_mileage} км</span>}</div><h3 className="font-black text-slate-900 text-sm">{rec.title}</h3>{rec.description&&<p className="text-sm font-semibold text-slate-500 mt-1 whitespace-pre-wrap">{rec.description}</p>}<div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>onPostpone(rec)} className="bg-amber-50 text-amber-700 rounded-xl py-2.5 text-[10px] font-black uppercase">Відкласти</button><button onClick={()=>onDone(rec.id)} className="bg-emerald-50 text-emerald-700 rounded-xl py-2.5 text-[10px] font-black uppercase">Виконано</button></div></div>})}{!recommendations.length&&<EmptyPanel text="Рекомендації ще не додані"/>}</div>}
function RecommendationForm({ form, setForm, onSubmit, onCancel }) { return <form onSubmit={onSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"><div className="flex items-center justify-between"><h3 className="font-black text-slate-800 uppercase text-sm">Нова рекомендація</h3><button type="button" onClick={onCancel} className="text-slate-400"><X size={18}/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><LabeledInput label="Що рекомендуємо" required value={form.title} onChange={(v)=>setForm({...form,title:v})}/><LabeledInput label="Дата" type="date" value={form.due_date} onChange={(v)=>setForm({...form,due_date:v})}/><LabeledInput label="Пробіг" type="number" value={form.due_mileage} onChange={(v)=>setForm({...form,due_mileage:v})}/><label className="block md:col-span-2"><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Опис</span><textarea value={form.description || ''} onChange={(e)=>setForm({...form,description:e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none min-h-[90px]"/></label></div><button className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Зберегти рекомендацію</button></form>}
function Summary({ visit, recommendations, workflowInfo, editComment, setEditComment, onSave, mechanics = [], isStore }) {
  const c = partCounts(visit);
  const activeRecs = recommendations.filter((r) => r.status !== 'done' && r.status !== 'cancelled');
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
function CarFields({data,setData}){return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div className="flex justify-between items-center border-b pb-2 mb-3"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Дані автомобіля</p><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${data.engine_review_status==='needs_review'?'bg-amber-50 text-amber-700 border-amber-100':'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{data.engine_review_status==='needs_review'?'Двигун перевірити':'Перевірено вручну'}</span></div><div className="grid grid-cols-2 gap-3"><LabeledInput label="Марка" value={data.brand} onChange={(v)=>setData({...data,brand:v})}/><LabeledInput label="Модель" value={data.model} onChange={(v)=>setData({...data,model:v})}/><LabeledInput label="Рік" type="number" value={data.year} onChange={(v)=>setData({...data,year:v})}/><LabeledInput label="Обʼєм см³" type="number" value={data.engine_volume||data.engine} onChange={(v)=>setData({...data,engine:v,engine_volume:v,engine_review_status:'manual'})}/><LabeledInput label="Потужність кВт" type="number" value={data.engine_power} onChange={(v)=>setData({...data,engine_power:v,engine_review_status:'manual'})}/><LabeledInput label="Код двигуна" value={data.engine_code} onChange={(v)=>setData({...data,engine_code:v,engine_review_status:'manual'})}/><div className="col-span-2"><LabeledInput label="Паливо" value={data.fuel} onChange={(v)=>setData({...data,fuel:v,engine_review_status:'manual'})}/></div></div></div>}
function ScanReviewCard({data,setData,onApply,onCancel}){return <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3"><div className="flex gap-2"><AlertTriangle size={18} className="text-amber-600 shrink-0"/><div><p className="font-black text-amber-800 text-sm">Результат скану потребує перевірки</p><p className="text-xs font-semibold text-amber-700">Це обʼєднаний результат: нове фото доповнює вже знайдені дані.</p></div></div><div className="grid grid-cols-2 gap-2"><LabeledInput label="Держ. номер" value={data.plate} onChange={(v)=>setData({...data,plate:v.toUpperCase()})}/><LabeledInput label="VIN" value={data.vin_code||data.vin_candidate} onChange={(v)=>setData({...data,vin_code:v.toUpperCase()})}/><LabeledInput label="Марка" value={data.brand} onChange={(v)=>setData({...data,brand:v})}/><LabeledInput label="Модель" value={data.model} onChange={(v)=>setData({...data,model:v})}/><LabeledInput label="Рік" type="number" value={data.year} onChange={(v)=>setData({...data,year:v})}/><LabeledInput label="Обʼєм см³" type="number" value={data.engine_volume||data.engine} onChange={(v)=>setData({...data,engine:v,engine_volume:v})}/><LabeledInput label="Потужність кВт" type="number" value={data.engine_power} onChange={(v)=>setData({...data,engine_power:v})}/><LabeledInput label="Код двигуна" value={data.engine_code} onChange={(v)=>setData({...data,engine_code:v})}/><div className="col-span-2"><LabeledInput label="Паливо" value={data.fuel} onChange={(v)=>setData({...data,fuel:v})}/></div></div>{data.warnings?.length>0&&<div className="text-xs font-bold text-amber-700 space-y-1">{data.warnings.map((w,i)=><p key={i}>• {w}</p>)}</div>}<div className="flex flex-col sm:flex-row gap-2"><button type="button" onClick={onApply} className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Прийняти дані</button><button type="button" onClick={onCancel} className="flex-1 bg-white border border-amber-200 text-amber-700 rounded-xl py-3 text-xs font-black uppercase">Не використовувати</button></div></div>}
function LabeledInput({label,value,onChange,type='text',required,hint,onBlur}){return <label className="block"><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">{label}</span><input required={required} type={type} value={value||''} onBlur={onBlur} onChange={(e)=>onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-500"/>{hint&&<span className="text-[10px] font-black text-emerald-600 ml-1 mt-1 block">{hint}</span>}</label>}
function LabeledSelect({ label, value, onChange, children, hint }) { return <label className="block"><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-500">{children}</select>{hint && <span className="text-[10px] font-black text-emerald-600 ml-1 mt-1 block">{hint}</span>}</label>}
function InfoCard({label,value}){return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-800 text-sm mt-1 break-words">{value||'—'}</p></div>}
function Row({title,sub,price,onDelete}){return <div className="p-3 bg-slate-50 rounded-xl border flex justify-between items-center gap-3"><div><p className="font-bold text-slate-700 text-sm">{title}</p><p className="text-xs text-slate-400">{sub}</p></div><div className="flex items-center gap-3"><p className="font-black text-sm text-slate-800">{price}</p><button onClick={onDelete} className="text-red-500 p-1"><Trash2 size={16}/></button></div></div>}
function EmptyPanel({text}){return <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center text-slate-400 font-bold text-sm">{text}</div>}
function ScanOverlay(){return <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center text-center"><Loader2 className="animate-spin text-white mb-4" size={38}/><h3 className="text-white font-black text-xl">Розпізнаємо техпаспорт</h3><p className="text-slate-300 text-sm font-semibold mt-1">Після скану покажемо дані для перевірки</p></div>}
