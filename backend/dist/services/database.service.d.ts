import { PoolClient } from 'pg';
interface QueryResult<T> {
    rows: T[];
    rowCount: number;
}
export declare class DatabaseService {
    private pool;
    private logger;
    constructor();
    connect(): Promise<void>;
    query<T = any>(text: string, values?: any[]): Promise<QueryResult<T>>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    createUser(data: any): Promise<QueryResult<any>>;
    getUserById(id: string): Promise<QueryResult<any>>;
    getUserByEmail(email: string): Promise<QueryResult<any>>;
    createRide(data: any): Promise<QueryResult<any>>;
    getRideById(id: string): Promise<QueryResult<any>>;
    updateRideStatus(rideId: string, status: string): Promise<QueryResult<any>>;
    createPayment(data: any): Promise<QueryResult<any>>;
    getPaymentByReference(referenceId: string): Promise<QueryResult<any>>;
    createStore(data: any): Promise<QueryResult<any>>;
    listStores(filters?: any): Promise<QueryResult<any>>;
    createSubscription(data: any): Promise<QueryResult<any>>;
    getActiveSubscription(userId: string): Promise<QueryResult<any>>;
    getWallet(userId: string): Promise<QueryResult<any>>;
    updateWalletBalance(userId: string, type: string, amount: number): Promise<QueryResult<any>>;
    getDriverStats(driverId: string): Promise<QueryResult<any>>;
    disconnect(): Promise<void>;
}
export {};
//# sourceMappingURL=database.service.d.ts.map