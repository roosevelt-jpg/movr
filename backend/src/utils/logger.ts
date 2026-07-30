import { createLogger, format, transports, Logger } from 'winston';

const loggers = new Map<string, Logger>();

export function getLogger(service = 'movr') {
  if (loggers.has(service)) return loggers.get(service)!;

  const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service },
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json()
    ),
    transports: [
      new transports.Console({
        format:
          process.env.NODE_ENV === 'production'
            ? format.json()
            : format.combine(format.colorize(), format.simple()),
      }),
    ],
  });

  loggers.set(service, logger);
  return logger;
}

export default getLogger;
