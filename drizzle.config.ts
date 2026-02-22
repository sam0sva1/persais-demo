import { config } from 'dotenv';
import { createDrizzleConfig } from 'persais-core';
config();

export default createDrizzleConfig();
