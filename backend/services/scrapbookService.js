const db = require('../db/db');
const fs = require('fs');
const path = require('path');

// ── Helper ─────────────────────────────────────────────────────────────────

async function verifyLogOwnership(logId, userId) {
  const result = await db.query(
    'SELECT id FROM day_logs WHERE id = $1 AND user_id = $2',
    [logId, userId]
  );
  return result.rows.length > 0;
}

function deleteFile(filePath) {
  const full = path.join(__dirname, '../', filePath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

// ── Day Log ────────────────────────────────────────────────────────────────

exports.getOrCreateLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    let result = await db.query(
      'SELECT * FROM day_logs WHERE user_id = $1 AND log_date = $2',
      [userId, date]
    );

    if (result.rows.length === 0) {
      result = await db.query(
        `INSERT INTO day_logs (user_id, log_date) VALUES ($1, $2) RETURNING *`,
        [userId, date]
      );
    }

    const log = result.rows[0];

    // Fetch all content in parallel — now includes videos and audio
    const [photos, videos, audio, notes, answers, stickers] = await Promise.all([
      db.query('SELECT * FROM log_photos  WHERE log_id = $1 ORDER BY z_index', [log.id]),
      db.query('SELECT * FROM log_videos  WHERE log_id = $1 ORDER BY z_index', [log.id]),
      db.query('SELECT * FROM log_audio   WHERE log_id = $1 ORDER BY z_index', [log.id]),
      db.query('SELECT * FROM log_notes   WHERE log_id = $1 ORDER BY z_index', [log.id]),
      db.query(
        `SELECT lpa.*, rp.prompt_text, rp.category
         FROM prompt_answers lpa
         JOIN reflective_prompts rp ON lpa.prompt_id = rp.id
         WHERE lpa.log_id = $1`,
        [log.id]
      ),
      db.query(
        `SELECT ls.*, aa.file_path as asset_path, aa.name as asset_name
         FROM log_stickers ls
         JOIN art_assets aa ON ls.asset_id = aa.id
         WHERE ls.log_id = $1 ORDER BY ls.z_index`,
        [log.id]
      ),
    ]);

    res.json({
      log,
      photos:   photos.rows,
      videos:   videos.rows,
      audio:    audio.rows,
      notes:    notes.rows,
      answers:  answers.rows,
      stickers: stickers.rows,
    });

  } catch (err) {
    console.error('getOrCreateLog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAllLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT
        dl.id,
        dl.log_date,
        dl.mood,
        dl.achievement_unlocked,
        COUNT(DISTINCT lp.id) AS photo_count,
        COUNT(DISTINCT ln.id) AS note_count
       FROM day_logs dl
       LEFT JOIN log_photos lp ON lp.log_id = dl.id
       LEFT JOIN log_notes   ln ON ln.log_id = dl.id
       WHERE dl.user_id = $1
       GROUP BY dl.id
       ORDER BY dl.log_date DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getAllLogs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const { mood, layout_style } = req.body;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    const result = await db.query(
      `UPDATE day_logs SET mood = COALESCE($1, mood), layout_style = COALESCE($2, layout_style), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [mood, layout_style, logId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateLog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Photos ─────────────────────────────────────────────────────────────────

exports.uploadPhoto = async (req, res) => {
  try {
    const { logId } = req.params;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = `uploads/${req.file.filename}`;
    const result = await db.query(
      `INSERT INTO log_photos (log_id, file_path, original_name, file_size) VALUES ($1, $2, $3, $4) RETURNING *`,
      [logId, filePath, req.file.originalname, req.file.size]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('uploadPhoto error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { pos_x, pos_y, width, height, rotation, z_index, caption } = req.body;
    const ownership = await db.query(
      `SELECT dl.user_id FROM log_photos lp JOIN day_logs dl ON lp.log_id = dl.id WHERE lp.id = $1`,
      [photoId]
    );
    if (!ownership.rows.length || ownership.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    const result = await db.query(
      `UPDATE log_photos SET pos_x=COALESCE($1,pos_x), pos_y=COALESCE($2,pos_y), width=COALESCE($3,width), height=COALESCE($4,height), rotation=COALESCE($5,rotation), z_index=COALESCE($6,z_index), caption=COALESCE($7,caption) WHERE id=$8 RETURNING *`,
      [pos_x, pos_y, width, height, rotation, z_index, caption, photoId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updatePhoto error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const photo = await db.query(
      `SELECT lp.*, dl.user_id FROM log_photos lp JOIN day_logs dl ON lp.log_id = dl.id WHERE lp.id = $1`,
      [photoId]
    );
    if (!photo.rows.length) return res.status(404).json({ error: 'Photo not found' });
    if (photo.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    await db.query('DELETE FROM log_photos WHERE id = $1', [photoId]);
    deleteFile(photo.rows[0].file_path);
    res.json({ message: 'Photo deleted successfully' });
  } catch (err) {
    console.error('deletePhoto error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Videos ─────────────────────────────────────────────────────────────────

exports.uploadVideo = async (req, res) => {
  try {
    const { logId } = req.params;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = `uploads/${req.file.filename}`;
    const result = await db.query(
      `INSERT INTO log_videos (log_id, file_path, original_name, file_size) VALUES ($1, $2, $3, $4) RETURNING *`,
      [logId, filePath, req.file.originalname, req.file.size]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('uploadVideo error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await db.query(
      `SELECT lv.*, dl.user_id FROM log_videos lv JOIN day_logs dl ON lv.log_id = dl.id WHERE lv.id = $1`,
      [videoId]
    );
    if (!video.rows.length) return res.status(404).json({ error: 'Video not found' });
    if (video.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    await db.query('DELETE FROM log_videos WHERE id = $1', [videoId]);
    deleteFile(video.rows[0].file_path);
    res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('deleteVideo error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Audio ──────────────────────────────────────────────────────────────────

exports.uploadAudio = async (req, res) => {
  try {
    const { logId } = req.params;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = `uploads/${req.file.filename}`;
    const result = await db.query(
      `INSERT INTO log_audio (log_id, file_path, original_name, file_size) VALUES ($1, $2, $3, $4) RETURNING *`,
      [logId, filePath, req.file.originalname, req.file.size]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('uploadAudio error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteAudio = async (req, res) => {
  try {
    const { audioId } = req.params;
    const audio = await db.query(
      `SELECT la.*, dl.user_id FROM log_audio la JOIN day_logs dl ON la.log_id = dl.id WHERE la.id = $1`,
      [audioId]
    );
    if (!audio.rows.length) return res.status(404).json({ error: 'Audio not found' });
    if (audio.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    await db.query('DELETE FROM log_audio WHERE id = $1', [audioId]);
    deleteFile(audio.rows[0].file_path);
    res.json({ message: 'Audio deleted successfully' });
  } catch (err) {
    console.error('deleteAudio error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Notes ──────────────────────────────────────────────────────────────────

exports.createNote = async (req, res) => {
  try {
    const { logId } = req.params;
    const { content, pos_x, pos_y, bg_color, font_size } = req.body;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    const result = await db.query(
      `INSERT INTO log_notes (log_id, content, pos_x, pos_y, bg_color, font_size) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [logId, content, pos_x||0, pos_y||0, bg_color||'#FFFDE7', font_size||14]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createNote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { content, pos_x, pos_y, width, rotation, z_index, bg_color, font_size } = req.body;
    const ownership = await db.query(
      `SELECT dl.user_id FROM log_notes ln JOIN day_logs dl ON ln.log_id = dl.id WHERE ln.id = $1`,
      [noteId]
    );
    if (!ownership.rows.length || ownership.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    const result = await db.query(
      `UPDATE log_notes SET content=COALESCE($1,content), pos_x=COALESCE($2,pos_x), pos_y=COALESCE($3,pos_y), width=COALESCE($4,width), rotation=COALESCE($5,rotation), z_index=COALESCE($6,z_index), bg_color=COALESCE($7,bg_color), font_size=COALESCE($8,font_size) WHERE id=$9 RETURNING *`,
      [content, pos_x, pos_y, width, rotation, z_index, bg_color, font_size, noteId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateNote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const ownership = await db.query(
      `SELECT dl.user_id FROM log_notes ln JOIN day_logs dl ON ln.log_id = dl.id WHERE ln.id = $1`,
      [noteId]
    );
    if (!ownership.rows.length || ownership.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    await db.query('DELETE FROM log_notes WHERE id = $1', [noteId]);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('deleteNote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Prompts ────────────────────────────────────────────────────────────────

exports.getDailyPrompt = async (req, res) => {
  try {
    const { category } = req.query;
    let query = `SELECT * FROM reflective_prompts WHERE is_active = true`;
    const params = [];
    
    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }
    
    query += ` ORDER BY id`;
    
    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No prompts found' });
    
    // Pick a prompt based on day of year to ensure same prompt all day
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const promptIndex = dayOfYear % result.rows.length;
    res.json(result.rows[promptIndex]);
  } catch (err) {
    console.error('getDailyPrompt error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.savePromptAnswer = async (req, res) => {
  try {
    const { logId } = req.params;
    const { prompt_id, answer_text, pos_x, pos_y, width, height, z_index } = req.body;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    if (!answer_text?.trim()) return res.status(400).json({ error: 'Answer text is required' });
    const result = await db.query(
      `INSERT INTO prompt_answers (log_id, prompt_id, answer_text, pos_x, pos_y, width, height, z_index) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [logId, prompt_id, answer_text.trim(), pos_x||0, pos_y||0, width||260, height||120, z_index||0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('savePromptAnswer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePromptAnswer = async (req, res) => {
  try {
    const { answerId } = req.params;
    // 1. We added prompt_id to the destructured body here:
    const { prompt_id, answer_text, pos_x, pos_y, width, height, z_index } = req.body;
    
    const ownership = await db.query(`SELECT log_id FROM prompt_answers WHERE id = $1`, [answerId]);
    if (!ownership.rows.length) return res.status(404).json({ error: 'Not found' });
    
    const isOwner = await verifyLogOwnership(ownership.rows[0].log_id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    
    const result = await db.query(
      // 2. We added prompt_id=COALESCE($7,prompt_id) to the SQL query, and shifted id to $8
      `UPDATE prompt_answers SET answer_text=COALESCE($1,answer_text), pos_x=COALESCE($2,pos_x), pos_y=COALESCE($3,pos_y), width=COALESCE($4,width), height=COALESCE($5,height), z_index=COALESCE($6,z_index), prompt_id=COALESCE($7,prompt_id) WHERE id=$8 RETURNING *`,
      // 3. We added prompt_id to the array of variables passed to SQL
      [answer_text, pos_x, pos_y, width, height, z_index, prompt_id, answerId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updatePromptAnswer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Stickers ───────────────────────────────────────────────────────────────

exports.getArtAssets = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM art_assets WHERE is_active = true ORDER BY name`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.placeSticker = async (req, res) => {
  try {
    const { logId } = req.params;
    const { asset_id, pos_x, pos_y, width, height, rotation } = req.body;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    const asset = await db.query('SELECT * FROM art_assets WHERE id = $1', [asset_id]);
    if (asset.rows[0]?.is_achievement_reward) {
      const log = await db.query('SELECT achievement_unlocked FROM day_logs WHERE id = $1', [logId]);
      if (!log.rows[0]?.achievement_unlocked)
        return res.status(403).json({ error: 'Complete all tasks to unlock this sticker!' });
    }
    const result = await db.query(
      `INSERT INTO log_stickers (log_id, asset_id, pos_x, pos_y, width, height, rotation) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [logId, asset_id, pos_x||0, pos_y||0, width||80, height||80, rotation||0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('placeSticker error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateSticker = async (req, res) => {
  try {
    const { stickerId } = req.params;
    const { pos_x, pos_y, width, height, rotation, z_index } = req.body;
    const ownership = await db.query(`SELECT log_id FROM log_stickers WHERE id = $1`, [stickerId]);
    if (!ownership.rows.length) return res.status(404).json({ error: 'Sticker not found' });
    const isOwner = await verifyLogOwnership(ownership.rows[0].log_id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    const result = await db.query(
      `UPDATE log_stickers SET pos_x=COALESCE($1,pos_x), pos_y=COALESCE($2,pos_y), width=COALESCE($3,width), height=COALESCE($4,height), rotation=COALESCE($5,rotation), z_index=COALESCE($6,z_index) WHERE id=$7 RETURNING *`,
      [pos_x, pos_y, width, height, rotation, z_index, stickerId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateSticker error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteSticker = async (req, res) => {
  try {
    const { stickerId } = req.params;
    const ownership = await db.query(`SELECT log_id FROM log_stickers WHERE id = $1`, [stickerId]);
    if (!ownership.rows.length) return res.status(404).json({ error: 'Sticker not found' });
    const isOwner = await verifyLogOwnership(ownership.rows[0].log_id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    await db.query('DELETE FROM log_stickers WHERE id = $1', [stickerId]);
    res.json({ message: 'Sticker deleted' });
  } catch (err) {
    console.error('deleteSticker error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Layout ─────────────────────────────────────────────────────────────────

exports.saveLayout = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { logId } = req.params;
    const { photos, videos, audios, notes, stickers, answers, layout_style, mood } = req.body;

    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });

    await client.query('BEGIN');
    
    if (photos) {
      for (const p of photos) {
        await client.query(
          `UPDATE log_photos SET pos_x=$1,pos_y=$2,width=$3,height=$4,rotation=$5,z_index=$6 WHERE id=$7 AND log_id=$8`,
          [p.pos_x,p.pos_y,p.width,p.height,p.rotation,p.z_index,p.id,logId]
        );
      }
    }
    if (videos) {
      for (const v of videos) {
        await client.query(
          `UPDATE log_videos SET pos_x=$1,pos_y=$2,width=$3,height=$4,rotation=$5,z_index=$6 WHERE id=$7 AND log_id=$8`,
          [v.pos_x,v.pos_y,v.width,v.height,v.rotation,v.z_index,v.id,logId]
        );
      }
    }
    if (audios) {
      for (const a of audios) {
        await client.query(
          `UPDATE log_audio SET pos_x=$1,pos_y=$2,width=$3,height=$4,rotation=$5,z_index=$6 WHERE id=$7 AND log_id=$8`,
          [a.pos_x,a.pos_y,a.width,a.height,a.rotation,a.z_index,a.id,logId]
        );
      }
    }
    if (notes) {
      for (const n of notes) {
        await client.query(
          `UPDATE log_notes SET pos_x=$1,pos_y=$2,width=$3,rotation=$4,z_index=$5 WHERE id=$6 AND log_id=$7`,
          [n.pos_x,n.pos_y,n.width,n.rotation,n.z_index,n.id,logId]
        );
      }
    }
    // Update Prompt Answer Positions and size
    if (answers) {
      for (const a of answers) {
        await client.query(
          `UPDATE prompt_answers SET pos_x=COALESCE($1,pos_x), pos_y=COALESCE($2,pos_y), width=COALESCE($3,width), height=COALESCE($4,height), z_index=COALESCE($5,z_index) WHERE id=$6 AND log_id=$7`,
          [a.pos_x, a.pos_y, a.width, a.height, a.z_index, a.id, logId]
        );
      }
    }
    if (stickers) {
      for (const s of stickers) {
        await db.query(
          `UPDATE log_stickers SET pos_x=COALESCE($1,pos_x), pos_y=COALESCE($2,pos_y), width=COALESCE($3,width), height=COALESCE($4,height), z_index=COALESCE($5,z_index) WHERE id=$6 AND log_id=$7`,
          [s.pos_x, s.pos_y, s.width, s.height, s.z_index, s.id, logId]
        );
      }
    }    if (stickers) {
      for (const s of stickers) {
        await client.query(
          `UPDATE log_stickers SET pos_x=$1,pos_y=$2,width=$3,height=$4,rotation=$5,z_index=$6 WHERE id=$7 AND log_id=$8`,
          [s.pos_x,s.pos_y,s.width,s.height,s.rotation,s.z_index,s.id,logId]
        );
      }
    }
    await client.query(
      `UPDATE day_logs SET layout_style=COALESCE($1,layout_style), mood=COALESCE($2,mood), updated_at=NOW() WHERE id=$3`,
      [layout_style, mood, logId]
    );
    await client.query('COMMIT');
    res.json({ message: 'Layout saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('saveLayout error:', err);
    res.status(500).json({ error: 'Failed to save layout' });
  } finally {
    client.release();
  }
};

exports.unlockAchievement = async (req, res) => {
  try {
    const { logId } = req.params;
    const isOwner = await verifyLogOwnership(logId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    await db.query('UPDATE day_logs SET achievement_unlocked = true WHERE id = $1', [logId]);
    res.json({ message: 'Achievement unlocked!', achievement: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
