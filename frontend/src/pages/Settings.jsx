import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Key,
  Link as LinkIcon,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Truck,
  User,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import useToast from '../components/ui/useToast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Alert from '../components/ui/Alert';

const getMechanicUser = (mech = {}) => mech.user || mech.employee_user || mech.profile || {};
const getMechanicName = (mech = {}) => {
  const user = getMechanicUser(mech);
  return user.first_name || user.username || mech.first_name || mech.username || mech.name || `Працівник #${mech.id || ''}`;
};

const emptyMechanicData = {
  username: '',
  password: '',
  first_name: '',
  can_create_visits: false,
  can_view_finances: false,
  commission_percent: 40,
  parts_commission_percent: 0,
  salary_scheme: 'services_only',
  payout_period: 'monthly',
  is_salary_active: true,
};

const emptyEditMechanicData = {
  first_name: '',
  new_password: '',
  can_create_visits: false,
  can_view_finances: false,
  commission_percent: 40,
  parts_commission_percent: 0,
  salary_scheme: 'services_only',
  payout_period: 'monthly',
  is_salary_active: true,
};

const emptyWorkPost = { name: '', number: 1, description: '', sort_order: 10, is_active: true };
const workPostLabel = (post = {}) => post.name || `Пост ${post.number || post.id || ''}`;

const payoutPeriodLabel = (period) => ({
  daily: 'щодня',
  weekly: 'щотижня',
  monthly: 'щомісяця',
  custom: 'довільний період',
}[period] || 'щомісяця');

const salarySchemeLabel = (scheme) => ({
  services_only: '% тільки від робіт',
  services_and_parts_profit: '% від робіт + маржа запчастин',
  order_profit: '% від прибутку замовлення',
  fixed: 'Фіксована сума',
}[scheme] || '% від робіт');

const mechanicPayrollSummary = (mech = {}) => {
  if (mech.is_salary_active === false) return 'Нарахування зарплати вимкнено';
  const workPercent = Number(mech.commission_percent ?? 40);
  const partsPercent = Number(mech.parts_commission_percent ?? 0);
  const scheme = mech.salary_scheme || 'services_only';
  const period = payoutPeriodLabel(mech.payout_period || 'monthly');
  if (scheme === 'services_and_parts_profit') return `${workPercent}% роботи + ${partsPercent}% маржі запчастин · ${period}`;
  if (scheme === 'order_profit') return `${workPercent}% від прибутку замовлення · ${period}`;
  if (scheme === 'fixed') return `Фіксована схема · ${period}`;
  return `${workPercent}% від робіт · ${period}`;
};

const mechanicPayload = (data = {}, isEdit = false) => ({
  ...(isEdit ? {} : { username: data.username || '', password: data.password || '' }),
  first_name: data.first_name || '',
  ...(isEdit ? { new_password: data.new_password || '' } : {}),
  can_create_visits: Boolean(data.can_create_visits),
  can_view_finances: Boolean(data.can_view_finances),
  commission_percent: Number(data.commission_percent || 0),
  parts_commission_percent: Number(data.parts_commission_percent || 0),
  salary_scheme: data.salary_scheme || 'services_only',
  payout_period: data.payout_period || 'monthly',
  is_salary_active: data.is_salary_active !== false,
});

const money = (value, currency = 'UAH') => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ${currency === 'UAH' ? 'грн' : currency}`;

const billingTone = (status) => {
  if (status === 'blocked') return { box: 'from-rose-600 via-red-600 to-orange-500', badge: 'bg-white/15 text-white border-white/25', icon: <AlertTriangle size={18}/> };
  if (status === 'grace' || status === 'payment_due_soon') return { box: 'from-amber-500 via-orange-500 to-yellow-500', badge: 'bg-white/15 text-white border-white/25', icon: <Clock3 size={18}/> };
  if (status === 'trial') return { box: 'from-blue-600 via-indigo-600 to-sky-500', badge: 'bg-white/15 text-white border-white/25', icon: <CalendarDays size={18}/> };
  return { box: 'from-emerald-600 via-teal-600 to-cyan-500', badge: 'bg-white/15 text-white border-white/25', icon: <CheckCircle2 size={18}/> };
};

const initialProfile = {
  user: { first_name: '', email: '', username: '' },
  company: {
    name: '',
    logo: null,
    phone: '',
    address: '',
    document_footer: '',
    document_requisites: '',
    document_signature: '',
    document_warranty_text: '',
    payment_link: '',
    payment_requisites: '',
    payment_instruction: '',
    global_margin_percent: 20,
    business_type: 'sto',
  },
  role: 'owner',
  billing: null,
};

const initialFormData = {
  first_name: '',
  email: '',
  company_name: '',
  phone: '',
  address: '',
  document_footer: '',
  document_requisites: '',
  document_signature: '',
  document_warranty_text: '',
  payment_link: '',
  payment_requisites: '',
  payment_instruction: '',
  global_margin_percent: 20,
  logo: null,
  business_type: 'sto',
};

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState(initialProfile);
  const [mechanics, setMechanics] = useState([]);
  const [workPosts, setWorkPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingMechanic, setIsAddingMechanic] = useState(false);
  const [isEditingMechanic, setIsEditingMechanic] = useState(null);
  const [isAddingWorkPost, setIsAddingWorkPost] = useState(false);
  const [isEditingWorkPost, setIsEditingWorkPost] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingNotice, setBillingNotice] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
  const [mechanicData, setMechanicData] = useState({ ...emptyMechanicData });
  const [editMechanicData, setEditMechanicData] = useState({ ...emptyEditMechanicData });
  const [workPostData, setWorkPostData] = useState({ ...emptyWorkPost });
  const [editWorkPostData, setEditWorkPostData] = useState({ ...emptyWorkPost });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const openConfirm = (config) => setConfirmDialog(config);
  const closeConfirm = () => setConfirmDialog(null);
  const runConfirm = async () => {
    const action = confirmDialog?.onConfirm;
    setConfirmDialog(null);
    if (action) await action();
  };

  const fetchData = async () => {
    try {
      const profileRes = await api.get('/api/settings/');
      const nextProfile = profileRes.data || {};
      const nextCompany = nextProfile.company || {};

      setProfile({
        user: nextProfile.user || {},
        company: nextCompany,
        role: nextProfile.role || 'owner',
        billing: nextProfile.billing || null,
        ...nextProfile,
      });

      if (nextProfile.role === 'owner') {
        const [mechanicsRes, workPostsRes] = await Promise.all([
          api.get('/api/mechanics/').catch(() => ({ data: [] })),
          api.get('/api/work-posts/').catch(() => ({ data: [] })),
        ]);

        setMechanics(Array.isArray(mechanicsRes.data) ? mechanicsRes.data : []);
        setWorkPosts(Array.isArray(workPostsRes.data) ? workPostsRes.data : []);
        setFormData({
          first_name: nextProfile.user?.first_name || '',
          email: nextProfile.user?.email || '',
          company_name: nextCompany.name || '',
          phone: nextCompany.phone || '',
          address: nextCompany.address || '',
          document_footer: nextCompany.document_footer || '',
          document_requisites: nextCompany.document_requisites || '',
          document_signature: nextCompany.document_signature || '',
          document_warranty_text: nextCompany.document_warranty_text || '',
          payment_link: nextCompany.payment_link || '',
          payment_requisites: nextCompany.payment_requisites || '',
          payment_instruction: nextCompany.payment_instruction || '',
          global_margin_percent: nextCompany.global_margin_percent || 20,
          business_type: nextCompany.business_type || 'sto',
          logo: null,
        });
      }
    } catch (error) {
      if (error.response?.status === 401) navigate('/login');
      else toast.error('Не вдалося завантажити налаштування.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [navigate]);

  const requestPayment = async (method = 'monobank_jar') => {
    setBillingLoading(true);
    setBillingNotice('');
    try {
      const res = await api.post('/api/billing/payment-request/', {
        method,
        comment: method === 'cash' ? 'Клієнт планує оплату готівкою' : 'Клієнт натиснув “Я оплатив” у кабінеті',
      });
      setBillingNotice(res.data?.message || 'Заявку створено. Ми перевіримо оплату і підтвердимо доступ.');
      toast.success('Заявку на оплату створено.');
      await fetchData();
    } catch (error) {
      const message = error.response?.data?.error || 'Не вдалося створити заявку на оплату.';
      setBillingNotice(message);
      toast.error(message);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);

    const data = new FormData();
    data.append('user[first_name]', formData.first_name);
    data.append('company[name]', formData.company_name);
    data.append('company[phone]', formData.phone);
    data.append('company[address]', formData.address);
    data.append('company[document_footer]', formData.document_footer);
    data.append('company[document_requisites]', formData.document_requisites);
    data.append('company[document_signature]', formData.document_signature);
    data.append('company[document_warranty_text]', formData.document_warranty_text);
    data.append('company[payment_link]', formData.payment_link);
    data.append('company[payment_requisites]', formData.payment_requisites);
    data.append('company[payment_instruction]', formData.payment_instruction);
    data.append('company[global_margin_percent]', formData.global_margin_percent);
    data.append('company[business_type]', formData.business_type);
    if (formData.logo) data.append('company[logo]', formData.logo);

    try {
      await api.patch('/api/settings/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBillingNotice('Налаштування збережено.');
      toast.success('Налаштування збережено.');
      await fetchData();
      setIsEditingProfile(false);
    } catch (error) {
      const message = error.response?.data?.error || 'Помилка збереження налаштувань.';
      setBillingNotice(message);
      toast.error(message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) return toast.warning('Паролі не збігаються.');
    if (!passData.old || !passData.new) return toast.warning('Заповніть старий і новий пароль.');

    try {
      await api.post('/api/change-password/', {
        old_password: passData.old,
        new_password: passData.new,
      });
      toast.success('Пароль змінено.');
      setIsChangingPassword(false);
      setPassData({ old: '', new: '', confirm: '' });
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Помилка зміни пароля.');
    }
  };

  const handleAddMechanic = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/mechanics/', mechanicPayload(mechanicData));
      toast.success('Працівника додано.');
      setIsAddingMechanic(false);
      setMechanicData({ ...emptyMechanicData });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Помилка. Логін може бути зайнятий.');
    }
  };

  const handleDeleteMechanic = (id) => {
    openConfirm({
      title: 'Видалити працівника?',
      message: 'Працівника буде видалено назавжди. Якщо він уже привʼязаний до візитів, краще спочатку перевірити історію.',
      confirmText: 'Видалити',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/api/mechanics/${id}/`);
          toast.success('Працівника видалено.');
          fetchData();
        } catch {
          toast.error('Помилка видалення працівника.');
        }
      },
    });
  };

  const handleUpdateMechanic = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/api/mechanics/${isEditingMechanic}/`, mechanicPayload(editMechanicData, true));
      toast.success('Дані працівника оновлено.');
      setIsEditingMechanic(null);
      fetchData();
    } catch {
      toast.error('Помилка оновлення працівника.');
    }
  };

  const normalizeWorkPostPayload = (data = {}) => {
    const number = Number(data.number || 1);
    return {
      name: String(data.name || '').trim(),
      number,
      description: data.description || '',
      sort_order: number * 10,
      is_active: data.is_active !== false,
    };
  };

  const handleAddWorkPost = async (e) => {
    e.preventDefault();
    const payload = normalizeWorkPostPayload(workPostData);
    if (!payload.name) return toast.warning('Вкажіть назву поста.');

    try {
      await api.post('/api/work-posts/', payload);
      toast.success('Пост додано.');
      setIsAddingWorkPost(false);
      setWorkPostData({ ...emptyWorkPost, number: workPosts.length + 2, sort_order: (workPosts.length + 2) * 10 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Помилка створення поста.');
    }
  };

  const handleUpdateWorkPost = async (e) => {
    e.preventDefault();
    const payload = normalizeWorkPostPayload(editWorkPostData);
    if (!payload.name) return toast.warning('Вкажіть назву поста.');

    try {
      await api.patch(`/api/work-posts/${isEditingWorkPost}/`, payload);
      toast.success('Пост оновлено.');
      setIsEditingWorkPost(null);
      fetchData();
    } catch {
      toast.error('Помилка оновлення поста.');
    }
  };

  const handleDeleteWorkPost = (id) => {
    openConfirm({
      title: 'Видалити пост?',
      message: 'Якщо пост уже використовується у візитах, безпечніше відкрити редагування і вимкнути “Активний”. Видаляти варто тільки зайві або помилково створені пости.',
      confirmText: 'Видалити пост',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/api/work-posts/${id}/`);
          toast.success('Пост видалено.');
          fetchData();
        } catch {
          toast.error('Не вдалося видалити пост. Якщо він уже використовується у візитах, відкрийте редагування і вимкніть “Активний”.');
        }
      },
    });
  };

  const openAddWorkPostModal = () => {
    const nextNumber = workPosts.length + 1;
    setWorkPostData({ ...emptyWorkPost, number: nextNumber, sort_order: nextNumber * 10 });
    setIsAddingWorkPost(true);
  };

  const openEditWorkPostModal = (post) => {
    setIsEditingWorkPost(post.id);
    setEditWorkPostData({
      name: post.name || '',
      number: post.number || 1,
      description: post.description || '',
      sort_order: post.sort_order || post.number || 100,
      is_active: post.is_active !== false,
    });
  };

  const openEditMechanicModal = (mech) => {
    const name = getMechanicName(mech);
    setIsEditingMechanic(mech.id);
    setEditMechanicData({
      first_name: name,
      new_password: '',
      can_create_visits: Boolean(mech.can_create_visits),
      can_view_finances: Boolean(mech.can_view_finances),
      commission_percent: mech.commission_percent ?? 40,
      parts_commission_percent: mech.parts_commission_percent ?? 0,
      salary_scheme: mech.salary_scheme || 'services_only',
      payout_period: mech.payout_period || 'monthly',
      is_salary_active: mech.is_salary_active !== false,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-slate-100 rounded-[28px] px-8 py-6 shadow-sm text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><SlidersHorizontal size={20}/></div>
          <p className="font-black uppercase italic text-slate-900">VIN-MATRIX</p>
          <p className="text-sm font-bold text-slate-400 mt-1">Завантаження налаштувань...</p>
        </div>
      </div>
    );
  }

  if (profile.role === 'mechanic') {
    return (
      <MechanicAccountView
        profile={profile}
        onLogout={() => { localStorage.clear(); navigate('/login'); }}
      />
    );
  }

  const company = profile.company || {};
  const isSto = company.business_type === 'sto';
  const billing = profile.billing || {};
  const tone = billingTone(billing.billing_status || billing.status);
  const activePosts = workPosts.filter((post) => post.is_active !== false).length;
  const paymentReady = Boolean(company.payment_link || company.payment_requisites || company.payment_instruction);

  const sectionCards = [
    ...(isSto ? [{ icon: <Wrench size={22}/>, title: 'Послуги', desc: 'Прайс робіт і стандартних послуг', path: '/settings/services' }] : []),
    { icon: <Truck size={22}/>, title: 'Доставка', desc: 'Нова пошта, відправники, API-ключі', path: '/settings/delivery' },
    { icon: <SlidersHorizontal size={22}/>, title: 'Статуси і довідники', desc: 'Статуси, типи оплат, джерела, причини відмов і категорії', path: '/settings/dictionaries' },
    { icon: <FileText size={22}/>, title: 'Документи', desc: 'Реквізити, гарантія, підписи та текст бланків', path: '/settings/documents' },
    { icon: <FileSpreadsheet size={22}/>, title: 'Дані', desc: 'Імпорт, експорт і резервна копія бізнесу', path: '/data' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 p-3 md:p-6 w-full overflow-x-hidden">
      <HeaderBlock
        isSto={isSto}
        company={company}
        onLogout={() => { localStorage.clear(); navigate('/login'); }}
      />

      <BillingCard billing={billing} tone={tone} notice={billingNotice} loading={billingLoading} onPayment={requestPayment} />

      <div className={`grid grid-cols-1 ${sectionCards.length >= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : sectionCards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {sectionCards.map((card) => <SettingsNavCard key={card.title} {...card} onClick={() => navigate(card.path)} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <CompanyProfileCard
            company={company}
            user={profile.user || {}}
            isSto={isSto}
            activePosts={activePosts}
            mechanicsCount={mechanics.length}
            onEdit={() => setIsEditingProfile(true)}
          />

          <PaymentSettingsCard
            company={company}
            ready={paymentReady}
            onEdit={() => setIsEditingProfile(true)}
          />

          {isSto && (
            <WorkPostsPanel
              posts={workPosts}
              onAdd={openAddWorkPostModal}
              onEdit={openEditWorkPostModal}
              onDelete={handleDeleteWorkPost}
            />
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <SecurityCard onChangePassword={() => setIsChangingPassword(true)} />

          <SupportCard />

          {isSto && (
            <TeamPanel
              mechanics={mechanics}
              onAdd={() => setIsAddingMechanic(true)}
              onEdit={openEditMechanicModal}
              onDelete={handleDeleteMechanic}
            />
          )}
        </div>
      </div>

      {isEditingProfile && (
        <Modal title="Профіль компанії" onClose={() => setIsEditingProfile(false)}>
          <ProfileForm
            formData={formData}
            setFormData={setFormData}
            profile={profile}
            saveLoading={saveLoading}
            billingNotice={billingNotice}
            onSubmit={handleSaveProfile}
            onClose={() => setIsEditingProfile(false)}
          />
        </Modal>
      )}

      {isChangingPassword && (
        <PasswordModal
          data={passData}
          setData={setPassData}
          onSubmit={handleChangePassword}
          onClose={() => setIsChangingPassword(false)}
        />
      )}

      {isAddingWorkPost && (
        <WorkPostModal
          title="Новий пост / підйомник"
          data={workPostData}
          setData={setWorkPostData}
          onSubmit={handleAddWorkPost}
          onClose={() => setIsAddingWorkPost(false)}
        />
      )}

      {isEditingWorkPost && (
        <WorkPostModal
          title="Редагувати пост"
          data={editWorkPostData}
          setData={setEditWorkPostData}
          onSubmit={handleUpdateWorkPost}
          onClose={() => setIsEditingWorkPost(null)}
        />
      )}

      {isAddingMechanic && (
        <MechanicModal
          title="Новий працівник"
          data={mechanicData}
          setData={setMechanicData}
          onSubmit={handleAddMechanic}
          onClose={() => setIsAddingMechanic(false)}
        />
      )}

      {isEditingMechanic && (
        <MechanicModal
          title="Редагувати працівника"
          data={editMechanicData}
          setData={setEditMechanicData}
          onSubmit={handleUpdateMechanic}
          onClose={() => setIsEditingMechanic(null)}
          isEdit
        />
      )}

      {confirmDialog && <ConfirmModal dialog={confirmDialog} onCancel={closeConfirm} onConfirm={runConfirm} />}
    </div>
  );
}

function HeaderBlock({ isSto, company, onLogout }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mt-4 md:mt-0">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-blue-700">
            <SlidersHorizontal size={13}/>
            Налаштування системи
          </span>
          <span className="inline-flex items-center rounded-full bg-white border border-slate-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-600">
            {isSto ? 'Режим СТО' : 'Режим Магазин'}
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tight text-slate-950">Налаштування</h1>
        <p className="text-sm md:text-base text-slate-500 font-semibold mt-3 max-w-3xl">
          Компанія, документи, оплата, команда, пости, тариф і службові розділи в одному центрі керування.
        </p>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="self-start lg:self-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 border border-rose-100 px-5 py-3 text-xs font-black uppercase text-rose-600 hover:bg-rose-100 transition"
      >
        <LogOut size={17}/>
        Вийти
      </button>
    </div>
  );
}

function CompanyProfileCard({ company, user, isSto, activePosts, mechanicsCount, onEdit }) {
  return (
    <section className="bg-white rounded-[34px] shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-950 via-blue-800 to-cyan-500 p-5 md:p-7 text-white">
        <div className="flex items-center gap-2 text-blue-100 text-[11px] font-black uppercase tracking-widest">
          <Building2 size={15}/>
          Профіль компанії
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 mt-6">
          <div className="w-24 h-24 bg-white/95 rounded-3xl shrink-0 overflow-hidden border border-white/30 shadow-xl flex items-center justify-center">
            {company.logo ? <img src={company.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-300" size={34} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-black truncate">{company.name || 'Компанія'}</h2>
              <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white">
                {isSto ? 'СТО' : 'Магазин'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm font-bold text-blue-50">
              <p className="flex items-center gap-2 min-w-0"><MapPin size={15} className="shrink-0"/><span className="truncate">{company.address || 'Адреса не вказана'}</span></p>
              <p className="flex items-center gap-2 min-w-0"><Phone size={15} className="shrink-0"/><span className="truncate">{company.phone || 'Телефон не вказаний'}</span></p>
              <p className="flex items-center gap-2"><DollarSign size={15} className="shrink-0"/> Націнка: {company.global_margin_percent || 20}%</p>
              <p className="flex items-center gap-2 min-w-0"><User size={15} className="shrink-0"/><span className="truncate">{user.first_name || user.username || 'Власник'}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 md:items-center">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniMetric label="Тип бізнесу" value={isSto ? 'СТО' : 'Магазин'} />
          <MiniMetric label="Команда" value={`${mechanicsCount} працівн.`} />
          <MiniMetric label="Активні пости" value={`${activePosts}`} />
        </div>
        <Button type="button" onClick={onEdit} icon={<Pencil size={17}/>}>Змінити профіль</Button>
      </div>
    </section>
  );
}

function PaymentSettingsCard({ company, ready, onEdit }) {
  return (
    <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-700">
            <Wallet size={15}/>
            Оплата клієнтів
          </div>
          <h3 className="mt-2 text-xl md:text-2xl font-black uppercase text-slate-950">Реквізити і посилання</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 max-w-2xl">
            Цей блок потрібен менеджеру, щоб швидко відправити клієнту оплату без ручного пошуку реквізитів.
          </p>
        </div>
        <span className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-black uppercase ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
          {ready ? 'Заповнено' : 'Потрібно заповнити'}
        </span>
      </div>

      <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <InfoBox icon={<LinkIcon size={16}/>} label="Посилання" value={company.payment_link || 'Не вказано'} mono={Boolean(company.payment_link)} />
        <InfoBox icon={<CreditCard size={16}/>} label="Реквізити" value={company.payment_requisites || 'Не вказано'} />
        <InfoBox icon={<FileText size={16}/>} label="Інструкція" value={company.payment_instruction || 'Не вказано'} />
      </div>

      <div className="px-5 md:px-6 pb-5 md:pb-6">
        <Button type="button" variant="secondary" onClick={onEdit} icon={<Pencil size={16}/>}>Редагувати оплату</Button>
      </div>
    </section>
  );
}

function SecurityCard({ onChangePassword }) {
  return (
    <section className="bg-white p-5 md:p-6 rounded-[30px] shadow-sm border border-slate-100">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-slate-900"><ShieldAlert className="text-purple-600" size={18}/> Безпека</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1">Пароль власника системи.</p>
        </div>
        <span className="text-[11px] font-black uppercase px-2 py-1 rounded-full bg-purple-50 text-purple-700">Акаунт</span>
      </div>
      <Button type="button" variant="secondary" className="w-full" onClick={onChangePassword} icon={<Key size={17}/>}>Змінити пароль</Button>
    </section>
  );
}


function SupportCard() {
  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-blue-900 to-blue-600 p-5 text-white">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-100">
            <ShieldCheck size={21} />
          </span>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">
              VIN-matrix
            </p>
            <h3 className="mt-1 text-base font-black uppercase">
              Допомога та підтримка
            </h3>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-blue-100">
              Напишіть або зателефонуйте, якщо потрібна допомога з доступом,
              налаштуванням або роботою в системі.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4">
        <a
          href="https://t.me/vin_matrix"
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
            <MessageCircle size={20} />
          </span>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              Telegram
            </p>
            <p className="mt-0.5 truncate text-sm font-black text-slate-900">
              @vin_matrix
            </p>
          </div>
        </a>

        <a
          href="tel:+380636699617"
          className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
            <Phone size={20} />
          </span>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              Телефон підтримки
            </p>
            <p className="mt-0.5 truncate text-sm font-black text-slate-900">
              +380 63 669 96 17
            </p>
          </div>
        </a>
      </div>

      <div className="mx-4 mb-4 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-600">
        Підтримка VIN-matrix не просить повідомляти пароль або коди доступу.
        Для захисту облікового запису не передавайте ці дані третім особам.
      </div>
    </section>
  );
}

function TeamPanel({ mechanics = [], onAdd, onEdit, onDelete }) {
  return (
    <section className="bg-white rounded-[30px] shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 md:p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-slate-900"><Users className="text-blue-600" size={18}/> Команда</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1">Працівники, доступи і правила зарплати.</p>
        </div>
        <Button type="button" size="sm" onClick={onAdd} icon={<Plus size={16}/>}>Додати</Button>
      </div>

      <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
        {mechanics.map((mech) => (
          <MechanicCard key={mech.id || getMechanicName(mech)} mech={mech} onEdit={() => onEdit(mech)} onDelete={() => onDelete(mech.id)} />
        ))}
        {mechanics.length === 0 && <EmptyInline icon={<Users size={30}/>} title="Працівників ще немає" text="Додайте майстра або менеджера, щоб налаштувати доступи і зарплату." />}
      </div>
    </section>
  );
}

function MechanicCard({ mech, onEdit, onDelete }) {
  const name = getMechanicName(mech);
  const isActive = mech.is_salary_active !== false;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-slate-950 truncate">{name}</p>
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{isActive ? 'ЗП активна' : 'ЗП вимкнено'}</span>
          </div>
          <p className="text-[11px] text-slate-400 font-black uppercase mt-1">{mech.can_view_finances ? 'Фінанси доступні' : 'Майстер'}</p>
          <p className="text-xs font-black text-slate-700 mt-2">{mechanicPayrollSummary(mech)}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">{salarySchemeLabel(mech.salary_scheme)} · {payoutPeriodLabel(mech.payout_period)}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <IconButton label="Редагувати" onClick={onEdit} tone="blue"><Pencil size={15}/></IconButton>
          <IconButton label="Видалити" onClick={onDelete} tone="red"><Trash2 size={15}/></IconButton>
        </div>
      </div>
    </div>
  );
}

function WorkPostsPanel({ posts = [], onAdd, onEdit, onDelete }) {
  const sortedPosts = [...posts].sort((a, b) => Number(a.number || 0) - Number(b.number || 0));

  return (
    <section className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 md:p-6 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-slate-900"><Building2 className="text-blue-600" size={18}/> Пости / підйомники</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1">Робочі місця СТО для планування завантаження, майстрів і аналітики.</p>
        </div>
        <Button type="button" onClick={onAdd} icon={<Plus size={16}/>}>Додати пост</Button>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white border-b border-slate-100">
            <tr>
              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Пост</th>
              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Опис</th>
              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Статус</th>
              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {sortedPosts.map((post) => (
              <tr key={post.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">{post.number || '—'}</span>
                    <div>
                      <p className="font-black text-slate-950">{workPostLabel(post)}</p>
                      <p className="text-[11px] font-bold uppercase text-slate-400">Сортування {post.sort_order || post.number || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-500 max-w-md">{post.description || '—'}</td>
                <td className="px-5 py-4"><StatusPill active={post.is_active !== false} /></td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <IconButton label="Редагувати" tone="blue" onClick={() => onEdit(post)}><Pencil size={15}/></IconButton>
                    <IconButton label="Видалити" tone="red" onClick={() => onDelete(post.id)}><Trash2 size={15}/></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden p-4 space-y-3">
        {sortedPosts.map((post) => (
          <div key={post.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-950 truncate">{workPostLabel(post)}</p>
                  <span className="text-[11px] font-black uppercase px-2 py-1 rounded-full bg-blue-50 text-blue-700">№{post.number || '—'}</span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-1">{post.description || 'Без опису'}</p>
                <div className="mt-3"><StatusPill active={post.is_active !== false} /></div>
              </div>
              <div className="flex gap-1 shrink-0">
                <IconButton label="Редагувати" tone="blue" onClick={() => onEdit(post)}><Pencil size={15}/></IconButton>
                <IconButton label="Видалити" tone="red" onClick={() => onDelete(post.id)}><Trash2 size={15}/></IconButton>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sortedPosts.length === 0 && <div className="p-5"><EmptyInline icon={<Building2 size={34}/>} title="Пости ще не створені" text="Додайте “Пост 1”, “Підйомник 2”, “Діагностика” або інші робочі місця." /></div>}
    </section>
  );
}

function BillingCard({ billing = {}, tone, notice, loading, onPayment }) {
  return (
    <section className={`rounded-[34px] overflow-hidden shadow-xl shadow-slate-200/70 bg-gradient-to-r ${tone.box} text-white`}>
      <div className="p-5 md:p-7 grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6 items-stretch">
        <div>
          <div className="flex items-center gap-2 text-white/80 text-[11px] font-black uppercase tracking-widest"><CreditCard size={15}/> Білінг і тариф</div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black uppercase italic">{billing.plan_name || 'VIN-matrix Full'}</h2>
            <span className={`px-3 py-1.5 rounded-full border text-[11px] font-black uppercase ${tone.badge}`}>{billing.label || 'Активний'}</span>
          </div>
          <p className="mt-3 text-sm md:text-base font-bold text-white/90 max-w-2xl">{billing.message || '14 днів безкоштовно, потім 2000 грн/місяць. Усі функції включені.'}</p>
          {notice && <div className="mt-4 bg-white/15 border border-white/20 rounded-2xl px-4 py-3 text-sm font-bold">{notice}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <BillingMetric icon={<DollarSign size={16}/>} label="Сума" value={money(billing.price || 2000, billing.currency || 'UAH')} />
          <BillingMetric icon={tone.icon} label="Статус" value={billing.label || 'Активний'} />
          <BillingMetric icon={<CalendarDays size={16}/>} label="Дата" value={billing.subscription_end_display || billing.trial_until_display || '14 днів тест'} />
          <BillingMetric icon={<Clock3 size={16}/>} label="Днів" value={billing.days_left !== null && billing.days_left !== undefined ? `${billing.days_left} дн.` : billing.grace_days_left ? `${billing.grace_days_left} дн.` : '—'} />
        </div>
      </div>
      <div className="bg-white/12 border-t border-white/15 p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-xs font-bold text-white/80">Оплата поки вручну: Monobank банка або готівка. Після перевірки адміністратор підтвердить доступ.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
          <button disabled={loading} onClick={() => onPayment('monobank_jar')} className="bg-white text-slate-900 rounded-2xl px-5 py-3 text-xs font-black uppercase hover:bg-slate-50 disabled:opacity-60">{loading ? 'Зачекайте...' : 'Я оплатив'}</button>
          <button disabled={loading} onClick={() => onPayment('cash')} className="bg-slate-900/35 border border-white/20 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase hover:bg-slate-900/50 disabled:opacity-60">Оплата готівкою</button>
        </div>
      </div>
    </section>
  );
}

function ProfileForm({ formData, setFormData, profile, saveLoading, billingNotice, onSubmit, onClose }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {billingNotice && <Alert variant={billingNotice.includes('Помилка') ? 'error' : 'success'}>{billingNotice}</Alert>}

      <Card className="space-y-4">
        <SectionTitle title="Дані компанії" desc="Основні контакти для CRM і документів." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Ваше ім'я" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
          <Input label="Назва компанії" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
          <Input label="Телефон" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          <Input label="Адреса" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="Режим бізнесу" desc="Впливає на назви дошок і робочі сценарії." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select label="Тип бізнесу" value={formData.business_type} onChange={e => setFormData({ ...formData, business_type: e.target.value })} options={[{ value: 'sto', label: 'СТО' }, { value: 'store', label: 'Магазин автозапчастин' }]} />
          <Input type="number" label="Глобальна націнка, %" value={formData.global_margin_percent} onChange={e => setFormData({ ...formData, global_margin_percent: e.target.value })} />
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="Оплата" desc="Окремий блок для посилання, реквізитів і короткої інструкції клієнту." />
        <Input label="Посилання на оплату" value={formData.payment_link} onChange={e => setFormData({ ...formData, payment_link: e.target.value })} placeholder="https://..." />
        <Textarea label="Реквізити для оплати" value={formData.payment_requisites} onChange={v => setFormData({ ...formData, payment_requisites: v })} />
        <Textarea label="Коротка інструкція для клієнта" value={formData.payment_instruction} onChange={v => setFormData({ ...formData, payment_instruction: v })} compact />
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="Документи" desc="Реквізити, футер, підпис і гарантійний текст для PDF." />
        <Textarea label="Текст у футері документів" value={formData.document_footer} onChange={v => setFormData({ ...formData, document_footer: v })} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Підпис" value={formData.document_signature} onChange={e => setFormData({ ...formData, document_signature: e.target.value })} />
          <Textarea label="Текст гарантії" value={formData.document_warranty_text} onChange={v => setFormData({ ...formData, document_warranty_text: v })} compact />
        </div>
        <Textarea label="Реквізити для документів" value={formData.document_requisites} onChange={v => setFormData({ ...formData, document_requisites: v })} />
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="Логотип" desc="PNG або JPG для документів і шапки компанії." />
        <label className="block rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition">
          <input type="file" accept="image/*" onChange={e => setFormData({ ...formData, logo: e.target.files?.[0] || null })} className="hidden" />
          <ImageIcon className="mx-auto text-blue-600" size={28}/>
          <p className="mt-2 font-black text-slate-900">{formData.logo?.name || 'Оберіть файл логотипа'}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Поточний логотип не буде змінено, якщо файл не обрано.</p>
        </label>
        {profile.company?.logo && <img src={profile.company.logo} alt="Логотип" className="max-h-20 rounded-2xl border border-slate-100 bg-white p-2" />}
      </Card>

      <div className="sticky bottom-0 -mx-6 -mb-6 bg-white/95 border-t border-slate-100 p-5 rounded-b-3xl flex flex-col sm:flex-row gap-3 sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Скасувати</Button>
        <Button type="submit" loading={saveLoading} icon={<Save size={18}/>}>Зберегти</Button>
      </div>
    </form>
  );
}

function PasswordModal({ data, setData, onSubmit, onClose }) {
  return (
    <Modal title="Зміна пароля" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-3">
          <SectionTitle title="Безпека акаунта" desc="Після зміни пароля використовуйте новий пароль для входу." />
          <Input password label="Старий пароль" value={data.old} onChange={e => setData({ ...data, old: e.target.value })} required />
          <Input password label="Новий пароль" value={data.new} onChange={e => setData({ ...data, new: e.target.value })} required />
          <Input password label="Повторіть новий пароль" value={data.confirm} onChange={e => setData({ ...data, confirm: e.target.value })} required />
        </Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button type="submit" variant="dark" icon={<Key size={18}/>}>Оновити пароль</Button>
        </div>
      </form>
    </Modal>
  );
}

function WorkPostModal({ title, data, setData, onSubmit, onClose }) {
  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-4">
          <SectionTitle title="Робоче місце" desc="Назва і номер поста будуть показуватись у візитах та аналітиці." />
          <Input required label="Назва" placeholder="Наприклад: Пост 1 або Діагностика" value={data.name || ''} onChange={e => setData({ ...data, name: e.target.value })} />
          <Input type="number" min="1" label="Номер поста" value={data.number || 1} onChange={e => setData({ ...data, number: e.target.value })} helperText="Пости у списку автоматично йдуть за номером: 1, 2, 3..." />
          <Textarea label="Опис" value={data.description || ''} onChange={v => setData({ ...data, description: v })} compact />
          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-sm border border-slate-100">
            <input type="checkbox" checked={data.is_active !== false} onChange={e => setData({ ...data, is_active: e.target.checked })} />
            Активний пост
          </label>
        </Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button type="submit" icon={<Save size={18}/>}>Зберегти пост</Button>
        </div>
      </form>
    </Modal>
  );
}

function MechanicModal({ title, data, setData, onSubmit, onClose, isEdit }) {
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-4">
          <SectionTitle title="Дані працівника" desc="Логін і доступи для роботи в системі." />
          <Input label="Ім'я майстра" value={data.first_name || ''} onChange={e => setData({ ...data, first_name: e.target.value })} />
          {!isEdit && <Input label="Логін" value={data.username || ''} onChange={e => setData({ ...data, username: e.target.value })} />}
          <Input password label={isEdit ? "Новий пароль (необов'язково)" : 'Пароль'} value={isEdit ? (data.new_password || '') : (data.password || '')} onChange={e => setData({ ...data, [isEdit ? 'new_password' : 'password']: e.target.value })} />
        </Card>

        <Card className="space-y-4 bg-blue-50/50 border-blue-100">
          <SectionTitle title="Зарплата майстра" desc="Ці правила підтягнуться у роботи та аналітику. Відсоток у вже створених роботах зберігається окремо." />
          <Select label="Схема нарахування" value={data.salary_scheme || 'services_only'} onChange={e => setData({ ...data, salary_scheme: e.target.value })} options={[
            { value: 'services_only', label: 'Відсоток тільки від робіт' },
            { value: 'services_and_parts_profit', label: 'Роботи + відсоток від маржі запчастин' },
            { value: 'order_profit', label: 'Відсоток від прибутку замовлення' },
            { value: 'fixed', label: 'Фіксована схема' },
          ]} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input type="number" min="0" max="100" step="0.01" label="% від робіт" value={data.commission_percent ?? 40} onChange={e => setData({ ...data, commission_percent: e.target.value })} />
            <Input type="number" min="0" max="100" step="0.01" label="% від маржі запчастин" value={data.parts_commission_percent ?? 0} onChange={e => setData({ ...data, parts_commission_percent: e.target.value })} />
          </div>
          <Select label="Період виплати" value={data.payout_period || 'monthly'} onChange={e => setData({ ...data, payout_period: e.target.value })} options={[
            { value: 'daily', label: 'Щодня' },
            { value: 'weekly', label: 'Щотижня' },
            { value: 'monthly', label: 'Щомісяця' },
            { value: 'custom', label: 'Довільний період' },
          ]} />
          <div className="bg-white/80 rounded-2xl p-3 border border-blue-100">
            <p className="text-[11px] font-black uppercase text-slate-400">Як буде показано</p>
            <p className="text-xs font-black text-slate-800 mt-1">{mechanicPayrollSummary(data)}</p>
          </div>
          <label className="flex items-center gap-3 p-4 bg-white rounded-2xl font-bold text-sm border border-blue-100">
            <input type="checkbox" checked={data.is_salary_active !== false} onChange={e => setData({ ...data, is_salary_active: e.target.checked })} />
            Нарахування зарплати активне
          </label>
        </Card>

        <Card className="space-y-3">
          <SectionTitle title="Права доступу" desc="Що працівник може робити в системі." />
          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-sm border border-slate-100">
            <input type="checkbox" checked={Boolean(data.can_create_visits)} onChange={e => setData({ ...data, can_create_visits: e.target.checked })} />
            Створювати візити
          </label>
          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-sm border border-slate-100">
            <input type="checkbox" checked={Boolean(data.can_view_finances)} onChange={e => setData({ ...data, can_view_finances: e.target.checked })} />
            Бачити фінанси
          </label>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button type="submit" icon={<Save size={18}/>}>Зберегти</Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose, maxWidth = 'max-w-[940px]' }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-hidden">
      <div className={`bg-white w-full ${maxWidth} rounded-[30px] shadow-2xl max-h-[calc(100vh-40px)] overflow-hidden flex flex-col`}>
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 md:px-6 py-5 border-b border-slate-200 bg-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600 mb-1">VIN-matrix</p>
            <h2 className="text-2xl md:text-3xl font-black uppercase text-slate-950 leading-tight">{title}</h2>
          </div>
          <button onClick={onClose} type="button" className="h-11 w-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
            <X size={20}/>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ dialog, onCancel, onConfirm }) {
  const danger = dialog.tone === 'danger';
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[28px] bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <p className={`text-[11px] font-black uppercase tracking-[0.18em] mb-1 ${danger ? 'text-rose-600' : 'text-blue-600'}`}>Підтвердження</p>
          <h3 className="text-xl font-black uppercase text-slate-950">{dialog.title || 'Підтвердити дію?'}</h3>
          {dialog.message && <p className="mt-2 text-sm font-semibold text-slate-500 leading-relaxed">{dialog.message}</p>}
        </div>
        <div className="p-4 flex flex-col sm:flex-row sm:justify-end gap-2 bg-slate-50">
          <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-100">Скасувати</button>
          <button type="button" onClick={onConfirm} className={`rounded-2xl px-5 py-3 text-xs font-black uppercase text-white shadow-lg ${danger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}>{dialog.confirmText || 'Підтвердити'}</button>
        </div>
      </div>
    </div>
  );
}

function MechanicAccountView({ profile, onLogout }) {
  return (
    <div className="max-w-md mx-auto pt-20 text-center space-y-8 p-4 w-full">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="bg-blue-100 w-20 h-20 rounded-3xl text-blue-600 flex items-center justify-center mx-auto mb-6"><User size={40}/></div>
        <h1 className="text-2xl font-black text-slate-900">{profile.user?.first_name || profile.user?.username || 'Працівник'}</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">{profile.company?.name || 'Компанія'} • Працівник</p>
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-500 py-4 rounded-xl font-black uppercase tracking-widest mt-10 hover:bg-red-100 transition-colors"><LogOut size={20}/> Вийти з акаунта</button>
      </div>
    </div>
  );
}

function SectionTitle({ title, desc }) {
  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-950">{title}</h3>
      {desc && <p className="mt-1 text-sm font-bold text-slate-500 leading-snug">{desc}</p>}
    </div>
  );
}

function Textarea({ label, value, onChange, compact }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${compact ? 'min-h-[92px]' : 'min-h-[128px]'}`}
      />
    </label>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoBox({ icon, label, value, mono }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 min-w-0">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{icon}{label}</div>
      <p className={`mt-2 text-sm font-bold text-slate-800 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-black uppercase ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      {active ? 'Активний' : 'Вимкнений'}
    </span>
  );
}

function IconButton({ children, onClick, label, tone = 'blue' }) {
  const cls = tone === 'red'
    ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
    : 'text-blue-600 bg-blue-50 hover:bg-blue-100';
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`h-9 w-9 rounded-xl flex items-center justify-center transition ${cls}`}>
      {children}
    </button>
  );
}

function EmptyInline({ icon, title, text }) {
  return (
    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-white text-slate-300 flex items-center justify-center mb-3">{icon}</div>
      <p className="text-sm font-black text-slate-500 uppercase">{title}</p>
      <p className="text-xs font-semibold text-slate-400 mt-1 max-w-sm mx-auto">{text}</p>
    </div>
  );
}

function BillingMetric({ icon, label, value }) {
  return (
    <div className="bg-white/15 border border-white/20 rounded-2xl p-3">
      <div className="flex items-center gap-2 text-white/75 text-[10px] font-black uppercase tracking-wider">{icon}{label}</div>
      <p className="mt-2 font-black text-lg leading-tight">{value}</p>
    </div>
  );
}

function SettingsNavCard({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="group bg-white border border-slate-100 rounded-[28px] p-5 text-left shadow-sm hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-100 transition-all flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">{icon}</div>
        <div className="min-w-0">
          <h3 className="font-black uppercase text-sm text-slate-900 truncate">{title}</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1 line-clamp-2">{desc}</p>
        </div>
      </div>
      <ArrowRight className="text-slate-300 group-hover:text-blue-600 shrink-0" size={18}/>
    </button>
  );
}
