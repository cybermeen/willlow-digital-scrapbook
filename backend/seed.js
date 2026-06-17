// seed.js
require('dotenv').config();
const db = require('./db/db');

const prompts = [
  { text: 'What made you smile genuinely today?', category: 'gratitude' },
  { text: 'What is one thing you wish had gone differently?', category: 'growth' },
  { text: 'If today were a movie, what would the title be?', category: 'fun' },
  { text: 'Who did you connect with today, and how did it feel?', category: 'general' },
  { text: 'What is one small win you can celebrate today?', category: 'gratitude' },
  { text: 'What song perfectly describes your mood right now?', category: 'fun' },
  { text: 'What did you learn about yourself today?', category: 'growth' },
  { text: 'What are you most looking forward to tomorrow?', category: 'general' },
  { text: 'Describe today in exactly three words.', category: 'fun' },
  { text: 'What is one thing you are grateful for that you usually overlook?', category: 'gratitude' },
  { text: 'What challenged you today, and how did you respond?', category: 'growth' },
  { text: 'If you could add one extra hour to today, how would you use it?', category: 'fun' },
];

const assets = [
  { name: 'Tape 0',  file: 'assets/tape/tape0.png',   reward: false },
  { name: 'Tape 1',  file: 'assets/tape/tape1.png',   reward: false },
  { name: 'Tape 2',  file: 'assets/tape/tape2.png',   reward: false },
  { name: 'Tape 3',  file: 'assets/tape/tape3.png',   reward: false },
  { name: 'Tape 4',  file: 'assets/tape/tape4.png',   reward: false },
  { name: 'Tape 5',  file: 'assets/tape/tape5.png',   reward: false },
  { name: 'Tape 6',  file: 'assets/tape/tape6.png',   reward: false },
  { name: 'Tape 7',  file: 'assets/tape/tape7.png',   reward: false },
  { name: 'Tape 8',  file: 'assets/tape/tape8.png',   reward: false },
  { name: 'Tape 9',  file: 'assets/tape/tape9.png',   reward: false },
  { name: 'Tape 10', file: 'assets/tape/tape10.png',  reward: false },
  { name: 'Tape 11', file: 'assets/tape/tape11.png',  reward: false },
  { name: 'Tape 12', file: 'assets/tape/tape12.png',  reward: false },
  { name: 'Tape 13', file: 'assets/tape/tape13.png',  reward: false },
  { name: 'Tape 14', file: 'assets/tape/tape14.png',  reward: false },
  { name: 'Tape 15', file: 'assets/tape/tape15.png',  reward: false },
  { name: 'Tape 16', file: 'assets/tape/tape16.png',  reward: false },
  { name: 'Tape 17', file: 'assets/tape/tape17.png',  reward: false },
  { name: 'Tape 18', file: 'assets/tape/tape18.png',  reward: false },
  { name: 'Tape 19', file: 'assets/tape/tape19.png',  reward: false },
  { name: 'Tape 20', file: 'assets/tape/tape20.png',  reward: false },
];

async function seed() {
  console.log('Seeding database...');

  for (const p of prompts) {
    await db.query(
      `INSERT INTO reflective_prompts (prompt_text, category) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [p.text, p.category]
    );
  }
  console.log(`Inserted ${prompts.length} prompts.`);

  // ── Art assets ───────────────────────────────────────────────────────────
 
  // Delete any previously seeded assets whose file_path does NOT start
  // with 'assets/tape/' — these are the old bad rows (empty file paths or
  // wrong paths) that were showing up as blank boxes in the Magic Library.
  // We do this BEFORE inserting new ones so we start from a clean state.
  //
  // This only deletes art_assets rows that aren't referenced by
  // any log_stickers row, so it won't break existing placed stickers.
  // If you want to also remove stickers using bad assets, uncomment the
  // second DELETE below.
  const deleted = await db.query(
    `DELETE FROM art_assets
     WHERE file_path NOT LIKE 'assets/tape/%'
       -- Only delete rows not referenced by any placed sticker
       AND id NOT IN (SELECT DISTINCT asset_id FROM log_stickers)
     RETURNING id, name, file_path`
  );
  if (deleted.rows.length > 0) {
    console.log(`Removed ${deleted.rows.length} stale/bad asset rows:`);
    deleted.rows.forEach(r => console.log(`  - id=${r.id} name="${r.name}" path="${r.file_path}"`));
  } else {
    console.log('No stale asset rows to remove.');
  }
 
  // Upsert the tape assets. Using ON CONFLICT on file_path so re-running
  // seed is safe — it updates the name/reward flag but won't duplicate rows.
  // This requires a UNIQUE constraint on art_assets.file_path.
  // If you don't have that constraint yet, run this migration first:
  //   ALTER TABLE art_assets ADD CONSTRAINT art_assets_file_path_key UNIQUE (file_path);
  for (const a of assets) {
    await db.query(
      `INSERT INTO art_assets (name, file_path, is_achievement_reward)
       VALUES ($1, $2, $3)
       ON CONFLICT (file_path) DO UPDATE
         SET name = EXCLUDED.name,
             is_achievement_reward = EXCLUDED.is_achievement_reward`,
      [a.name, a.file, a.reward]
    );
  }
  console.log(`Inserted/updated ${assets.length} art assets.`);
 
  console.log('Seed complete!');
  process.exit(0);
}
 

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});


