import * as fs from 'fs';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const USER_COUNT = 100;

interface LoginResponse {
  accessToken: string;
}

async function loginUser(userId: number): Promise<string> {
  try {
    const response = await axios.post<LoginResponse>(`${BASE_URL}/user/login`, {
      email: `dummy${userId}@example.com`,
      password: '1234',
    });

    return response.data.accessToken;
  } catch (error) {
    console.error(`Failed to login user ${userId}:`, error.message);
    return '';
  }
}

async function generateTokens() {
  console.log(`Generating tokens for ${USER_COUNT} users...`);

  const csvLines: string[] = [];

  for (let i = 1; i <= 100; i++) {
    const token = await loginUser(i);
    if (token) {
      csvLines.push(`${i},${token}`);
      console.log(`✅ User ${i}: Token generated`);
    } else {
      console.log(`❌ User ${i}: Failed to generate token`);
    }
  }

  fs.writeFileSync('users.csv', csvLines.join('\n'));
  console.log(`\n✅ Generated ${csvLines.length} tokens in users.csv`);
}

generateTokens();
