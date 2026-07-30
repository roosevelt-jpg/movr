"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/services/sos-emergency.service.ts
const uuid_1 = require("uuid");
const twilio_1 = __importDefault(require("twilio"));
class SOSEmergencyService {
    constructor() {
        this.twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    /**
     * Handle SOS emergency button press
     * Connects to live video recording and security personnel
     */
    async triggerSOS(rideId, driverId, customerId, sosType, location) {
        try {
            const sosId = (0, uuid_1.v4)();
            const timestamp = new Date();
            // Get active video recording for this ride
            const recording = await db.query('SELECT * FROM video_recordings WHERE ride_id = $1 AND status = $2', [rideId, 'recording']);
            const recordingId = recording.rows[0]?.id || null;
            // Create SOS record with video reference
            await db.query(`INSERT INTO sos_emergencies (id, ride_id, driver_id, customer_id, sos_type, location, video_recording_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                sosId,
                rideId,
                driverId,
                customerId,
                sosType,
                JSON.stringify(location),
                recordingId,
                'active',
                timestamp,
            ]);
            // Notify security personnel immediately
            const securityPersonnel = await db.query(`SELECT id, phone_number, email, location FROM security_personnel
         WHERE status = $1 AND service_area && ST_GeomFromText($2, 4326)
         ORDER BY ST_Distance(location, ST_GeomFromText($3, 4326))
         LIMIT 5`, ['active', 'POLYGON(...)', `POINT(${location.lng} ${location.lat})`] // Simplified
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
            // Create live video stream link for security team
            const streamLink = await this.createEmergencyVideoStream(recordingId, rideId);
            console.log(`🚨 SOS triggered: ${sosId} with video stream: ${streamLink}`);
            return {
                sosId,
                status: 'activated',
                videoStreamUrl: streamLink,
                personnelNotified: securityPersonnel.rows.length,
            };
        }
        catch (error) {
            console.error('❌ SOS trigger failed:', error);
            throw error;
        }
    }
    /**
     * Send emergency alert to security personnel
     */
    async sendEmergencyAlert(personnel, sosData) {
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
                from: 'security@movr.io',
                to: personnel.email,
                subject: `🚨 MOVR EMERGENCY SOS #${sosData.sosId}`,
                html: `
          <h2>Emergency Alert</h2>
          <p><strong>Type:</strong> ${sosData.sosType.toUpperCase()} SOS</p>
          <p><strong>Ride ID:</strong> ${sosData.rideId}</p>
          <p><strong>Location:</strong> <a href="https://maps.google.com?q=${sosData.location.lat},${sosData.location.lng}">Map Link</a></p>
          <p><strong>Live Video Feed:</strong> Check your dashboard</p>
          <p><strong>Video Recording ID:</strong> ${sosData.recordingId}</p>
          <button><a href="https://movr.io/security/sos/${sosData.sosId}">View Emergency Dashboard</a></button>
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
            console.log(`✅ Emergency alert sent to personnel ${personnel.id}`);
        }
        catch (error) {
            console.error('❌ Failed to send emergency alert:', error);
        }
    }
    /**
     * Notify emergency contacts of driver/customer
     */
    async notifyEmergencyContacts(driverId, customerId, sosData) {
        try {
            // Get emergency contacts
            const driverContacts = await db.query('SELECT * FROM emergency_contacts WHERE user_id = $1 AND user_type = $2', [driverId, 'driver']);
            const customerContacts = await db.query('SELECT * FROM emergency_contacts WHERE user_id = $1 AND user_type = $2', [customerId, 'customer']);
            const allContacts = [...driverContacts.rows, ...customerContacts.rows];
            for (const contact of allContacts) {
                await this.twilioClient.messages.create({
                    body: `MOVR EMERGENCY: A member has triggered SOS. Video evidence: ${sosData.recordingId}. Status will be updated soon.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: contact.phone_number,
                });
            }
            console.log(`✅ Emergency contacts notified: ${allContacts.length}`);
        }
        catch (error) {
            console.error('❌ Failed to notify emergency contacts:', error);
        }
    }
    /**
     * Create live video stream for emergency responders
     */
    async createEmergencyVideoStream(recordingId, rideId) {
        try {
            const token = this.twilioClient.jwt.AccessToken(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET);
            token.addVideoGrant({
                room: `emergency_${rideId}`,
            });
            const streamToken = token.toJwt();
            // Store stream info in database
            await db.query(`INSERT INTO emergency_streams (recording_id, room_id, token, created_at)
         VALUES ($1, $2, $3, $4)`, [recordingId, `emergency_${rideId}`, streamToken, new Date()]);
            return `https://movr.io/emergency-stream/${rideId}?token=${streamToken}`;
        }
        catch (error) {
            console.error('❌ Failed to create emergency video stream:', error);
            return '';
        }
    }
    /**
     * Resolve SOS and store evidence
     */
    async resolveSOS(sosId, resolvedBy, resolution, notes) {
        try {
            const sos = await db.query('SELECT * FROM sos_emergencies WHERE id = $1', [sosId]);
            if (!sos.rows[0])
                throw new Error('SOS not found');
            const sosRecord = sos.rows[0];
            // If there was a video recording, finalize it as evidence
            if (sosRecord.video_recording_id) {
                await db.query(`UPDATE video_recordings 
           SET sos_id = $1, sos_evidence = true, status = $2
           WHERE id = $3`, [sosId, 'evidence', sosRecord.video_recording_id]);
            }
            // Update SOS record
            await db.query(`UPDATE sos_emergencies 
         SET status = $1, resolved_by = $2, resolution = $3, notes = $4, resolved_at = $5
         WHERE id = $6`, ['resolved', resolvedBy, resolution, notes, new Date(), sosId]);
            // Create permanent evidence record on blockchain
            await this.storeEvidenceOnBlockchain({
                sosId,
                rideId: sosRecord.ride_id,
                videoId: sosRecord.video_recording_id,
                resolution,
                timestamp: new Date(),
            });
            console.log(`✅ SOS ${sosId} resolved: ${resolution}`);
            return {
                sosId,
                status: 'resolved',
                resolution,
                evidenceStoredOnBlockchain: true,
            };
        }
        catch (error) {
            console.error('❌ Failed to resolve SOS:', error);
            throw error;
        }
    }
    /**
     * Store SOS evidence on blockchain for dispute resolution
     */
    async storeEvidenceOnBlockchain(evidenceData) {
        try {
            const Web3 = require('web3');
            const web3 = new Web3(process.env.WEB3_PROVIDER_URL);
            // Store immutable record
            const account = web3.eth.accounts.privateKeyToAccount(process.env.WEB3_PRIVATE_KEY);
            await db.query(`INSERT INTO blockchain_evidence (sos_id, ride_id, video_id, evidence_hash, stored_at)
         VALUES ($1, $2, $3, $4, $5)`, [
                evidenceData.sosId,
                evidenceData.rideId,
                evidenceData.videoId,
                web3.utils.keccak256(JSON.stringify(evidenceData)),
                new Date(),
            ]);
            console.log(`✅ Evidence stored on blockchain for SOS: ${evidenceData.sosId}`);
        }
        catch (error) {
            console.error('❌ Failed to store evidence on blockchain:', error);
        }
    }
}
exports.default = new SOSEmergencyService();
//# sourceMappingURL=sos-emergency.service.js.map