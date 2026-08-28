import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, History, ImagePlus, Loader2, LockKeyhole, Maximize2, RefreshCw, ShieldCheck, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import api from '../../api/axios';


const formatDate = (value) => {
  if (!value) return 'Без дати';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Без дати' : date.toLocaleString('uk-UA');
};


const photoLoadErrorMessage = async (error) => {
  const data = error?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.detail || parsed?.error) return String(parsed.detail || parsed.error);
    } catch {
      // A proxy may return an HTML/text error page instead of the API JSON.
    }
  }
  return data?.detail || data?.error || 'Фото недоступне';
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
      .catch(async (error) => {
        if (!active) return;
        const message = await photoLoadErrorMessage(error);
        if (active) setFailed(message);
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
  const canRender = Boolean(photo?.src) && typeof document !== 'undefined';
  const viewportRef = useRef(null);
  const imageRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ lastCenter: null, lastDistance: 0, moved: false });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const [isDragging, setIsDragging] = useState(false);

  const clampView = (candidate) => {
    const scale = Math.min(5, Math.max(1, candidate.scale));
    if (scale === 1) return { scale: 1, x: 0, y: 0 };

    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return { scale, x: candidate.x, y: candidate.y };

    const maxX = Math.max(0, ((image.offsetWidth * scale) - viewport.clientWidth) / 2);
    const maxY = Math.max(0, ((image.offsetHeight * scale) - viewport.clientHeight) / 2);
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, candidate.x)),
      y: Math.min(maxY, Math.max(-maxY, candidate.y)),
    };
  };

  const applyView = (candidate) => {
    const next = clampView(candidate);
    viewRef.current = next;
    setView(next);
  };

  const zoomAt = (requestedScale, clientX, clientY) => {
    const current = viewRef.current;
    const nextScale = Math.min(5, Math.max(1, requestedScale));
    if (nextScale === 1) {
      applyView({ scale: 1, x: 0, y: 0 });
      return;
    }

    const bounds = viewportRef.current?.getBoundingClientRect();
    const focusX = bounds && Number.isFinite(clientX) ? clientX - bounds.left - (bounds.width / 2) : 0;
    const focusY = bounds && Number.isFinite(clientY) ? clientY - bounds.top - (bounds.height / 2) : 0;
    const ratio = nextScale / current.scale;
    applyView({
      scale: nextScale,
      x: focusX - ((focusX - current.x) * ratio),
      y: focusY - ((focusY - current.y) * ratio),
    });
  };

  const changeZoom = (delta) => {
    const nextScale = Math.round((viewRef.current.scale + delta) * 10) / 10;
    zoomAt(nextScale);
  };

  const resetView = () => applyView({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    const initialView = { scale: 1, x: 0, y: 0 };
    viewRef.current = initialView;
    setView(initialView);
    pointersRef.current.clear();
    gestureRef.current = { lastCenter: null, lastDistance: 0, moved: false };
  }, [photo?.src]);

  useEffect(() => {
    if (!canRender) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '0') resetView();
      if (event.key === '+' || event.key === '=') changeZoom(0.5);
      if (event.key === '-' || event.key === '_') changeZoom(-0.5);
    };
    const fitAfterResize = () => applyView(viewRef.current);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', fitAfterResize);

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', fitAfterResize);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [canRender, onClose]);

  const points = () => Array.from(pointersRef.current.values());
  const centerOf = (items) => ({
    x: items.reduce((total, item) => total + item.x, 0) / items.length,
    y: items.reduce((total, item) => total + item.y, 0) / items.length,
  });
  const distanceBetween = (items) => Math.hypot(items[0].x - items[1].x, items[0].y - items[1].y);

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activePoints = points();
    gestureRef.current.moved = false;
    gestureRef.current.lastCenter = centerOf(activePoints);
    gestureRef.current.lastDistance = activePoints.length > 1 ? distanceBetween(activePoints) : 0;
    setIsDragging(viewRef.current.scale > 1 || activePoints.length > 1);
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activePoints = points();
    const nextCenter = centerOf(activePoints);
    const gesture = gestureRef.current;

    if (activePoints.length > 1) {
      const nextDistance = distanceBetween(activePoints);
      const current = viewRef.current;
      const ratio = gesture.lastDistance > 0 ? nextDistance / gesture.lastDistance : 1;
      const nextScale = Math.min(5, Math.max(1, current.scale * ratio));
      const bounds = viewportRef.current?.getBoundingClientRect();
      const previousFocusX = bounds ? gesture.lastCenter.x - bounds.left - (bounds.width / 2) : 0;
      const previousFocusY = bounds ? gesture.lastCenter.y - bounds.top - (bounds.height / 2) : 0;
      const nextFocusX = bounds ? nextCenter.x - bounds.left - (bounds.width / 2) : 0;
      const nextFocusY = bounds ? nextCenter.y - bounds.top - (bounds.height / 2) : 0;
      const scaleRatio = nextScale / current.scale;
      applyView({
        scale: nextScale,
        x: nextFocusX - ((previousFocusX - current.x) * scaleRatio),
        y: nextFocusY - ((previousFocusY - current.y) * scaleRatio),
      });
      gesture.lastDistance = nextDistance;
      gesture.moved = true;
      setIsDragging(true);
    } else if (viewRef.current.scale > 1 && gesture.lastCenter) {
      const deltaX = nextCenter.x - gesture.lastCenter.x;
      const deltaY = nextCenter.y - gesture.lastCenter.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 1) gesture.moved = true;
      applyView({
        ...viewRef.current,
        x: viewRef.current.x + deltaX,
        y: viewRef.current.y + deltaY,
      });
      setIsDragging(true);
    }

    gesture.lastCenter = nextCenter;
  };

  const handlePointerEnd = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointersRef.current.delete(event.pointerId);
    const activePoints = points();
    gestureRef.current.lastCenter = activePoints.length ? centerOf(activePoints) : null;
    gestureRef.current.lastDistance = activePoints.length > 1 ? distanceBetween(activePoints) : 0;
    if (!activePoints.length) setIsDragging(false);
  };

  const handleBackdropClick = (event) => {
    if (gestureRef.current.moved) {
      gestureRef.current.moved = false;
      return;
    }
    if (event.target === event.currentTarget) onClose();
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.2 : (1 / 1.2);
    zoomAt(viewRef.current.scale * factor, event.clientX, event.clientY);
  };

  if (!canRender) return null;
  const modal = (
    <div
      className="fixed inset-0 z-[10000] isolate flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-contain bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acceptance-photo-viewer-title"
    >
      <header className="relative z-10 shrink-0 border-b border-white/10 bg-slate-950/90 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-5">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100"><Maximize2 size={18}/></span>
            <div className="min-w-0">
              <p id="acceptance-photo-viewer-title" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Перегляд фото</p>
              <p className="mt-0.5 truncate text-sm font-black text-white">{photo.category_label || 'Стан автомобіля'}</p>
            </div>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Закрити фото"
          >
            <X size={22} />
          </button>
        </div>
      </header>

      <div
        className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_center,rgba(51,65,85,0.42),rgba(2,6,23,0.96)_68%)]"
      >
        <div
          ref={viewportRef}
          className={`absolute inset-0 flex touch-none items-center justify-center overflow-hidden p-2 sm:p-5 md:p-8 ${view.scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
          onClick={handleBackdropClick}
          onDoubleClick={(event) => {
            if (event.target === event.currentTarget) return;
            event.preventDefault();
            event.stopPropagation();
            zoomAt(viewRef.current.scale > 1 ? 1 : 2.5, event.clientX, event.clientY);
          }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <img
            ref={imageRef}
            src={photo.src}
            alt={photo.category_label || 'Фото акта приймання'}
            draggable="false"
            onClick={(event) => event.stopPropagation()}
            className="block h-auto w-auto max-h-full max-w-full select-none rounded-xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:rounded-2xl"
            style={{
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 160ms ease-out',
              willChange: 'transform',
            }}
          />
        </div>

        <div
          className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/85 p-1.5 shadow-2xl backdrop-blur-xl sm:bottom-5"
          role="toolbar"
          aria-label="Масштаб фото"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={view.scale <= 1}
            onClick={() => changeZoom(-0.5)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Зменшити фото"
          >
            <ZoomOut size={20} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="h-11 min-w-[68px] rounded-xl px-2 text-xs font-black tabular-nums text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Скинути масштаб до 100 відсотків"
            title="Скинути масштаб"
          >
            {Math.round(view.scale * 100)}%
          </button>
          <button
            type="button"
            disabled={view.scale >= 5}
            onClick={() => changeZoom(0.5)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Збільшити фото"
          >
            <ZoomIn size={20} />
          </button>
        </div>
      </div>

      <footer className="relative z-10 shrink-0 border-t border-white/10 bg-slate-950/90 px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-200">{formatDate(photo.created_at)}</p>
            {photo.created_by && <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">Додав: {photo.created_by}</p>}
          </div>
          {photo.locked && <p className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase text-emerald-300"><ShieldCheck size={12}/> Зафіксоване фото</p>}
        </div>
      </footer>
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
    const visitIds = Array.from(new Set((selectedGroup?.visits || [])
      .map((visit) => Number(visit?.id || visit?.visit_id || 0))
      .filter((visitId) => Number.isInteger(visitId) && visitId > 0)));
    if (visitIds.length) params.set('visit_ids', visitIds.join(','));
    if (selectedGroup?.plate && selectedGroup.plate !== '—') params.set('plate', selectedGroup.plate);
    else if (selectedGroup?.vin && selectedGroup.vin !== '—') params.set('vin_code', selectedGroup.vin);
    else if (selectedGroup?.phone && selectedGroup.phone !== '—') params.set('phone', selectedGroup.phone);
    return params.toString();
  }, [selectedGroup?.plate, selectedGroup?.vin, selectedGroup?.phone, selectedGroup?.visits]);

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
