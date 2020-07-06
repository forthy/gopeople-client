import * as dotenv from 'dotenv';

dotenv.config();

const goPeopleHost = process.env.GOPEOPLE_ENV;
const goPeopleKey = process.env.GOPEOPLE_KEY;

export { goPeopleHost, goPeopleKey };
