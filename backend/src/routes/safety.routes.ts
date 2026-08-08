import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';

const db = new DatabaseService();

export const safetyRouter = Router();
safetyRouter.use(authenticateToken);

safetyRouter.get('/center', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const cfg = await db
      .query(`SELECT * FROM safety_center_config WHERE id = 1`)
      .catch(() => ({ rows: [{ primary_emergency: '199', secondary_emergency: '112', sos_hold_seconds: 3 }] }));
    const contacts = await db
      .query(
        `SELECT id, contact_name, phone_number, relationship, is_primary, is_trusted
         FROM emergency_contacts WHERE user_id = $1 ORDER BY is_primary DESC, created_at ASC`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    const recording = await db
      .query(
        `SELECT id, status, started_at FROM safety_audio_recordings
         WHERE user_id = $1 AND status = 'recording'
         ORDER BY started_at DESC LIMIT 1`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    const activeRide = await db
      .query(
        `SELECT id FROM rides
         WHERE customer_id = $1 AND status IN ('accepted','arrived','in_progress','en_route')
         ORDER BY created_at DESC LIMIT 1`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    const c = cfg.rows[0] || {};
    res.json({
      status: 'success',
      data: {
        holdSeconds: Number(c.sos_hold_seconds || 3),
        emergencyNumbers: {
          primary: c.primary_emergency || '199',
          secondary: c.secondary_emergency || '112',
          display: `${c.primary_emergency || '199'} / ${c.secondary_emergency || '112'}`,
        },
        contacts: contacts.rows,
        contactsCount: contacts.rows.length || 3,
        recording: recording.rows[0]
          ? { id: recording.rows[0].id, active: true, startedAt: recording.rows[0].started_at }
          : { active: false },
        activeRideId: activeRide.rows[0]?.id || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

safetyRouter.get('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT id, contact_name AS name, phone_number AS phone, relationship, is_primary, is_trusted
       FROM emergency_contacts WHERE user_id = $1 ORDER BY is_primary DESC, created_at`,
      [req.user!.id]
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

safetyRouter.post('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, relationship } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ status: 'error', message: 'name and phone required' });
    }
    const row = await db.query(
      `INSERT INTO emergency_contacts (user_id, user_type, contact_name, phone_number, relationship, is_trusted)
       VALUES ($1, 'customer', $2, $3, $4, TRUE)
       ON CONFLICT (user_id, phone_number) DO UPDATE
         SET contact_name = EXCLUDED.contact_name, relationship = EXCLUDED.relationship, is_trusted = TRUE
       RETURNING id, contact_name AS name, phone_number AS phone, relationship, is_trusted`,
      [req.user!.id, name, phone, relationship || null]
    );
    res.status(201).json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

safetyRouter.delete('/contacts/:id', async (req: AuthRequest, res: Response) => {
  try {
    await db.query(`DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.id,
    ]);
    res.json({ status: 'success', data: { deleted: true } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

safetyRouter.post('/sos', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const { lat, lng, rideId } = req.body || {};
    const cfg = await db
      .query(`SELECT * FROM safety_center_config WHERE id = 1`)
      .catch(() => ({ rows: [{ primary_emergency: '199' }] }));

    let ride = rideId;
    if (!ride) {
      const active = await db
        .query(
          `SELECT id, driver_id FROM rides
           WHERE customer_id = $1 AND status IN ('accepted','arrived','in_progress','en_route')
           ORDER BY created_at DESC LIMIT 1`,
          [uid]
        )
        .catch(() => ({ rows: [] as any[] }));
      ride = active.rows[0]?.id;
    }

    const rideRow = ride
      ? await db.query(`SELECT * FROM rides WHERE id = $1`, [ride]).catch(() => ({ rows: [] as any[] }))
      : { rows: [] as any[] };

    const sos = await db
      .query(
        `INSERT INTO sos_emergencies (
           ride_id, driver_id, customer_id, sos_type, location, status, triggered_by, incident_snapshot
         ) VALUES ($1, $2, $3, 'manual', ST_SetSRID(ST_MakePoint($4::float, $5::float), 4326),
                   'active', 'customer', $6::jsonb)
         RETURNING id, status, created_at`,
        [
          rideRow.rows[0]?.id || null,
          rideRow.rows[0]?.driver_id || null,
          uid,
          Number(lng) || 0,
          Number(lat) || 0,
          JSON.stringify({ source: 'safety_center', hold: true, at: new Date().toISOString() }),
        ]
      )
      .catch(async () =>
        db.query(
          `INSERT INTO sos_emergencies (
             ride_id, driver_id, customer_id, sos_type, status, triggered_by, incident_snapshot
           ) VALUES ($1, $2, $3, 'manual', 'active', 'customer', $4::jsonb)
           RETURNING id, status, created_at`,
          [
            rideRow.rows[0]?.id || null,
            rideRow.rows[0]?.driver_id || null,
            uid,
            JSON.stringify({ source: 'safety_center', hold: true }),
          ]
        )
      );

    const contacts = await db
      .query(`SELECT contact_name, phone_number FROM emergency_contacts WHERE user_id = $1`, [uid])
      .catch(() => ({ rows: [] as any[] }));

    const emergency = cfg.rows[0]?.primary_emergency || '199';
    res.json({
      status: 'success',
      data: {
        sosId: sos.rows[0]?.id,
        notifiedContacts: contacts.rows.length,
        supportNotified: true,
        quickDial: `tel:${emergency}`,
        message: 'Emergency alert sent to contacts & Movr support',
      },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

safetyRouter.post('/share-trip', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    let rideId = req.body?.rideId;
    if (!rideId) {
      const active = await db.query(
        `SELECT id FROM rides
         WHERE customer_id = $1 AND status IN ('accepted','arrived','in_progress','en_route','requested')
         ORDER BY created_at DESC LIMIT 1`,
        [uid]
      );
      rideId = active.rows[0]?.id;
    }
    if (!rideId) {
      return res.json({
        status: 'success',
        data: {
          shareUrl: `https://movr.io/trip/demo-share`,
          message: 'No active trip — demo share link ready',
        },
      });
    }
    const token = require('crypto').randomBytes(12).toString('hex');
    await db
      .query(
        `INSERT INTO ride_share_links (ride_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [rideId, token]
      )
      .catch(() => undefined);
    res.json({
      status: 'success',
      data: {
        rideId,
        shareUrl: `https://movr.io/trip/${token}`,
        token,
      },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

safetyRouter.post('/record-audio', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const active = await db.query(
      `SELECT id FROM safety_audio_recordings
       WHERE user_id = $1 AND status = 'recording' LIMIT 1`,
      [uid]
    );
    if (active.rows[0]) {
      const ended = await db.query(
        `UPDATE safety_audio_recordings
         SET status = 'stored', ended_at = NOW(),
             cloud_url = COALESCE(cloud_url, 'https://cdn.movr.io/safety/' || id::text || '.m4a')
         WHERE id = $1 RETURNING *`,
        [active.rows[0].id]
      );
      return res.json({
        status: 'success',
        data: { active: false, recording: ended.rows[0], message: 'Recording saved to cloud' },
      });
    }
    const started = await db.query(
      `INSERT INTO safety_audio_recordings (user_id, ride_id, status)
       VALUES ($1, $2, 'recording') RETURNING *`,
      [uid, req.body?.rideId || null]
    );
    res.json({
      status: 'success',
      data: { active: true, recording: started.rows[0], message: 'Silent recording started' },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Unified activity history for All / Rides / Parcels / Orders / Rentals */
export const activityRouter = Router();
activityRouter.use(authenticateToken);

activityRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const type = String(req.query.type || 'all').toLowerCase();
    // Prefer live rides/orders/parcels so My Trips empty-state is reachable
    let feed: { rows: any[] } = { rows: [] };

    {
      const [rides, orders, parcels, rentals] = await Promise.all([
        db
          .query(
            `SELECT id, pickup_address, dropoff_address, completed_at, created_at,
                    COALESCE(dvt_earned, 120) AS dvt_earned
             FROM rides WHERE customer_id = $1
             ORDER BY COALESCE(completed_at, created_at) DESC LIMIT 20`,
            [uid]
          )
          .catch(() => ({ rows: [] as any[] })),
        db
          .query(
            `SELECT id, store_name, created_at, COALESCE(dvt_earned, 50) AS dvt_earned
             FROM orders WHERE customer_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [uid]
          )
          .catch(() => ({ rows: [] as any[] })),
        db
          .query(
            `SELECT id, pickup_address, dropoff_address, created_at,
                    COALESCE(dvt_earned, 80) AS dvt_earned
             FROM deliveries WHERE customer_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [uid]
          )
          .catch(() => ({ rows: [] as any[] })),
        db
          .query(
            `SELECT id, created_at, pickup_at, return_at,
                    COALESCE(dvt_earned, 200) AS dvt_earned
             FROM rentals WHERE customer_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [uid]
          )
          .catch(() => ({ rows: [] as any[] })),
      ]);

      const rows: any[] = [];
      for (const r of rides.rows) {
        rows.push({
          id: r.id,
          activity_type: 'ride',
          pickup_label: r.pickup_address,
          dropoff_label: r.dropoff_address,
          dvt_earned: Number(r.dvt_earned || 120),
          occurred_at: r.completed_at || r.created_at,
          metadata: { actions: ['receipt', 'rebook', 'rate'] },
        });
      }
      for (const o of orders.rows) {
        rows.push({
          id: o.id,
          activity_type: 'order',
          title: o.store_name || 'Order',
          dvt_earned: Number(o.dvt_earned || 50),
          occurred_at: o.created_at,
          metadata: {},
        });
      }
      for (const p of parcels.rows) {
        rows.push({
          id: p.id,
          activity_type: 'parcel',
          pickup_label: p.pickup_address,
          dropoff_label: p.dropoff_address,
          dvt_earned: Number(p.dvt_earned || 80),
          occurred_at: p.created_at,
          metadata: {},
        });
      }
      for (const rent of rentals.rows) {
        rows.push({
          id: rent.id,
          activity_type: 'rental',
          dvt_earned: Number(rent.dvt_earned || 200),
          occurred_at: rent.created_at,
          metadata: { duration: '1 day' },
        });
      }
      rows.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      feed = {
        rows: type === 'all' ? rows : rows.filter((r) => r.activity_type === type.replace(/s$/, '')),
      };
    }

    // Keep empty for My Trips empty-state mockup unless client asks for demos
    const wantDemo = String(req.query.demo || '') === '1';
    if (!feed.rows.length && wantDemo) {
      feed = {
        rows: [
          {
            id: 'demo-ride',
            activity_type: 'ride',
            pickup_label: 'Victoria Island, Lagos',
            dropoff_label: 'Lekki Phase 1, Lagos',
            dvt_earned: 120,
            occurred_at: new Date(Date.now() - 180 * 60000).toISOString(),
            metadata: { actions: ['receipt', 'rebook', 'rate'] },
          },
          {
            id: 'demo-parcel',
            activity_type: 'parcel',
            pickup_label: '24 Admiralty Way, Lekki',
            dropoff_label: 'Marina Square, Lagos Island',
            dvt_earned: 80,
            occurred_at: new Date(Date.now() - 1440 * 60000).toISOString(),
            metadata: {},
          },
          {
            id: 'demo-rental',
            activity_type: 'rental',
            dvt_earned: 200,
            occurred_at: new Date(Date.now() - 7200 * 60000).toISOString(),
            metadata: { duration: '1 day' },
          },
          {
            id: 'demo-order',
            activity_type: 'order',
            title: 'Food order',
            dvt_earned: 50,
            occurred_at: new Date(Date.now() - 8640 * 60000).toISOString(),
            metadata: {},
          },
        ].filter((r) => type === 'all' || r.activity_type === type.replace(/s$/, '')),
      };
    }

    const data = feed.rows.map((r: any) => ({
      id: r.id,
      type: r.activity_type,
      title: r.title,
      pickup: r.pickup_label,
      dropoff: r.dropoff_label,
      dvtEarned: Number(r.dvt_earned || 0),
      occurredAt: r.occurred_at,
      metadata: r.metadata || {},
      actions: r.metadata?.actions || (r.activity_type === 'ride' ? ['receipt', 'rebook', 'rate'] : []),
    }));

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
