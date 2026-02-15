/**
 * A lightweight logging utility to maintain visibility 
 * without the overhead of complex logging frameworks in the MVP stage.
 */
const scope = 'HASH-THIS-API';

const format = (level: string, message: string, meta?: any) => {
  const timestamp = new Date().toISOString();
  const metadata = meta ? ` | context: ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level.toUpperCase()} [${scope}]: ${message}${metadata}`;
};

export const logger = {
  info: (msg: string, meta?: any) => console.log(format('info', msg, meta)),
  warn: (msg: string, meta?: any) => console.warn(format('warn', msg, meta)),
  error: (msg: string, err?: any) => {
    // In production, we might want to pipe this to an external service
    console.error(format('error', msg, err instanceof Error ? err.message : err));
  },
  debug: (msg: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(format('debug', msg, meta));
    }
  }
};