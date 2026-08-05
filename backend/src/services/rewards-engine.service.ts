import { DatabaseService } from './database.service';
import { PointsService } from './points.service';
import { InboxService } from './inbox.service';
import { TokenService } from './token.service';

/**
 * Central rewards trigger engine (Phase 16).
 * Call sites must use emitActivityEvent — not direct points inserts.
 */
export class RewardsEngineService {
  private points: PointsService;
  private inbox: InboxService;
  private tokens: TokenService;

  constructor(private db: DatabaseService) {
    this.points = new PointsService(db);
    this.inbox = new InboxService(db);
    this.tokens = new TokenService(db);
  }

  async emitActivityEvent(
    userId: string,
    eventType: string,
    metadata: Record<string, unknown> = {}
  ) {
    const rules = await this.db.query(
      `SELECT * FROM rewards_rules WHERE event_type = $1 AND active = TRUE`,
      [eventType]
    );
    const rule = rules.rows[0];
    if (!rule) {
      return { awarded: false, reason: 'no_active_rule' };
    }

    const pointsRow = await this.points.award(
      userId,
      eventType,
      String(metadata.description || eventType),
      Number(rule.points_amount)
    );

    if (Number(rule.dvt_amount) > 0) {
      await this.tokens.distributeReward(
        userId,
        Number(rule.dvt_amount),
        eventType,
        String(metadata.ref || pointsRow?.id || eventType)
      );
    }

    await this.inbox.sendInboxMessage(
      userId,
      'rewards',
      'Points earned',
      `You earned ${rule.points_amount} points for ${eventType.replace(/_/g, ' ')}.`,
      '/points'
    );

    return {
      awarded: true,
      points: rule.points_amount,
      dvt: rule.dvt_amount,
      ledger: pointsRow,
      metadata,
    };
  }

  async listRules() {
    return this.db.query(`SELECT * FROM rewards_rules ORDER BY event_type`);
  }

  async updateRule(
    eventType: string,
    patch: { points_amount?: number; dvt_amount?: number; active?: boolean }
  ) {
    return this.db.query(
      `UPDATE rewards_rules SET
         points_amount = COALESCE($1, points_amount),
         dvt_amount = COALESCE($2, dvt_amount),
         active = COALESCE($3, active),
         updated_at = NOW()
       WHERE event_type = $4
       RETURNING *`,
      [
        patch.points_amount ?? null,
        patch.dvt_amount ?? null,
        patch.active ?? null,
        eventType,
      ]
    );
  }
}
