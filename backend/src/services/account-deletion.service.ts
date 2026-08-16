import bcrypt from 'bcryptjs';
import { DatabaseService } from './database.service';
import { getPushService } from './push.service';

/**
 * Play Store account deletion: deactivate, anonymize identifiers, drop push tokens.
 * Trip / payment rows stay for tax, dispute, and safety retention.
 */
export async function deleteMovrAccount(db: DatabaseService, userId: string) {
  const tag = String(userId).replace(/-/g, '').slice(0, 18);
  const email = `deleted-${tag}@deleted.mymovr.io`;
  const phone = `+000${tag.slice(0, 12)}`;
  const password = await bcrypt.hash(`deleted:${userId}:${Date.now()}`, 10);

  await db
    .query(`UPDATE drivers SET is_online = FALSE WHERE user_id = $1`, [userId])
    .catch(() => undefined);

  try {
    await getPushService(db).unregisterToken(userId);
  } catch {
    /* optional */
  }

  await db.query(
    `UPDATE users SET
       email = $2,
       phone = $3,
       first_name = 'Deleted',
       last_name = 'User',
       password = $4,
       avatar_url = NULL,
       home_address = NULL,
       home_lat = NULL,
       home_lng = NULL,
       is_active = FALSE,
       deletion_requested_at = COALESCE(deletion_requested_at, NOW()),
       deleted_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [userId, email, phone, password]
  );

  await db
    .query(
      `UPDATE users SET latitude = NULL, longitude = NULL WHERE id = $1`,
      [userId]
    )
    .catch(() => undefined);
}
