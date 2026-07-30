import 'dotenv/config';
import { Express } from 'express';
import { Server } from 'socket.io';
import winston from 'winston';
declare const logger: winston.Logger;
declare const app: Express;
declare const io: Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { app, io, logger };
//# sourceMappingURL=index-old.d.ts.map