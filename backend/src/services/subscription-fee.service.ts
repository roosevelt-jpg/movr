import { DatabaseService } from './database.service';

export type SubscriptionAudience =
  | 'driver'
  | 'bike_listing'
  | 'rental_owner'
  | 'merchant';

export type ResolveContext = {
  audience: SubscriptionAudience;
  userId?: string;
  countryCode?: string | null;
  city?: string | null;
  vehicleCategory?: string | null;
  vehicleTypeCode?: string | null;
  interval?: 'weekly' | 'monthly';
};

/**
 * Intelligent subscription fee assignment.
 * Drivers keep 100% of fare — MOVR bills recurring subscriptions by
 * vehicle size/category, country, and city via plans + subscription_fee_rules.
 */
export class SubscriptionFeeService {
  constructor(private db: DatabaseService) {}

  async inferContextFromUser(
    userId: string,
    audience: SubscriptionAudience = 'driver'
  ): Promise<ResolveContext> {
    const user = (
      await this.db.query(
        `SELECT id, country, city, user_type FROM users WHERE id = $1`,
        [userId]
      )
    ).rows[0];

    let vehicleCategory: string | null = null;
    let vehicleTypeCode: string | null = null;
    let country = user?.country || null;
    let city = user?.city || null;

    if (audience === 'driver' || audience === 'bike_listing') {
      const veh = await this.db
        .query(
          `SELECT vt.category::text AS category, vt.code
           FROM drivers d
           LEFT JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
           WHERE d.user_id = $1
           LIMIT 1`,
          [userId]
        )
        .catch(() => ({ rows: [] as any[] }));
      vehicleCategory = veh.rows[0]?.category || null;
      vehicleTypeCode = veh.rows[0]?.code || null;

      if (!vehicleCategory) {
        const alt = await this.db
          .query(
            `SELECT vt.category::text AS category, vt.code
             FROM driver_vehicles dv
             LEFT JOIN vehicle_types vt ON vt.code = dv.vehicle_type OR vt.name ILIKE dv.vehicle_type
             WHERE dv.driver_user_id = $1
             ORDER BY dv.created_at DESC NULLS LAST
             LIMIT 1`,
            [userId]
          )
          .catch(() => ({ rows: [] as any[] }));
        vehicleCategory = alt.rows[0]?.category || vehicleCategory;
        vehicleTypeCode = alt.rows[0]?.code || vehicleTypeCode;
      }
    }

    if (audience === 'rental_owner') {
      const rental = await this.db
        .query(
          `SELECT category, vehicle_type, country_code, city
           FROM rental_vehicles
           WHERE owner_user_id = $1 OR host_user_id = $1
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
           LIMIT 1`,
          [userId]
        )
        .catch(() => ({ rows: [] as any[] }));
      if (rental.rows[0]) {
        vehicleCategory = String(rental.rows[0].category || rental.rows[0].vehicle_type || '')
          .toLowerCase()
          .replace(/\s+/g, '_') || null;
        country = rental.rows[0].country_code || country;
        city = rental.rows[0].city || city;
      }
    }

    if (audience === 'merchant') {
      const m = await this.db
        .query(
          `SELECT country, city FROM merchants WHERE user_id = $1 LIMIT 1`,
          [userId]
        )
        .catch(() => ({ rows: [] as any[] }));
      country = m.rows[0]?.country || country;
      city = m.rows[0]?.city || city;
    }

    if (audience === 'bike_listing' && !vehicleCategory) {
      vehicleCategory = 'bicycle';
    }

    return {
      audience,
      userId,
      countryCode: country,
      city,
      vehicleCategory,
      vehicleTypeCode,
      interval: 'monthly',
    };
  }

  /**
   * Score rule specificity: city+category > category+country > country > audience default.
   */
  private scoreRule(rule: any, ctx: ResolveContext): number {
    if (!rule.is_active) return -1;
    if (rule.audience !== ctx.audience) return -1;
    if (rule.interval && ctx.interval && rule.interval !== ctx.interval) return -1;

    const rc = rule.country_code ? String(rule.country_code).toUpperCase() : null;
    const cc = ctx.countryCode ? String(ctx.countryCode).toUpperCase() : null;
    if (rc && cc && rc !== cc) return -1;
    if (rc && !cc) return -1;

    const rCity = rule.city ? String(rule.city).toLowerCase() : null;
    const cCity = ctx.city ? String(ctx.city).toLowerCase() : null;
    if (rCity && (!cCity || rCity !== cCity)) return -1;

    const rCat = rule.vehicle_category ? String(rule.vehicle_category).toLowerCase() : null;
    const cCat = ctx.vehicleCategory ? String(ctx.vehicleCategory).toLowerCase() : null;
    if (rCat && (!cCat || rCat !== cCat)) return -1;

    const rCode = rule.vehicle_type_code ? String(rule.vehicle_type_code).toLowerCase() : null;
    const cCode = ctx.vehicleTypeCode ? String(ctx.vehicleTypeCode).toLowerCase() : null;
    if (rCode && (!cCode || rCode !== cCode)) return -1;

    let score = Number(rule.priority || 0);
    if (rc && cc && rc === cc) score += 20;
    if (rCity && cCity && rCity === cCity) score += 40;
    if (rCat && cCat && rCat === cCat) score += 30;
    if (rCode && cCode && rCode === cCode) score += 25;
    return score;
  }

  async resolve(ctx: ResolveContext) {
    const interval = ctx.interval || 'monthly';
    const normalized: ResolveContext = {
      ...ctx,
      countryCode: ctx.countryCode ? String(ctx.countryCode).toUpperCase() : null,
      city: ctx.city || null,
      vehicleCategory: ctx.vehicleCategory
        ? String(ctx.vehicleCategory).toLowerCase()
        : null,
      vehicleTypeCode: ctx.vehicleTypeCode
        ? String(ctx.vehicleTypeCode).toLowerCase()
        : null,
      interval,
    };

    const rules = await this.db
      .query(
        `SELECT * FROM subscription_fee_rules
         WHERE audience = $1 AND is_active = TRUE
         ORDER BY priority DESC, updated_at DESC`,
        [normalized.audience]
      )
      .catch(() => ({ rows: [] as any[] }));

    let best: any = null;
    let bestScore = -1;
    for (const rule of rules.rows) {
      const score = this.scoreRule(rule, normalized);
      if (score > bestScore) {
        bestScore = score;
        best = rule;
      }
    }

    let plan: any = null;
    if (best?.plan_id) {
      plan = (
        await this.db.query(`SELECT * FROM plans WHERE id = $1 AND COALESCE(is_active, TRUE) = TRUE`, [
          best.plan_id,
        ])
      ).rows[0];
    }

    // Fallback: best matching plan row by dimensions (no rule)
    if (!plan) {
      plan = (
        await this.db.query(
          `SELECT * FROM plans
           WHERE COALESCE(is_active, TRUE) = TRUE
             AND audience = $1
             AND COALESCE(interval, 'monthly') = $2
             AND ($3::text IS NULL OR country_code IS NULL OR country_code = $3)
             AND ($4::text IS NULL OR vehicle_category IS NULL OR vehicle_category = $4)
             AND ($5::text IS NULL OR city IS NULL OR LOWER(city) = LOWER($5))
           ORDER BY
             CASE WHEN city IS NOT NULL AND $5::text IS NOT NULL AND LOWER(city) = LOWER($5) THEN 0 ELSE 1 END,
             CASE WHEN vehicle_category IS NOT NULL AND vehicle_category = $4 THEN 0 ELSE 1 END,
             CASE WHEN country_code IS NOT NULL AND country_code = $3 THEN 0 ELSE 1 END,
             sort_order NULLS LAST,
             amount
           LIMIT 1`,
          [
            normalized.audience,
            interval,
            normalized.countryCode,
            normalized.vehicleCategory,
            normalized.city,
          ]
        )
      ).rows[0];
    }

    // Absolute fallback for drivers
    if (!plan && normalized.audience === 'driver') {
      plan = (
        await this.db.query(
          `SELECT * FROM plans WHERE id = $1`,
          [interval === 'weekly' ? 'weekly_driver' : 'monthly_driver']
        )
      ).rows[0];
    }

    if (!plan) {
      throw new Error(
        `No subscription plan for ${normalized.audience}` +
          (normalized.vehicleCategory ? ` / ${normalized.vehicleCategory}` : '') +
          (normalized.countryCode ? ` / ${normalized.countryCode}` : '')
      );
    }

    const amount =
      best?.amount_override != null ? Number(best.amount_override) : Number(plan.amount);
    const currency = best?.currency_override || plan.currency || 'NGN';

    return {
      context: normalized,
      rule: best
        ? {
            id: best.id,
            label: best.label,
            priority: best.priority,
            score: bestScore,
          }
        : null,
      plan: {
        ...plan,
        amount,
        currency,
        features:
          typeof plan.features === 'string'
            ? (() => {
                try {
                  return JSON.parse(plan.features);
                } catch {
                  return [];
                }
              })()
            : plan.features,
      },
      amount,
      currency,
      interval,
      explanation: this.explain(normalized, best, plan),
    };
  }

  private explain(ctx: ResolveContext, rule: any, plan: any): string {
    const parts = [
      `Audience: ${ctx.audience}`,
      ctx.vehicleCategory ? `vehicle: ${ctx.vehicleCategory}` : null,
      ctx.countryCode ? `country: ${ctx.countryCode}` : null,
      ctx.city ? `city: ${ctx.city}` : null,
      rule?.label ? `rule: ${rule.label}` : 'matched plan matrix',
      `→ ${plan.id} @ ${plan.amount} ${plan.currency}/${ctx.interval || 'monthly'}`,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  async listPlans(filters: {
    audience?: string;
    countryCode?: string;
    activeOnly?: boolean;
  }) {
    const params: any[] = [];
    const where: string[] = ['1=1'];
    if (filters.audience) {
      params.push(filters.audience);
      where.push(`audience = $${params.length}`);
    }
    if (filters.countryCode) {
      params.push(filters.countryCode.toUpperCase());
      where.push(`(country_code IS NULL OR country_code = $${params.length})`);
    }
    if (filters.activeOnly !== false) {
      where.push(`COALESCE(is_active, TRUE) = TRUE`);
    }
    const rows = await this.db.query(
      `SELECT * FROM plans WHERE ${where.join(' AND ')}
       ORDER BY audience, COALESCE(sort_order, 99), amount`,
      params
    );
    return rows.rows.map((p: any) => ({
      ...p,
      features:
        typeof p.features === 'string'
          ? (() => {
              try {
                return JSON.parse(p.features);
              } catch {
                return [];
              }
            })()
          : p.features || [],
    }));
  }

  async listRules(audience?: string) {
    const rows = audience
      ? await this.db.query(
          `SELECT r.*, p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency
           FROM subscription_fee_rules r
           LEFT JOIN plans p ON p.id = r.plan_id
           WHERE r.audience = $1
           ORDER BY r.priority DESC, r.updated_at DESC`,
          [audience]
        )
      : await this.db.query(
          `SELECT r.*, p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency
           FROM subscription_fee_rules r
           LEFT JOIN plans p ON p.id = r.plan_id
           ORDER BY r.audience, r.priority DESC, r.updated_at DESC`
        );
    return rows.rows;
  }

  async upsertPlan(body: any) {
    const id =
      body.id ||
      `${body.audience || 'plan'}_${body.vehicle_category || 'any'}_${body.country_code || 'xx'}_${body.interval || 'monthly'}_${Date.now()}`
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .slice(0, 64);

    const result = await this.db.query(
      `INSERT INTO plans (
         id, name, features, amount, currency, interval, audience, vehicle_category,
         vehicle_type_code, country_code, city, size_tier, is_active, headline, subtitle,
         sort_order, description, is_featured
       ) VALUES (
         $1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13,TRUE),$14,$15,COALESCE($16,0),$17,COALESCE($18,FALSE)
       )
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         features = EXCLUDED.features,
         amount = EXCLUDED.amount,
         currency = EXCLUDED.currency,
         interval = EXCLUDED.interval,
         audience = EXCLUDED.audience,
         vehicle_category = EXCLUDED.vehicle_category,
         vehicle_type_code = EXCLUDED.vehicle_type_code,
         country_code = EXCLUDED.country_code,
         city = EXCLUDED.city,
         size_tier = EXCLUDED.size_tier,
         is_active = EXCLUDED.is_active,
         headline = EXCLUDED.headline,
         subtitle = EXCLUDED.subtitle,
         sort_order = EXCLUDED.sort_order,
         description = EXCLUDED.description,
         is_featured = EXCLUDED.is_featured
       RETURNING *`,
      [
        id,
        body.name || id,
        JSON.stringify(body.features || ['Keep 100% of earnings / listing access']),
        Number(body.amount),
        body.currency || 'NGN',
        body.interval || 'monthly',
        body.audience || 'driver',
        body.vehicle_category || null,
        body.vehicle_type_code || null,
        body.country_code || null,
        body.city || null,
        body.size_tier || null,
        body.is_active,
        body.headline || body.name || null,
        body.subtitle || null,
        body.sort_order,
        body.description || null,
        body.is_featured,
      ]
    );
    return result.rows[0];
  }

  async upsertRule(body: any) {
    if (body.id) {
      const updated = await this.db.query(
        `UPDATE subscription_fee_rules SET
           audience = COALESCE($2, audience),
           vehicle_category = $3,
           vehicle_type_code = $4,
           country_code = $5,
           city = $6,
           interval = COALESCE($7, interval),
           plan_id = COALESCE($8, plan_id),
           amount_override = $9,
           currency_override = $10,
           priority = COALESCE($11, priority),
           is_active = COALESCE($12, is_active),
           label = COALESCE($13, label),
           notes = $14,
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          body.id,
          body.audience || null,
          body.vehicle_category ?? null,
          body.vehicle_type_code ?? null,
          body.country_code ?? null,
          body.city ?? null,
          body.interval || null,
          body.plan_id || null,
          body.amount_override != null ? Number(body.amount_override) : null,
          body.currency_override || null,
          body.priority != null ? Number(body.priority) : null,
          typeof body.is_active === 'boolean' ? body.is_active : null,
          body.label || null,
          body.notes || null,
        ]
      );
      return updated.rows[0];
    }
    const inserted = await this.db.query(
      `INSERT INTO subscription_fee_rules (
         audience, vehicle_category, vehicle_type_code, country_code, city, interval,
         plan_id, amount_override, currency_override, priority, is_active, label, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,100),COALESCE($11,TRUE),$12,$13)
       RETURNING *`,
      [
        body.audience,
        body.vehicle_category || null,
        body.vehicle_type_code || null,
        body.country_code || null,
        body.city || null,
        body.interval || 'monthly',
        body.plan_id,
        body.amount_override != null ? Number(body.amount_override) : null,
        body.currency_override || null,
        body.priority,
        body.is_active,
        body.label || null,
        body.notes || null,
      ]
    );
    return inserted.rows[0];
  }

  async syncFromPricingFees(pricing: {
    driver_sub_monthly?: number;
    merchant_store_monthly?: number;
    currency?: string;
  }) {
    const currency = pricing.currency || 'NGN';
    if (pricing.driver_sub_monthly != null) {
      await this.db.query(
        `UPDATE plans SET amount = $1, currency = $2
         WHERE id IN ('monthly_driver', 'drv_ng_sedan_m')`,
        [Number(pricing.driver_sub_monthly), currency]
      );
    }
    if (pricing.merchant_store_monthly != null) {
      await this.db.query(
        `UPDATE plans SET amount = $1, currency = $2 WHERE id = 'merch_ng_store_m'`,
        [Number(pricing.merchant_store_monthly), currency]
      );
    }
  }

  async previewMatrix() {
    const audiences: SubscriptionAudience[] = [
      'driver',
      'bike_listing',
      'rental_owner',
      'merchant',
    ];
    const categories = [
      'bicycle',
      'motorcycle',
      'tricycle',
      'sedan',
      'suv',
      'van',
      'luxury',
      null,
    ];
    const countries = ['NG', 'GH'];
    const samples: any[] = [];
    for (const audience of audiences) {
      for (const country of countries) {
        for (const cat of categories) {
          if (audience === 'merchant' && cat) continue;
          if (audience === 'merchant' && !cat) {
            /* ok */
          } else if (audience === 'bike_listing' && cat && !['bicycle', 'motorcycle', null].includes(cat)) {
            continue;
          }
          try {
            const resolved = await this.resolve({
              audience,
              countryCode: country,
              vehicleCategory: cat,
              city: audience === 'driver' && cat === 'sedan' && country === 'NG' ? 'Lagos' : null,
              interval: 'monthly',
            });
            samples.push({
              audience,
              country,
              vehicleCategory: cat,
              city: resolved.context.city,
              planId: resolved.plan.id,
              amount: resolved.amount,
              currency: resolved.currency,
              rule: resolved.rule?.label || null,
            });
          } catch {
            /* skip unmatched */
          }
        }
      }
    }
    return samples;
  }
}
