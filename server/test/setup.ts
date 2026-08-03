process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./prisma-test.db';
process.env.APP_ORIGIN = 'http://127.0.0.1:5173';
process.env.SESSION_SECRET = 'test-session-secret-1234567890';
process.env.ENABLE_DEV_PASSWORD_RESET_CODES = 'true';
process.env.PORT = '3100';
