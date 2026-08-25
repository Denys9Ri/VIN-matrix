import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, History, ImagePlus, Loader2, LockKeyhole, Maximize2, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import api from '../../api/axios';


const formatDate = (value) => {
  if (!value) return 'Без дати';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Без дати' : date.toLocaleString('uk-UA');
};


function SecurePhoto({ photo, className = '', onOpen }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed('');

    api.get(photo.file_endpoint, { responseType: 'blob' })
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      })
      .catch((error) => {
        if (!active) return;
        setFailed(error?.response?.data?.detail || 'Фото недоступне');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.file_endpoint, attempt]);

  if (failed) {
    return (
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAttempt((value) => value + 1); }}
        className={`flex flex-col items-center justify-center gap-1 bg-slate-100 px-1 text-center text-[9px] font-black text-slate-400 ${className}`}
        title={failed}
      >
        <RefreshCw size={14} />
        <span>Повторити</span>
      </button>
    );
  }
  if (!src) {
    return <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}><Loader2 size={18} className="animate-spin" /></div>;
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen?.({ ...photo, src });
      }}
      className={`group relative overflow-hidden bg-slate-100 touch-manipulation ${className}`}
      aria-label="Відкрити фото повністю"
    >
      <img src={src} alt={photo.category_label || 'Фото акта приймання'} className="h-full w-full object-cover" />
      <span className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-lg"><Maximize2 size={14} /></span>
    </button>
  );
}


function PhotoModal({ photo, onClose }) {
  if (!photo?.src || typeof document === 'undefined') return null;
  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-950/95 p-3 md:p-8"
      role="dialog"
      aria-modal="true"
      onClick={(event) => { event.preventDefault(); onClose(); }}
    >
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
        className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[10001] flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl"
        aria-label="Закрити фото"
      >
        <X size={22} />
      </button>
      <div className="flex max-h-full w-full max-w-5xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <img src={photo.src} alt={photo.category_label || 'Фото акта приймання'} className="max-h-[80dvh] max-w-full rounded-2xl object-contain shadow-2xl" />
        <div className="mt-3 w-full max-w-3xl rounded-2xl bg-white/95 px-4 py-3 text-sm text-slate-700">
          <p className="font-black">{photo.category_label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(photo.created_at)} {photo.created_by ? `· ${photo.created_by}` : ''}</p>
          {photo.locked && <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700"><ShieldCheck size={11}/> Зафіксоване фото</p>}
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}


const uploadErrorMessage = (error) => {
  const status = Number(error?.response?.status || 0);
  const detail = error?.response?.data?.detail || error?.response?.data?.error;
  if (detail) return String(detail);
  if (status === 413) return 'Фото завелике для сервера. Спробуйте інше фото або зменште його розмір.';
  if (!error?.response) return 'Не вдалося передати фото на сервер. Перевірте інтернет і спробуйте ще раз.';
  return `Не вдалося додати фото${status ? ` (помилка ${status})` : ''}.`;
};


export function AcceptancePhotoPicker({ visitId, category, title, completed = false }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);

  const load = async () => {
    if (!visitId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/visit-acceptance-photos/?visit=${visitId}&category=${category}`);
      setPhotos(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setPhotos([]);
      setMessage(error?.response?.data?.detail || 'Не вдалося завантажити фото цього розділу.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [visitId, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (file) => {
    if (!file || !visitId || completed) return;
    setUploading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('visit', String(visitId));
      form.append('category', category);
      form.append('photo', file, file.name || 'photo');
      const response = await api.post('/api/visit-acceptance-photos/', form);
      setPhotos((current) => [...current, response.data]);
    } catch (error) {
      setMessage(uploadErrorMessage(error));
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const remove = async (photo) => {
    if (completed || photo.locked || deleting || !window.confirm('Видалити це фото з чернетки акта?')) return;
    setDeleting(photo.id);
    setMessage('');
    try {
      await api.delete(`/api/visit-acceptance-photos/${photo.id}/`);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Не вдалося видалити фото.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Фото · {title}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{photos.length ? `Фото: ${photos.length}` : 'Додайте фото стану авто'}</p>
        </div>
        {completed && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700"><LockKeyhole size={11}/> Акт зафіксовано</span>}
      </div>

      {loading ? (
        <div className="mt-3 flex h-20 items-center justify-center rounded-xl bg-white text-slate-400"><Loader2 size={18} className="animate-spin" /></div>
      ) : photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square">
              <SecurePhoto photo={photo} onOpen={setPreview} className="h-full w-full rounded-xl border border-slate-200" />
              {photo.locked && !completed && <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow"><LockKeyhole size={11}/></span>}
              {!completed && !photo.locked && (
                <button type="button" disabled={deleting === photo.id} onClick={() => remove(photo)} className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white shadow-md disabled:opacity-50" aria-label="Видалити фото">
                  {deleting === photo.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!completed && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={uploading} onClick={() => cameraRef.current?.click()} className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-50">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Камера
          </button>
          <button type="button" disabled={uploading} onClick={() => galleryRef.current?.click()} className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-50">
            <ImagePlus size={15} /> Галерея
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
        </div>
      )}

      {!completed && photos.some((photo) => photo.locked) && <p className="mt-2 text-[11px] font-semibold text-emerald-700">Фото з попередньої зафіксованої версії акта залишаються незмінними. До коригування можна додати нові.</p>}
      {!completed && !message && <p className="mt-2 text-[11px] font-semibold text-slate-400">Усі фото автоматично зберігаються у сумісному JPEG-форматі.</p>}
      {completed && photos.length === 0 && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-400">Акт завершено без фото в цьому розділі.</p>}
      {message && <p className="mt-2 text-xs font-bold text-rose-600">{message}</p>}
      {preview && <PhotoModal photo={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}


const evidenceRows = (act = {}) => [
  ['Пошкодження кузова', act.damages],
  ['Зовнішній стан', act.exterior_note],
  ['Салон / речі', act.interior_note],
  ['Скарга клієнта', act.customer_complaint],
  ['Загальна примітка', act.note],
].filter(([, value]) => String(value || '').trim());


export function VehicleConditionHistory({ selectedGroup, compact = false }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedGroup?.plate && selectedGroup.plate !== '—') params.set('plate', selectedGroup.plate);
    else if (selectedGroup?.phone && selectedGroup.phone !== '—') params.set('phone', selectedGroup.phone);
    return params.toString();
  }, [selectedGroup?.plate, selectedGroup?.phone]);

  const load = async () => {
    if (!query) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/visit-acceptance-photos/vehicle-history/?${query}`);
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setHistory([]);
      setError(requestError?.response?.data?.detail || 'Не вдалося завантажити історію стану авто.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><History size={19} /></span>
          <div>
            <h3 className="text-sm font-black text-slate-900 sm:text-base">Історія стану авто</h3>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{selectedGroup?.plate || 'Авто'} · акти, пошкодження та фото по кожному візиту.</p>
          </div>
        </div>
        <button type="button" onClick={load} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500" aria-label="Оновити історію"><RefreshCw size={15}/></button>
      </div>

      {loading ? <div className="mt-4 flex h-24 items-center justify-center rounded-2xl bg-slate-50 text-slate-400"><Loader2 className="animate-spin" size={18}/></div> : error ? (
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
      ) : history.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-400">Зафіксованої історії стану цього авто ще немає.</div>
      ) : (
        <div className="mt-4 space-y-4">
          {history.map((entry) => {
            const visit = entry.visit || {};
            const act = entry.act || {};
            const photos = Array.isArray(entry.photos) ? entry.photos : [];
            const details = evidenceRows(act);
            const visitDate = visit.scheduled_datetime || visit.created_at;
            return (
              <article key={visit.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-900">Візит №{visit.id} · {visit.plate || selectedGroup?.plate || 'без номера'}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(visitDate)} · фото: {photos.length}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {act.status === 'completed' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700"><ShieldCheck size={11}/> Акт зафіксовано</span>}
                    {Number(entry.revision_count || 0) > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">Коригувань: {entry.revision_count}</span>}
                  </div>
                </div>

                {details.length > 0 && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{details.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{value}</p></div>)}</div>}

                {photos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">{photos.map((photo) => <div key={photo.id} className="min-w-0"><SecurePhoto photo={photo} onOpen={setPreview} className="aspect-square w-full rounded-xl border border-slate-200"/><p className="mt-1 truncate text-[9px] font-black uppercase text-slate-400">{photo.category_label}</p></div>)}</div>}
              </article>
            );
          })}
        </div>
      )}
      {preview && <PhotoModal photo={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}


export function ClientAcceptancePhotoHistory({ selectedGroup }) {
  return <VehicleConditionHistory selectedGroup={selectedGroup} compact />;
}
