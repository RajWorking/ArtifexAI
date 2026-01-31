export type SiemType = "splunk";

export type SiemConnectRequest = {
  siemType: "splunk";
  baseUrl: string;
  token: string;
  verifySSL: boolean;
};

export type SiemConnectResponse = {
  ok: boolean;
  siemType: "splunk";
  details?: {
    serverName?: string;
    version?: string;
  };
  error?: {
    message: string;
    code?: string;
  };
};

export type AuditRunResponse = {
  ok: boolean;
  auditId: string;
  status: "todo";
  message: string;
};

export type AuditStatusResponse = {
  ok: boolean;
  auditId: string;
  status: "todo";
  message: string;
};

export type AuditReportResponse = {
  ok: boolean;
  auditId: string;
  status: "todo";
  message: string;
};
