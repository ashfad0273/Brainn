import { useStore } from '../store';
import { cx } from '../lib/util';

export default function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-[min(92vw,520px)]">
      {toasts.map(t => (
        <div key={t.id} className={cx('anim-pop px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl text-center', t.tone === 'error' ? 'bg-rose-950 text-rose-100 ring-1 ring-rose-500/40' : 'bg-white text-neutral-900')}>{t.text}</div>
      ))}
    </div>
  );
}
