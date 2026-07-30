declare class SOSEmergencyService {
    private twilioClient;
    constructor();
    /**
     * Handle SOS emergency button press
     * Connects to live video recording and security personnel
     */
    triggerSOS(rideId: string, driverId: string, customerId: string, sosType: 'driver' | 'customer', location: {
        lat: number;
        lng: number;
    }): Promise<{
        sosId: any;
        status: string;
        videoStreamUrl: string;
        personnelNotified: any;
    }>;
    /**
     * Send emergency alert to security personnel
     */
    private sendEmergencyAlert;
    /**
     * Notify emergency contacts of driver/customer
     */
    private notifyEmergencyContacts;
    /**
     * Create live video stream for emergency responders
     */
    private createEmergencyVideoStream;
    /**
     * Resolve SOS and store evidence
     */
    resolveSOS(sosId: string, resolvedBy: string, resolution: string, notes: string): Promise<{
        sosId: string;
        status: string;
        resolution: string;
        evidenceStoredOnBlockchain: boolean;
    }>;
    /**
     * Store SOS evidence on blockchain for dispute resolution
     */
    private storeEvidenceOnBlockchain;
}
declare const _default: SOSEmergencyService;
export default _default;
//# sourceMappingURL=sos-emergency.service.d.ts.map