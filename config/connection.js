import { Client } from "pg";

const client = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

const connectToDb = async () => {
  try {
    await client.connect();
    const result = await client.query("SELECT NOW() as current_time");

    console.log(`connected to database : ${result.rows[0].current_time}`);
  } catch (error) {
    console.log(error);
  }
};

export { client, connectToDb };
