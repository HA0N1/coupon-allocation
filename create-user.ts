import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function createUsers() {
  for (let i = 258; i <= 300; i++) {
    try {
      await axios.post(`${BASE_URL}/user/register`, {
        email: `dummy${i}@example.com`,
        password: '1234',
      });
      console.log(`✅ User ${i} created`);
    } catch (error) {
      console.log(`❌ User ${i} failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

createUsers();
