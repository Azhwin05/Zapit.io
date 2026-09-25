import pino from 'pino';

// pino-pretty is optional (devDependency); if absent fall back to plain JSON.
let transport: pino.TransportSingleOptions | undefined;
if (process.env.NODE_ENV !== 'production') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('pino-pretty');
    transport = { target: 'pino-pretty', options: { colorize: true } };
  } catch {
    // not installed — JSON fallback is fine
  }
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', transport });

export default logger;
