CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(100),
    is_first_login BOOLEAN DEFAULT TRUE, -- Your Onboarding Flag
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS day_logs (

  id          SERIAL PRIMARY KEY,

  -- ON DELETE CASCADE ensures if the user account is deleted, all their logs are deleted too
  user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  -- A layout style chosen by the user (e.g. 'grid', 'freeform')
  layout_style VARCHAR(50) DEFAULT 'freeform',

  -- Whether completing all tasks today unlocked the 'achievement' sticker
  achievement_unlocked BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  -- Enforce: one log per user per date (no duplicates)
  UNIQUE (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS log_photos (
  id          SERIAL PRIMARY KEY,
  log_id      INTEGER NOT NULL REFERENCES day_logs(id) ON DELETE CASCADE,

  -- The file path on the server 
  file_path   VARCHAR(500) NOT NULL,

  -- Original filename the user uploaded 
  original_name VARCHAR(255),
  file_size   INTEGER,  -- in bytes
  caption     TEXT,

  -- Position on the scrapbook canvas (for layout persistence)
  -- These store where the photo sits on the page (in pixels or %)
  pos_x       FLOAT DEFAULT 0,
  pos_y       FLOAT DEFAULT 0,
  width       FLOAT DEFAULT 300,
  height      FLOAT DEFAULT 200,
  z_index     INTEGER DEFAULT 0,
  rotation    FLOAT DEFAULT 0,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS log_notes (
  id          SERIAL PRIMARY KEY,
  log_id      INTEGER NOT NULL REFERENCES day_logs(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,

  -- Position on the canvas (same idea as photos)
  pos_x       FLOAT DEFAULT 0,
  pos_y       FLOAT DEFAULT 0,
  width       FLOAT DEFAULT 250,
  rotation    FLOAT DEFAULT 0,
  z_index     INTEGER DEFAULT 0,
  
  bg_color    VARCHAR(20) DEFAULT '#FFFDE7',
  font_size   INTEGER DEFAULT 14,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reflective_prompts (
  id          SERIAL PRIMARY KEY,
  prompt_text TEXT NOT NULL,

  -- Themes e.g: 'general', 'gratitude', 'growth', 'fun'
  category    VARCHAR(50) DEFAULT 'general',

  -- Set to false to disable a prompt without deleting it
  is_active   BOOLEAN DEFAULT true,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_answers (
  id          SERIAL PRIMARY KEY,
  log_id      INTEGER NOT NULL REFERENCES day_logs(id) ON DELETE CASCADE,
  prompt_id   INTEGER NOT NULL REFERENCES reflective_prompts(id),
  answer_text TEXT NOT NULL,

  -- Position on canvas
  pos_x       FLOAT DEFAULT 0,
  pos_y       FLOAT DEFAULT 0,
  z_index     INTEGER DEFAULT 0,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS art_assets (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,

  -- File path on the server (e.g. 'assets/stickers/star.png')
  file_path   VARCHAR(500) NOT NULL,

  -- If true, asset is only unlocked when all tasks are completed
  is_achievement_reward BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS log_stickers (
  id          SERIAL PRIMARY KEY,
  log_id      INTEGER NOT NULL REFERENCES day_logs(id) ON DELETE CASCADE,
  asset_id    INTEGER NOT NULL REFERENCES art_assets(id),

  -- Position, size, and rotation on the canvas
  pos_x       FLOAT DEFAULT 0,
  pos_y       FLOAT DEFAULT 0,
  width       FLOAT DEFAULT 80,
  height      FLOAT DEFAULT 80,
  rotation    FLOAT DEFAULT 0,
  z_index     INTEGER DEFAULT 0,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-----------------------------
-- TASKS FEATURE --
------------------------------

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP NOT NULL,
    priority VARCHAR(20) DEFAULT 'Medium', 
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' or 'completed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- streaks feature
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
 
-- 2. Create daily_progress table
CREATE TABLE IF NOT EXISTS daily_progress (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  completed_tasks       INTEGER DEFAULT 0,
  total_tasks           INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

ALTER TABLE art_assets ADD CONSTRAINT art_assets_file_path_key UNIQUE (file_path);