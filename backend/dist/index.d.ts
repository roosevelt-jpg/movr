declare const path: any;
declare const express: any;
declare const helmet: any;
declare const cors: any;
declare const rateLimit: any;
declare const createServer: any;
declare const Server: any;
declare const winston: any;
declare const jwt: any;
declare const bcrypt: any;
declare const DatabaseService: any;
declare const authDb: any;
declare const randomUUID: any, createHash: any;
declare let Sentry: any;
type ExpressRequest = any;
type ExpressResponse = any;
type ExpressNextFunction = any;
type ExpressApp = any;
declare const logger: any;
declare const DEFAULT_CORS: string[];
declare const corsOrigins: string[];
declare const app: ExpressApp;
declare const server: any;
declare const io: any;
declare const limiter: any;
declare const paymentWebhooksRouter: any, adminPaymentProvidersRouter: any, paymentsRouter: any;
declare const adminIntegrationsRouter: any;
declare const walletRouter: any;
declare const adminPricingRouter: any, identityLinkRouter: any, walletTransferRouter: any, tripRecordingRouter: any;
declare const storesRouter: any, cartRouter: any, ordersRouter: any;
declare const merchantRouter: any;
declare const uploadsRouter: any, UPLOAD_ROOT: any, ASSETS_ROOT: any;
declare const LEGACY_UPLOADS_ROOT: any;
declare const categoriesRouter: any, adminCatalogRouter: any;
declare const kycRouter: any;
declare const pointsRouter: any;
declare const referralsRouter: any;
declare const deliveriesRouter: any;
declare const rideExperienceRouter: any, sosRouter: any, publicTripShareRouter: any;
declare const tokenRouter: any;
declare const stakingRouter: any, publicStakingRouter: any;
declare const publicLocalizeRouter: any;
declare const publicCmsRouter: any, adminCmsRouter: any;
declare const safetyRouter: any, activityRouter: any;
declare const customerExtrasRouter: any;
declare const driverRouter: any, subscriptionsRouter: any, rentalsRouter: any, adminOpsRouter: any, adminFinanceRouter: any, adminRewardsRouter: any, inboxRouter: any;
declare const publicVehicleTypesRouter: any;
declare const rideBookingRouter: any, voiceRouter: any, channelWebhooksRouter: any, adminVehicleRouter: any, adminChannelsRouter: any;
declare const startPlatformJobs: any;
interface AuthRequest extends ExpressRequest {
    user?: {
        id: string;
        email: string;
        userType: string;
    };
}
declare const authenticateToken: (req: AuthRequest, res: ExpressResponse, next: ExpressNextFunction) => any;
interface User {
    id: string;
    email: string;
    userType: 'customer' | 'driver' | 'merchant' | 'admin';
    phone: string;
    name: string;
    verified: boolean;
}
interface Ride {
    id: string;
    customerId: string;
    driverId?: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
    estimatedFare: number;
    actualFare?: number;
    rideType: string;
    createdAt: Date;
    completedAt?: Date;
}
declare const users: Map<string, User & {
    password?: string;
}>;
declare const rides: Map<string, Ride>;
declare const sessions: Map<string, {
    token: string;
    expires: number;
}>;
declare const services: {
    calculateFare: (distance: number, duration: number, rideType: string) => number;
    findNearbyDrivers: (lat: number, lng: number, count?: number) => User[];
    notifyDrivers: (drivers: User[], rideData: any) => void;
};
declare const otpStore: Map<string, {
    code: string;
    expires: number;
    userId?: string;
    purpose: "reset" | "signup";
}>;
declare function normalizeAuthIdentifier(raw: string): string;
declare function otpLookupKeys(raw: string): string[];
declare function hashOtp(code: string): any;
declare function persistOtp(opts: {
    identifier: string;
    code: string;
    purpose: 'reset' | 'signup';
    userId?: string;
}): Promise<{
    code: string;
    expires: number;
    userId: string | undefined;
    purpose: "reset" | "signup";
}>;
declare function findUserForPasswordReset(identifier: string): Promise<any>;
declare const notifPrefs: Map<string, Record<string, boolean>>;
declare const PORT: string | number;
declare function startServer(): Promise<void>;
//# sourceMappingURL=index.d.ts.map