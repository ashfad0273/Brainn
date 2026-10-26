import { ListTodo, ListChecks, GitBranch, KeyRound, CircleHelp, TriangleAlert, Paperclip } from 'lucide-react';

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

// Static class strings so Tailwind keeps them.
export const COLOR = {
  emerald: { badge: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25', text: 'text-emerald-300', soft: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  sky: { badge: 'bg-sky-500/10 text-sky-300 ring-sky-500/25', text: 'text-sky-300', soft: 'bg-sky-500/10', dot: 'bg-sky-400' },
  violet: { badge: 'bg-violet-500/10 text-violet-300 ring-violet-500/25', text: 'text-violet-300', soft: 'bg-violet-500/10', dot: 'bg-violet-400' },
  rose: { badge: 'bg-rose-500/10 text-rose-300 ring-rose-500/25', text: 'text-rose-300', soft: 'bg-rose-500/10', dot: 'bg-rose-400' },
  amber: { badge: 'bg-amber-500/10 text-amber-300 ring-amber-500/25', text: 'text-amber-300', soft: 'bg-amber-500/10', dot: 'bg-amber-400' },
  orange: { badge: 'bg-orange-500/10 text-orange-300 ring-orange-500/25', text: 'text-orange-300', soft: 'bg-orange-500/10', dot: 'bg-orange-400' },
  cyan: { badge: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/25', text: 'text-cyan-300', soft: 'bg-cyan-500/10', dot: 'bg-cyan-400' },
  neutral: { badge: 'bg-white/5 text-neutral-400 ring-white/10', text: 'text-neutral-400', soft: 'bg-white/5', dot: 'bg-neutral-500' },
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

export const DEFAULT_PERMS = { tasks: true, requirements: false, decisions: false, files: true, summary: false };

/** Roles a project member can have. "other" uses the member's own designation. */
export const MEMBER_ROLES = {
  client: 'Client', developer: 'Developer', designer: 'Designer', motion: 'Motion designer',
  video: 'Video editor', brand: 'Brand designer', other: 'Other',
};
export const memberRole = m => (m.role === 'other' ? m.designation?.trim() || 'Member' : MEMBER_ROLES[m.role] || 'Member');
