import { MessageCircle, Phone, ShieldCheck } from 'lucide-react';

const Support = () => (
  <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 px-6 py-8 text-white sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">VIN-matrix</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Допомога та підтримка</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">Напишіть або зателефонуйте, якщо потрібна допомога з доступом, налаштуванням, роботою в системі чи виникла помилка.</p>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
        <a href="https://t.me/vin_matrix" target="_blank" rel="noreferrer" className="group rounded-2xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-blue-100 p-3 text-blue-700"><MessageCircle size={24} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Telegram</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">@vin_matrix</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Найзручніший спосіб швидко отримати відповідь.</p>
            </div>
          </div>
        </a>

        <a href="tel:+380636699617" className="group rounded-2xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-blue-100 p-3 text-blue-700"><Phone size={24} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Телефон</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">+380 63 669 96 17</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Натисніть, щоб зателефонувати в підтримку.</p>
            </div>
          </div>
        </a>
      </div>

      <div className="mx-6 mb-6 flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:mx-8 sm:mb-8">
        <ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={19} />
        <p>Для швидшої допомоги підготуйте назву компанії, короткий опис питання та скріншот або запис екрана, якщо щось працює некоректно. Не передавайте пароль чи коди доступу.</p>
      </div>
    </div>
  </div>
);

export default Support;
