import db from '../../database.js';

class AgentTable {
  async getAgentById(agentId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, row) => {
        if (err) {
          console.error('Error getting agent:', err);
          reject(err);
          return;
        }
        if (row) {
          resolve({
            ...row,
            is_running: Boolean(row.is_running),
            tools: row.tools ? JSON.parse(row.tools) : [],
            next_wake_time: row.next_wake_time || null
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async updateAgentStatus(agentId, isRunning) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE agents SET is_running = ?, updated_at = ? WHERE id = ?',
        [isRunning ? 1 : 0, new Date().toISOString(), agentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async updateAgentSleepTime(agentId, wakeTime) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE agents SET next_wake_time = ?, updated_at = ? WHERE id = ?',
        [wakeTime.toISOString(), new Date().toISOString(), agentId],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async clearAgentSleepTime(agentId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE agents SET next_wake_time = NULL, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), agentId],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async updateLastRunTime(agentId) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run('UPDATE agents SET last_run = ?, updated_at = ? WHERE id = ?', 
        [now, now, agentId], 
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }
}

// Create and export a singleton instance
const agentTable = new AgentTable();
export default agentTable; 