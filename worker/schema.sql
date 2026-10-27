-- Project Brain D1 Database Schema

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT,
  space_id TEXT,
  color TEXT,
  archived INTEGER DEFAULT 0,
  meta_at INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blobs (
  id TEXT PRIMARY KEY,
  mime TEXT,
  enc INTEGER DEFAULT 0,
  data BLOB,
  size INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_meta_at ON projects(meta_at);
CREATE INDEX IF NOT EXISTS idx_projects_space_id ON projects(space_id);

-- Live invite tokens → project, so a join link is one lookup. Rebuilt whenever a project is saved.
CREATE TABLE IF NOT EXISTS member_tokens (
  token TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  member_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_member_tokens_project ON member_tokens(project_id);

-- Wrong-PIN counter per invite link; the link locks for 15 minutes after 5 misses.
CREATE TABLE IF NOT EXISTS join_attempts (
  token TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

-- Accounts: the owner (role 'owner') and everyone invited (role 'member', label = client, designer, …).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member',
  label TEXT NOT NULL DEFAULT 'client',
  pass_hash TEXT,
  pass_salt TEXT,
  tz TEXT NOT NULL DEFAULT '',
  tz_manual INTEGER NOT NULL DEFAULT 0,
  work_start TEXT NOT NULL DEFAULT '09:00',
  work_end TEXT NOT NULL DEFAULT '18:00',
  epoch INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One open invitation per person; accepting it sets their password.
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Which accounts are in which project. Rebuilt from each project's members whenever it is saved.
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Wrong-password counter per email; locks for 15 minutes after 5 misses.
CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

-- The unsent message each person has in each project.
CREATE TABLE IF NOT EXISTS drafts (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, project_id)
);

-- AI requests per invited person per day.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Link preview cache (title, image, can it be framed), kept for a week.
CREATE TABLE IF NOT EXISTS unfurls (
  url TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- Gemini / Resend keys the owner sets in the app (AES-GCM, key derived from APP_TOKEN).
CREATE TABLE IF NOT EXISTS app_keys (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
