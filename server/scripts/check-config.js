import 'dotenv/config';
import { validateEnvironment } from '../config/environment.js';
try { validateEnvironment(); console.log('Server configuration is valid. Secret values were not printed.'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
