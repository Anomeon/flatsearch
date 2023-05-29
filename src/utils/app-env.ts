import dotenv from 'dotenv';

dotenv.config();

export const APP_ENV = {
  IS_HEADLESS: process.env.IS_HEADLESS === 'true'
}
