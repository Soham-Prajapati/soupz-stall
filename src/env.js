import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const result = dotenv.config({ 
  path: join(__dirname, '../.env'),
  override: true 
});
if (result.error) {
  console.error('Failed to load .env:', result.error);
} else {
  console.error('ENV loaded:', 
    Object.keys(result.parsed || {}).length, 'vars');
}
