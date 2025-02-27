import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file path (ES Modules equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

export default db;

// Add this function to modify the campaigns table
export function updateCampaignsTable() {
  return new Promise((resolve, reject) => {
    // First check if user_id column exists and is NOT NULL
    db.get("PRAGMA table_info(campaigns)", [], (err, rows) => {
      if (err) {
        console.error('Error checking campaigns table schema:', err);
        reject(err);
        return;
      }
      
      // If the table exists, modify it
      db.run(`
        CREATE TABLE IF NOT EXISTS campaigns_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'draft',
          reward TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, function(err) {
        if (err) {
          console.error('Error creating new campaigns table:', err);
          reject(err);
          return;
        }
        
        // Copy data from old table to new table
        db.run(`
          INSERT INTO campaigns_new (id, title, description, status, reward, created_at, updated_at)
          SELECT id, title, description, status, reward, created_at, updated_at FROM campaigns
        `, function(err) {
          if (err) {
            console.error('Error copying campaigns data:', err);
            reject(err);
            return;
          }
          
          // Drop old table and rename new table
          db.run(`DROP TABLE IF EXISTS campaigns`, function(err) {
            if (err) {
              console.error('Error dropping old campaigns table:', err);
              reject(err);
              return;
            }
            
            db.run(`ALTER TABLE campaigns_new RENAME TO campaigns`, function(err) {
              if (err) {
                console.error('Error renaming campaigns table:', err);
                reject(err);
                return;
              }
              
              console.log('Successfully updated campaigns table to remove user_id requirement');
              resolve();
            });
          });
        });
      });
    });
  });
}

export const updateCampaignsTable = () => {
  return new Promise((resolve, reject) => {
    db.run(`ALTER TABLE campaigns ADD COLUMN reward TEXT;`, (err) => {
      if (err) {
        // Column might already exist, which is fine
        if (err.message.includes('duplicate column name')) {
          resolve();
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  });
}; 