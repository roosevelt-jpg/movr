declare class VideoRecordingService {
    private s3;
    private web3;
    private blockchainContract;
    constructor();
    private initializeBlockchain;
    /**
     * Initialize video recording for a trip
     * Called when driver starts the ride
     */
    startRecording(rideId: string, driverId: string, customerId: string, pickupLocation: any): Promise<{
        recordingId: any;
        status: string;
    }>;
    /**
     * End recording and upload to blockchain
     * Called when ride completes
     */
    stopRecording(rideId: string, driverId: string, dropoffLocation: any): Promise<{
        status: string;
        duration: number;
    }>;
    /**
     * Upload video to S3 and blockchain
     * Called after ride completion
     */
    uploadVideoToBlockchain(rideId: string, videoBuffer: Buffer, metadata: any): Promise<{
        status: string;
        s3Url: string;
        ipfsHash: string;
        blockchainHash: string;
        duration: any;
    }>;
    /**
     * Upload video to IPFS for decentralized storage
     */
    private uploadToIPFS;
    /**
     * Store immutable record on blockchain
     */
    private storeOnBlockchain;
    /**
     * Get video evidence for dispute resolution
     */
    getVideoEvidence(rideId: string): Promise<{
        rideId: string;
        driverId: any;
        customerId: any;
        startTime: any;
        endTime: any;
        duration: any;
        s3Url: any;
        ipfsHash: any;
        blockchainHash: any;
        blockchainVerified: boolean;
        status: any;
    }>;
}
declare const _default: VideoRecordingService;
export default _default;
//# sourceMappingURL=video-recording.service.d.ts.map