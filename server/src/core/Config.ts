export const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:8080'];
export const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1/recursive-voxels';
export const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8081;
