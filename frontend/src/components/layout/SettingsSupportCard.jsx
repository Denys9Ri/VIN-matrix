import { MessageCircle, Phone, ShieldCheck } from 'lucide-react';

const SettingsSupportCard = () => (
  <section className="mx-auto w-full max-w-7xl px-3 pb-20 md:px-6">
    <div className="overflow-hidden rounded-[30px] border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-blue-900 to-blue-600 p-5 text-white md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-100">
            <ShieldCheck size={21} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-200">VIN-matrix</p>
            <h2 className="mt-1 text-xl font-black uppercase">Допомога та підтримка</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-blue-100">
              Напишіть або зателефонуйте, якщо потрібна допомога з доступом, налаштуванням чи роботою в системі.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2 md:p-6">
        <a
          href="https://t.me/vin_matrix"
          target="_blank"
          rel="noreferrer"
          className="group rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
              <MessageCircle size={20} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Telegram</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">@vin_matrix</p>
            </div>
          </div>
        </a>

        <a
          href="tel:+380636699617"
          className="group rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
              <Phone size={20} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Телефон підтримки</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">+380 63 669 96 17</p>
            </div>
          </div>
        </a>
      </div>

      <div className="mx-5 mb-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-600 md:mx-6 md:mb-6">
        Підтримка VIN-matrix ніколи не просить повідомляти пароль або коди доступу. Для захисту облікового запису не передавайте ці дані третім особам.
      </div>
    </div>
  </section>
);

export default SettingsSupportCard;
