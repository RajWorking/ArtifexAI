export type SplunkConnectRequest = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
};

export type SplunkConnectResponse = {
  ok: boolean;
  tools: string[];
  details?: unknown;
  error: {
    message: string;
    code?: string;
  } | null;
};

export type SplunkQueryRequest = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  spl: string;
  timeoutMs?: number;
};

export type SplunkQueryResponse = {
  ok: boolean;
  toolUsed: string | null;
  result?: unknown;
  error: {
    message: string;
    code?: string;
  } | null;
};
