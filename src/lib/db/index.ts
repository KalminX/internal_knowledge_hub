import { IDatabaseStore } from './types';
import { MemoryDatabaseStore } from './memory-store';
import { SupabaseDatabaseStore } from './supabase-store';

declare global {
  // eslint-disable-next-line no-var
  var __dbStoreInstance: IDatabaseStore | undefined;
}

export function getDatabaseStore(): IDatabaseStore {
  if (global.__dbStoreInstance) {
    return global.__dbStoreInstance;
  }

  const appMode = process.env.NEXT_PUBLIC_APP_MODE || 'local';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (appMode === 'supabase' && supabaseUrl && serviceKey) {
    global.__dbStoreInstance = new SupabaseDatabaseStore(supabaseUrl, serviceKey);
  } else {
    global.__dbStoreInstance = new MemoryDatabaseStore();
  }

  return global.__dbStoreInstance;
}

export const db = getDatabaseStore();
