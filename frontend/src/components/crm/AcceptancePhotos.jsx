import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, LockKeyhole, Maximize2, ShieldCheck, Trash2, X } from 'lucide-react';
import api from '../../api/axios';


function SecurePhoto({ photo, className = '', onOpen }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed(false);

    api.get(photo.file_endpoint, { responseType: 'blob' })
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      })
      .catch(() => { if (active) setFailed(true); });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.file_endpoint]);

  if (failed) {
    return <div className={`flex items-center justify-center bg-slate-100 text-[10px] font-black uppercase text-slate-400 ${className}`}>Недоступно</div>;
  }
  if (!src) {
    return <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}><Loader2 size={18} className="animate-spin" /></div>;
  }
  return (
    <button type="button" onClick={() => onOpen?.({ ...photo, src })} className={`group relative overflow-hidden bg-slate-100 ${className}`}>
      <img src={src} alt={photo.category_label || 'Фото акта приймання'} className="h-full w-full object-cover" />
      <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/70 text-white opacity-0 transition group-hover:opacity-100"><Maximize2 size={13} /></span>
    </button>
  );
}


function PhotoModal({ photo, onClose }) {
  if (!photo?.src) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 md:p-8" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl"><X size={20} /></button>
      <div className="max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
        <img src={photo.src} alt={photo.category_label || 'Фото акта приймання'} className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl" />
        <div className="mt-3 rounded-2xl bg-white/95 px-4 py-3 text-sm text-slate-700">
          <p className="font-black">{photo.category_label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(photo.created_at).toLocaleString('uk-UA')} {photo.created_by ? `· ${photo.created_by}` : ''}</p>
        </div>
      </div>
    </div>
  );
}


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
    } catch {
      setPhotos([]);
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
      form.append('photo', file);
      const response = await api.post('/api/visit-acceptance-photos/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotos((current) => [...current, response.data]);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Не вдалося додати фото.');
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const remove = async (photo) => {
    if (completed || deleting || !window.confirm('Видалити це фото з чернетки акта?')) return;
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

  const locked = completed || photos.some((photo) => photo.locked);

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Фото · {title}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{photos.length ? `Зафіксовано: ${photos.length}` : 'Додайте фото стану авто'}</p>
        </div>
        {locked && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700"><LockKeyhole size={11}/> Зафіксовано</span>}
      </div>

      {loading ? (
        <div className="mt-3 flex h-20 items-center justify-center rounded-xl bg-white text-slate-400"><Loader2 size={18} className="animate-spin" /></div>
      ) : photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square">
              <SecurePhoto photo={photo} onOpen={setPreview} className="h-full w-full rounded-xl border border-slate-200" />
              {!locked && (
                <button type="button" disabled={deleting === photo.id} onClick={() => remove(photo)} className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white shadow-md disabled:opacity-50" aria-label="Видалити фото">
                  {deleting === photo.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!locked && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={uploading} onClick={() => cameraRef.current?.click()} className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-50">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Камера
          </button>
          <button type="button" disabled={uploading} onClick={() => galleryRef.current?.click()} className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-50">
            <ImagePlus size={15} /> Галерея
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
        </div>
      )}

      {locked && photos.length === 0 && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-400">Акт завершено без фото в цьому розділі.</p>}
      {message && <p className="mt-2 text-xs font-bold text-rose-600">{message}</p>}
      {preview && <PhotoModal photo={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}


export function ClientAcceptancePhotoHistory({ selectedGroup }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedGroup?.phone && selectedGroup.phone !== '—') params.set('phone', selectedGroup.phone);
    if (selectedGroup?.plate && selectedGroup.plate !== '—') params.set('plate', selectedGroup.plate);
    return params.toString();
  }, [selectedGroup?.phone, selectedGroup?.plate]);

  useEffect(() => {
    let cancelled = false;
    if (!query) {
      setPhotos([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    api.get(`/api/visit-acceptance-photos/?${query}`)
      .then((response) => { if (!cancelled) setPhotos(Array.isArray(response.data) ? response.data : []); })
      .catch(() => { if (!cancelled) setPhotos([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map();
    photos.forEach((photo) => {
      const key = photo.visit_id;
      if (!map.has(key)) map.set(key, { visit: photo.visit, photos: [] });
      map.get(key).photos.push(photo);
    });
    return Array.from(map.values());
  }, [photos]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck size={19} /></span>
        <div>
          <h3 className="text-sm font-black text-slate-900 sm:text-base">Фотофіксація стану авто</h3>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">Історія фото з актів приймання. Кожне фото привʼязане до конкретного візиту та часу завантаження.</p>
        </div>
      </div>

      {loading ? <div className="mt-4 flex h-24 items-center justify-center rounded-2xl bg-slate-50 text-slate-400"><Loader2 className="animate-spin" size={18}/></div> : groups.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-400">Фотофіксації по цьому клієнту ще немає.</div>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((group) => {
            const visitDate = group.visit?.scheduled_datetime || group.visit?.created_at;
            return (
              <div key={group.visit?.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="text-xs font-black text-slate-800">Візит №{group.visit?.id} · {group.visit?.plate || 'без номера'}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-400">{visitDate ? new Date(visitDate).toLocaleString('uk-UA') : 'Без дати'} · фото: {group.photos.length}</p></div>
                  {group.photos.some((photo) => photo.locked) && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700"><ShieldCheck size={11}/> Акт зафіксовано</span>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {group.photos.map((photo) => (
                    <div key={photo.id} className="min-w-0">
                      <SecurePhoto photo={photo} onOpen={setPreview} className="aspect-square w-full rounded-xl border border-slate-200" />
                      <p className="mt-1 truncate text-[9px] font-black uppercase text-slate-400" title={photo.category_label}>{photo.category_label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {preview && <PhotoModal photo={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
