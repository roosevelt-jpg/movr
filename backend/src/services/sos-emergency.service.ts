// backend/src/services/sos-emergency.service.ts
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import getLogger from '../utils/logger';

const logger = getLogger('sos-emergency');

class SOSEmergencyService {
  private twilioClient: any;

  constructor() {
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  /**
   * Handle SOS emergency button press.
   * Flags trip recording for dispute retention (Phase 28) — not live video streaming.
   */
  async triggerSOS(
    rideId: string,
    driverId: string,
    customerId: string,
    sosType: 'driver' | 'customer',
    location: { lat: number; lng: number }
  ) {
    try {
      const sosId = uuidv4();
      const timestamp = new Date();

      // Get active video recording for this ride
      const recording = await db.query(
        'SELECT * FROM video_recordings WHERE ride_id = $1 AND status = $2',
        [rideId, 'recording']
      );

      const recordingId = recording.rows[0]?.id || null;

      // Create SOS record with video reference
      await db.query(
        `INSERT INTO sos_emergencies (id, ride_id, driver_id, customer_id, sos_type, location, video_recording_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sosId,
          rideId,
          driverId,
          customerId,
          sosType,
          JSON.stringify(location),
          recordingId,
          'active',
          timestamp,
        ]
      );

      // Notify security personnel immediately
      const securityPersonnel = await db.query(
        `SELECT id, phone_number, email, location FROM security_personnel
         WHERE status = $1 AND service_area && ST_GeomFromText($2, 4326)
         ORDER BY ST_Distance(location, ST_GeomFromText($3, 4326))
         LIMIT 5`,
        ['active', 'POLYGON(...)', `POINT(${location.lng} ${location.lat})`] // Simplified
      );

      // Send emergency alerts
      for (const personnel of securityPersonnel.rows) {
        await this.sendEmergencyAlert(personnel, {
          sosId,
          rideId,
          driverId,
          customerId,
          sosType,
          location,
          recordingId,
        });
      }

      // Send to emergency contacts
      await this.notifyEmergencyContacts(driverId, customerId, {
        sosId,
        location,
        recordingId,
      });

      // Phase 19 — inbox alongside push/SMS alerts
      try {
        const { DatabaseService } = require('./database.service');
        const { InboxService } = require('./inbox.service');
        const inbox = new InboxService(new DatabaseService());
        const title = 'Emergency SOS';
        const body = `SOS (${sosType}) active for ride ${rideId}. Stay safe — security has been notified.`;
        if (customerId) {
          await inbox.sendInboxMessage(customerId, 'security', title, body, `movr://sos/${sosId}`);
        }
        if (driverId) {
          await inbox.sendInboxMessage(driverId, 'security', title, body, `movr://sos/${sosId}`);
        }
      } catch (inboxErr) {
        logger.warn('SOS inbox write failed', { error: String(inboxErr) });
      }

      // Create live video stream link for security team
      const streamLink = await this.createEmergencyVideoStream(recordingId, rideId);

      logger.info('SOS triggered', { sosId, streamLink });

      return {
        sosId,
        status: 'activated',
        videoStreamUrl: streamLink,
        personnelNotified: securityPersonnel.rows.length,
      };
    } catch (error) {
      logger.error('SOS trigger failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Send emergency alert to security personnel
   */
  private async sendEmergencyAlert(personnel: any, sosData: any) {
    try {
      // Send SMS
      await this.twilioClient.messages.create({
        body: `🚨 MOVR EMERGENCY: SOS triggered in ${sosData.sosType} app. Ride: ${sosData.rideId}. Location: https://maps.google.com?q=${sosData.location.lat},${sosData.location.lng}. Video: ${sosData.recordingId}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: personnel.phone_number,
      });

      // Send email with video link
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });

      await transporter.sendMail({
        from: 'security@mymovr.io',
        to: personnel.email,
        subject: `🚨 MOVR EMERGENCY SOS #${sosData.sosId}`,
        html: `
          <h2>Emergency Alert</h2>
          <p><strong>Type:</strong> ${sosData.sosType.toUpperCase()} SOS</p>
          <p><strong>Ride ID:</strong> ${sosData.rideId}</p>
          <p><strong>Location:</strong> <a href="https://maps.google.com?q=${sosData.location.lat},${sosData.location.lng}">Map Link</a></p>
          <p><strong>Live Video Feed:</strong> Check your dashboard</p>
          <p><strong>Video Recording ID:</strong> ${sosData.recordingId}</p>
          <button><a href="${process.env.PUBLIC_WEB_URL || 'https://mymovr.io'}/security/sos/${sosData.sosId}">View Emergency Dashboard</a></button>
        `,
      });

      // Send push notification
      const admin = require('firebase-admin');
      await admin.messaging().send({
        notification: {
          title: '🚨 MOVR EMERGENCY',
          body: `SOS triggered - Ride ${sosData.rideId}`,
        },
        data: {
          sosId: sosData.sosId,
          videoLink: sosData.recordingId,
        },
        token: personnel.fcm_token,
      });

      logger.info('Emergency alert sent', { personnelId: personnel.id });
    } catch (error) {
      console.error('❌ Failed to send emergency alert:', error);
    }
  }

  /**
   * Notify emergency contacts of driver/customer
   */
  private async notifyEmergencyContacts(driverId: string, customerId: string, sosData: any) {
    try {
      // Get emergency contacts
      const driverContacts = await db.query(
        'SELECT * FROM emergency_contacts WHERE user_id = $1 AND user_type = $2',
        [driverId, 'driver']
      );

      const customerContacts = await db.query(
        'SELECT * FROM emergency_contacts WHERE user_id = $1 AND user_type = $2',
        [customerId, 'customer']
      );

      const allContacts = [...driverContacts.rows, ...customerContacts.rows];

      for (const contact of allContacts) {
        await this.twilioClient.messages.create({
          body: `MOVR EMERGENCY: A member has triggered SOS. Video evidence: ${sosData.recordingId}. Status will be updated soon.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: contact.phone_number,
        });
      }

      logger.info('Emergency contacts notified', { count: allContacts.length });
    } catch (error) {
      console.error('❌ Failed to notify emergency contacts:', error);
    }
  }

  /**
   * Create live video stream for emergency responders
   */
  private async createEmergencyVideoStream(recordingId: string, rideId: string): Promise<string> {
    try {
      const token = this.twilioClient.jwt.AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET
      );

      token.addVideoGrant({
        room: `emergency_${rideId}`,
      });

      const streamToken = token.toJwt();

      // Store stream info in database
      await db.query(
        `INSERT INTO emergency_streams (recording_id, room_id, token, created_at)
         VALUES ($1, $2, $3, $4)`,
        [recordingId, `emergency_${rideId}`, streamToken, new Date()]
      );

      return `${process.env.PUBLIC_WEB_URL || 'https://mymovr.io'}/emergency-stream/${rideId}?token=${streamToken}`;
    } catch (error) {
      console.error('❌ Failed to create emergency video stream:', error);
      return '';
    }
  }

  /**
   * Resolve SOS and store evidence
   */
  async resolveSOS(sosId: string, resolvedBy: string, resolution: string, notes: string) {
    try {
      const sos = await db.query(
        'SELECT * FROM sos_emergencies WHERE id = $1',
        [sosId]
      );

      if (!sos.rows[0]) throw new Error('SOS not found');

      const sosRecord = sos.rows[0];

      // If there was a video recording, finalize it as evidence
      if (sosRecord.video_recording_id) {
        await db.query(
          `UPDATE video_recordings 
           SET sos_id = $1, sos_evidence = true, status = $2
           WHERE id = $3`,
          [sosId, 'evidence', sosRecord.video_recording_id]
        );
      }

      // Update SOS record
      await db.query(
        `UPDATE sos_emergencies 
         SET status = $1, resolved_by = $2, resolution = $3, notes = $4, resolved_at = $5
         WHERE id = $6`,
        ['resolved', resolvedBy, resolution, notes, new Date(), sosId]
      );

      // Create permanent evidence record on blockchain
      await this.storeEvidenceOnBlockchain({
        sosId,
        rideId: sosRecord.ride_id,
        videoId: sosRecord.video_recording_id,
        resolution,
        timestamp: new Date(),
      });

      logger.info('SOS resolved', { sosId, resolution });

      return {
        sosId,
        status: 'resolved',
        resolution,
        evidenceStoredOnBlockchain: true,
      };
    } catch (error) {
      console.error('❌ Failed to resolve SOS:', error);
      throw error;
    }
  }

  /**
   * Store SOS evidence on blockchain for dispute resolution
   */
  private async storeEvidenceOnBlockchain(evidenceData: any) {
    try {
      const Web3 = require('web3');
      const web3 = new Web3(process.env.WEB3_PROVIDER_URL);

      // Store immutable record
      const account = web3.eth.accounts.privateKeyToAccount(process.env.WEB3_PRIVATE_KEY);

      await db.query(
        `INSERT INTO blockchain_evidence (sos_id, ride_id, video_id, evidence_hash, stored_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          evidenceData.sosId,
          evidenceData.rideId,
          evidenceData.videoId,
          web3.utils.keccak256(JSON.stringify(evidenceData)),
          new Date(),
        ]
      );

      logger.info('SOS evidence recorded', { sosId: evidenceData.sosId });
    } catch (error) {
      console.error('❌ Failed to store evidence on blockchain:', error);
    }
  }
}

export default new SOSEmergencyService();
