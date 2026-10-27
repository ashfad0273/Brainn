import { ListTodo, ListChecks, GitBranch, KeyRound, CircleHelp, TriangleAlert, Paperclip } from '@/lib/icons';

// Every structured record has a type. Records are never deleted: "closing" one means
// moving it to a non-active status, and the whole trail stays in item.history.
export const TYPES = {
  task: { label: 'Task', plural: 'Tasks', icon: ListTodo, color: 'emerald', statuses: ['open', 'in_progress', 'blocked', 'done', 'cancelled'], active: ['open', 'in_progress', 'blocked'], initial: 'open' },
  requirement: { label: 'Requirement', plural: 'Requirements', icon: ListChecks, color: 'sky', statuses: ['active', 'delivered', 'dropped'], active: ['active'], initial: 'active' },
  decision: { label: 'Decision', plural: 'Decisions', icon: GitBranch, color: 'violet', statuses: ['active', 'reversed', 'superseded'], active: ['active'], initial: 'active' },
  sensitive: { label: 'Sensitive', plural: 'Sensitive info', icon: KeyRound, color: 'rose', statuses: ['active', 'replaced', 'revoked'], active: ['active'], initial: 'active' },
  question: { label: 'Open question', plural: 'Open questions', icon: CircleHelp, color: 'amber', statuses: ['open', 'answered', 'dropped'], active: ['open'], initial: 'open' },
  risk: { label: 'Risk', plural: 'Risks', icon: TriangleAlert, color: 'orange', statuses: ['open', 'mitigated', 'closed'], active: ['open'], initial: 'open' },
  file: { label: 'File', plural: 'Files & links', icon: Paperclip, color: 'cyan', statuses: ['active', 'outdated'], active: ['active'], initial: 'active' },
};
export const TYPE_ORDER = ['task', 'requirement', 'decision', 'sensitive', 'question', 'risk', 'file'];

// Static class strings so Tailwind keeps them. Tones are Brainn's names;
// the colours are Ume's hue family (soft surface, ink text, ring hairline).
export const COLOR = {
  emerald: { badge: 'bg-green-soft text-green-ink ring-green-ring', text: 'text-green', soft: 'bg-green-soft', dot: 'bg-green' },
  sky: { badge: 'bg-sky-soft text-sky-ink ring-sky-ring', text: 'text-sky', soft: 'bg-sky-soft', dot: 'bg-sky' },
  violet: { badge: 'bg-violet-soft text-violet-ink ring-violet-ring', text: 'text-violet', soft: 'bg-violet-soft', dot: 'bg-violet' },
  rose: { badge: 'bg-rose-soft text-rose-ink ring-rose-ring', text: 'text-rose', soft: 'bg-rose-soft', dot: 'bg-rose' },
  amber: { badge: 'bg-amber-soft text-amber-ink ring-amber-ring', text: 'text-amber', soft: 'bg-amber-soft', dot: 'bg-amber' },
  orange: { badge: 'bg-orange-soft text-orange-ink ring-orange-ring', text: 'text-orange', soft: 'bg-orange-soft', dot: 'bg-orange' },
  cyan: { badge: 'bg-teal-soft text-teal-ink ring-teal-ring', text: 'text-teal', soft: 'bg-teal-soft', dot: 'bg-teal' },
  neutral: { badge: 'bg-field text-muted-foreground ring-border', text: 'text-muted-foreground', soft: 'bg-field', dot: 'bg-grey-400' },
};

export const STATUS = {
  open: { label: 'Open', tone: 'sky' }, in_progress: { label: 'In progress', tone: 'amber' }, blocked: { label: 'Blocked', tone: 'rose' },
  done: { label: 'Done', tone: 'emerald' }, cancelled: { label: 'Cancelled', tone: 'neutral' }, active: { label: 'Active', tone: 'sky' },
  delivered: { label: 'Delivered', tone: 'emerald' }, dropped: { label: 'Dropped', tone: 'neutral' }, reversed: { label: 'Reversed', tone: 'orange' },
  superseded: { label: 'Superseded', tone: 'neutral' }, replaced: { label: 'Replaced', tone: 'neutral' }, revoked: { label: 'Revoked', tone: 'neutral' },
  answered: { label: 'Answered', tone: 'emerald' }, mitigated: { label: 'Mitigated', tone: 'emerald' }, closed: { label: 'Closed', tone: 'neutral' },
  outdated: { label: 'Outdated', tone: 'neutral' },
};

export const SENSITIVE_CATS = { credential: 'Credentials', contact: 'Contact details', financial: 'Financial', personal: 'Personal data', confidential: 'Confidential' };

export const isActive = it => TYPES[it.type]?.active.includes(it.status);

/** Status used when a record is replaced by a newer one. */
export const REPLACED_STATUS = { sensitive: 'replaced', decision: 'superseded', requirement: 'dropped', file: 'outdated', task: 'cancelled', question: 'dropped', risk: 'closed' };
/** Status meaning "solved" for each type (maps generic words like done/solved/resolved). */
export const SOLVED_STATUS = { task: 'done', requirement: 'delivered', decision: 'superseded', sensitive: 'revoked', question: 'answered', risk: 'mitigated', file: 'outdated' };

export const PROJECT_COLORS = ['#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981', '#f43f5e', '#14b8a6', '#6366f1', '#ec4899'];

/** suggestions: may see the AI suggestions in this project and accept / edit / ignore them. */
export const DEFAULT_PERMS = { tasks: true, requirements: false, decisions: false, files: true, summary: false, suggestions: false };

/** Labels a person gets when invited. "other" (older members only) uses the member's own designation. */
export const MEMBER_ROLES = {
  client: 'Client', designer: 'Designer', developer: 'Developer', video: 'Video editor',
  motion: 'Motion designer', graphics: 'Graphics designer', brand: 'Brand designer', other: 'Other',
};
export const INVITE_LABELS = ['client', 'designer', 'developer', 'video', 'motion', 'graphics', 'brand'];

export const PROJECT_STATUS = {
  in_progress: { label: 'In progress', tone: 'sky', dot: 'bg-sky' },
  on_hold: { label: 'On hold', tone: 'amber', dot: 'bg-amber' },
  completed: { label: 'Completed', tone: 'emerald', dot: 'bg-green' },
  cancelled: { label: 'Cancelled', tone: 'neutral', dot: 'bg-grey-400' },
};
export const memberRole = m => (m.role === 'other' ? m.designation?.trim() || 'Member' : MEMBER_ROLES[m.role] || 'Member');
