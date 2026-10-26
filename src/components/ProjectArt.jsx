import { useAttachmentUrl } from '../lib/blobs';
import { cx } from '../lib/util';

const NONE = {};

/** Profile picture of a project. Without one, the cover is cropped in; without either, a coloured initial. */
export function ProjectAvatar({ p, className, rounded = 'rounded-xl', text = 'text-sm' }) {
  const src = p.avatar || p.cover;
  const { url } = useAttachmentUrl(src || NONE, !!src);
  return (
    <span className={cx('shrink-0 overflow-hidden grid place-items-center font-bold text-white', rounded, text, className)} style={{ background: p.color }}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : (p.name || '?')[0].toUpperCase()}
    </span>
  );
}

/** Cover image of a project. Without one, the profile picture fills in (blurred); without either, a colour gradient. */
export function ProjectCover({ p, className, children }) {
  const src = p.cover || p.avatar;
  const { url } = useAttachmentUrl(src || NONE, !!src);
  const fromAvatar = !p.cover && !!p.avatar;
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ background: `linear-gradient(135deg, ${p.color}55, ${p.color}08 70%)` }}>
      {url && <img src={url} alt="" className={cx('absolute inset-0 w-full h-full object-cover', fromAvatar && 'scale-125 blur-xl opacity-70')} />}
      {url && <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />}
      {children}
    </div>
  );
}
