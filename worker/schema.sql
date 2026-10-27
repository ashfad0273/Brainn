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
