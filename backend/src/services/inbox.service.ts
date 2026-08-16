import { DatabaseService } from './database.service';

export class InboxService {
  constructor(private db: DatabaseService) {}

  async sendInboxMessage(
    userId: string,
    category: string,
    title: string,
    body: string,
    deepLink?: string
  ) {
    const row = await this.db.query(
      `INSERT INTO inbox_messages (user_id, category, title, body, deep_link)
       VALUES ($1, $2::inbox_category, $3, $4, $5)
       RETURNING *`,
      [userId, category, title, body, deepLink || null]
    );
    const created = row.rows[0];
    try {
      const { getPushService } = require('./push.service');
      getPushService(this.db)
        .sendToUser(userId, {
          title,
          body,
          deepLink,
          data: {
            category: String(category || ''),
            inboxId: String(created?.id || ''),
            deepLink: deepLink || '',
          },
        })
        .catch(() => undefined);
    } catch {
      /* push is optional */
    }
    return created;
  }

  async list(userId: string, opts: { category?: string; limit?: number; offset?: number } = {}) {
    const values: any[] = [userId];
    let q = `SELECT * FROM inbox_messages WHERE user_id = $1`;
    if (opts.category) {
      values.push(opts.category);
      q += ` AND category = $${values.length}::inbox_category`;
    }
    q += ` ORDER BY created_at DESC`;
    values.push(opts.limit || 50);
    q += ` LIMIT $${values.length}`;
    values.push(opts.offset || 0);
    q += ` OFFSET $${values.length}`;
    return this.db.query(q, values);
  }

  async markRead(userId: string, id: string) {
    return this.db.query(
      `UPDATE inbox_messages SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
  }

  async markAllRead(userId: string) {
    return this.db.query(
      `UPDATE inbox_messages SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );
  }

  async unreadCount(userId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM inbox_messages WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );
    return result.rows[0]?.count || 0;
  }
}
