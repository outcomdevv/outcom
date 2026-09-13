export interface DownstreamAdapter {
  getRecord(id: string): Promise<Record<string, unknown> | null>;
  getField(id: string, field: string): Promise<unknown>;
  getTags(id: string): Promise<string[] | null>;
  getStatus(id: string): Promise<string | null>;
}
