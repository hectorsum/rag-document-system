import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws') as typeof WebSocket;

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;
  readonly bucket: string;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.get<string>('SUPABASE_URL', ''),
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
      { realtime: { transport: ws } },
    );
    this.bucket = config.get<string>('SUPABASE_STORAGE_BUCKET', 'documents');
  }
}
