// src/lib/database.ts
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export { pool };

export class DatabaseClient {
  static async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] || null;
  }

  static async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  static async getConnectionInfo(): Promise<any> {
    return await this.queryOne(`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        now() as current_time
    `);
  }
}

export async function testDatabaseConnection(): Promise<{
  success: boolean;
  info?: any;
  error?: string;
}> {
  try {
    const isHealthy = await DatabaseClient.healthCheck();
    if (!isHealthy) {
      return { success: false, error: 'Health check failed' };
    }

    const info = await DatabaseClient.getConnectionInfo();
    return { success: true, info };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
