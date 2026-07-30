"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/services/video-recording.service.ts
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const uuid_1 = require("uuid");
const web3_1 = __importDefault(require("web3"));
class VideoRecordingService {
    constructor() {
        this.s3 = new aws_sdk_1.default.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1',
        });
        this.web3 = new web3_1.default(process.env.WEB3_PROVIDER_URL);
        // Initialize smart contract for video storage
        this.initializeBlockchain();
    }
    initializeBlockchain() {
        // Smart contract for video evidence storage
        const contractABI = [
            {
                name: 'storeVideoEvidence',
                inputs: [
                    { name: 'rideId', type: 'string' },
                    { name: 'ipfsHash', type: 'string' },
                    { name: 'driverId', type: 'address' },
                    { name: 'customerId', type: 'address' },
                    { name: 'timestamp', type: 'uint256' },
                ],
                outputs: [{ name: 'evidenceId', type: 'bytes32' }],
            },
        ];
        this.blockchainContract = new this.web3.eth.Contract(contractABI, process.env.VIDEO_STORAGE_CONTRACT_ADDRESS);
    }
    /**
     * Initialize video recording for a trip
     * Called when driver starts the ride
     */
    async startRecording(rideId, driverId, customerId, pickupLocation) {
        try {
            const recordingId = (0, uuid_1.v4)();
            const startTime = new Date();
            // Create recording metadata in database
            const recording = {
                rideId,
                driverId,
                customerId,
                startTime,
                pickupLocation,
                duration: 0,
                fileSize: 0,
                s3Url: '',
                blockchainHash: '',
                ipfsHash: '',
                status: 'recording',
            };
            // Store in database
            await db.query(`INSERT INTO video_recordings (id, ride_id, driver_id, customer_id, start_time, pickup_location, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [recordingId, rideId, driverId, customerId, startTime, JSON.stringify(pickupLocation), 'recording']);
            // Emit WebSocket event to driver's phone to start recording
            io.to(`driver_${driverId}`).emit('START_RECORDING', {
                recordingId,
                rideId,
                quality: 'high', // 1080p
                orientation: 'landscape', // Face passenger
                includeAudio: true,
            });
            console.log(`✅ Video recording started for ride ${rideId}`);
            return { recordingId, status: 'recording_started' };
        }
        catch (error) {
            console.error('❌ Error starting video recording:', error);
            throw error;
        }
    }
    /**
     * End recording and upload to blockchain
     * Called when ride completes
     */
    async stopRecording(rideId, driverId, dropoffLocation) {
        try {
            const recording = await db.query('SELECT * FROM video_recordings WHERE ride_id = $1', [rideId]);
            if (!recording.rows[0])
                throw new Error('Recording not found');
            const rec = recording.rows[0];
            const endTime = new Date();
            const duration = (endTime.getTime() - new Date(rec.start_time).getTime()) / 1000;
            // Emit stop recording to driver's phone
            io.to(`driver_${driverId}`).emit('STOP_RECORDING', {
                rideId,
                dropoffLocation,
            });
            // Update recording status
            await db.query(`UPDATE video_recordings 
         SET end_time = $1, duration = $2, dropoff_location = $3, status = $4
         WHERE ride_id = $5`, [endTime, duration, JSON.stringify(dropoffLocation), 'processing', rideId]);
            console.log(`✅ Video recording stopped for ride ${rideId}, duration: ${duration}s`);
            return { status: 'recording_stopped', duration };
        }
        catch (error) {
            console.error('❌ Error stopping video recording:', error);
            throw error;
        }
    }
    /**
     * Upload video to S3 and blockchain
     * Called after ride completion
     */
    async uploadVideoToBlockchain(rideId, videoBuffer, metadata) {
        try {
            // Upload to AWS S3
            const s3Key = `movr-trip-recordings/${rideId}/${(0, uuid_1.v4)()}.mp4`;
            const s3Params = {
                Bucket: process.env.AWS_S3_BUCKET || 'movr-recordings',
                Key: s3Key,
                Body: videoBuffer,
                ContentType: 'video/mp4',
                ServerSideEncryption: 'AES256',
                StorageClass: 'STANDARD_IA', // Cost-effective
                Metadata: {
                    rideId,
                    driverId: metadata.driverId,
                    customerId: metadata.customerId,
                    timestamp: new Date().toISOString(),
                },
            };
            const s3Response = await this.s3.upload(s3Params).promise();
            const s3Url = s3Response.Location;
            console.log(`✅ Video uploaded to S3: ${s3Url}`);
            // Upload to IPFS (decentralized storage)
            const ipfsHash = await this.uploadToIPFS(videoBuffer);
            // Store on blockchain (immutable record)
            const blockchainHash = await this.storeOnBlockchain(rideId, ipfsHash, metadata.driverId, metadata.customerId);
            // Update database with blockchain references
            await db.query(`UPDATE video_recordings 
         SET s3_url = $1, ipfs_hash = $2, blockchain_hash = $3, status = $4
         WHERE ride_id = $5`, [s3Url, ipfsHash, blockchainHash, 'stored', rideId]);
            return {
                status: 'video_stored',
                s3Url,
                ipfsHash,
                blockchainHash,
                duration: metadata.duration,
            };
        }
        catch (error) {
            console.error('❌ Error uploading video to blockchain:', error);
            throw error;
        }
    }
    /**
     * Upload video to IPFS for decentralized storage
     */
    async uploadToIPFS(videoBuffer) {
        try {
            // Use Pinata or similar IPFS service
            const FormData = require('form-data');
            const axios = require('axios');
            const formData = new FormData();
            formData.append('file', videoBuffer, 'trip-recording.mp4');
            const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
                headers: {
                    ...formData.getHeaders(),
                    pinata_api_key: process.env.PINATA_API_KEY,
                    pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
                },
            });
            return response.data.IpfsHash;
        }
        catch (error) {
            console.error('❌ IPFS upload failed:', error);
            throw error;
        }
    }
    /**
     * Store immutable record on blockchain
     */
    async storeOnBlockchain(rideId, ipfsHash, driverId, customerId) {
        try {
            const account = this.web3.eth.accounts.privateKeyToAccount(process.env.WEB3_PRIVATE_KEY || '');
            const tx = this.blockchainContract.methods.storeVideoEvidence(rideId, ipfsHash, driverId, customerId, Math.floor(Date.now() / 1000));
            const gas = await tx.estimateGas({ from: account.address });
            const gasPrice = await this.web3.eth.getGasPrice();
            const transaction = {
                from: account.address,
                to: process.env.VIDEO_STORAGE_CONTRACT_ADDRESS,
                gas,
                gasPrice,
                data: tx.encodeABI(),
            };
            const signed = account.signTransaction(transaction);
            const receipt = await this.web3.eth.sendSignedTransaction(signed.rawTransaction);
            console.log(`✅ Video stored on blockchain: ${receipt.transactionHash}`);
            return receipt.transactionHash;
        }
        catch (error) {
            console.error('❌ Blockchain storage failed:', error);
            throw error;
        }
    }
    /**
     * Get video evidence for dispute resolution
     */
    async getVideoEvidence(rideId) {
        try {
            const recording = await db.query(`SELECT * FROM video_recordings WHERE ride_id = $1`, [rideId]);
            if (!recording.rows[0])
                throw new Error('Recording not found');
            const rec = recording.rows[0];
            // Verify blockchain integrity
            const blockchainData = await this.blockchainContract.methods
                .getVideoEvidence(rideId)
                .call();
            return {
                rideId,
                driverId: rec.driver_id,
                customerId: rec.customer_id,
                startTime: rec.start_time,
                endTime: rec.end_time,
                duration: rec.duration,
                s3Url: rec.s3_url,
                ipfsHash: rec.ipfs_hash,
                blockchainHash: rec.blockchain_hash,
                blockchainVerified: blockchainData.ipfsHash === rec.ipfs_hash,
                status: rec.status,
            };
        }
        catch (error) {
            console.error('❌ Error retrieving video evidence:', error);
            throw error;
        }
    }
}
exports.default = new VideoRecordingService();
//# sourceMappingURL=video-recording.service.js.map