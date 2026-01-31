import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import { RiskLevelBadge } from "./RiskLevelBadge";
import { SeverityBadge } from "./SeverityBadge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { FileText, Download } from "lucide-react";
import { Badge } from "./ui/badge";

interface Finding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  affectedEntities: string[];
  evidenceCount: number;
  confidence: number;
  description: string;
  evidence: string[];
  queries: string[];
  recommendation: string;
}

const mockFindings: Finding[] = [
  {
    id: "F001",
    severity: "high",
    title: "Unauthorized Privileged Account Usage",
    affectedEntities: ["DC-01", "DC-02", "FILE-SRV-01"],
    evidenceCount: 23,
    confidence: 92,
    description: "Multiple instances of privileged account usage detected outside of normal business hours and from unusual geographic locations. This pattern suggests potential compromise or unauthorized access to administrative accounts.",
    evidence: [
      "2025-01-15 02:34:12 - Admin account 'DA_ADMIN' logged in from IP 185.220.101.42 (TOR exit node)",
      "2025-01-15 02:35:48 - Lateral movement detected: DC-01 → FILE-SRV-01",
      "2025-01-15 02:37:23 - Sensitive file access: /shares/executive/financial_reports/",
    ],
    queries: [
      "index=windows EventCode=4624 Account_Type=Admin | where hour >= 22 OR hour <= 6",
      "index=windows EventCode=4648 | stats count by Source_Host Destination_Host",
    ],
    recommendation: "Immediately reset credentials for affected privileged accounts. Implement stricter conditional access policies requiring MFA for administrative access. Review and restrict privileged account usage to dedicated admin workstations only.",
  },
  {
    id: "F002",
    severity: "high",
    title: "Unpatched Critical Vulnerabilities",
    affectedEntities: ["WEB-SRV-03", "WEB-SRV-04", "WEB-SRV-05"],
    evidenceCount: 18,
    confidence: 95,
    description: "Multiple production web servers are running outdated software versions with known critical CVEs. These vulnerabilities are actively being exploited in the wild.",
    evidence: [
      "WEB-SRV-03: Apache 2.4.49 (CVE-2021-41773 - Path Traversal RCE)",
      "WEB-SRV-04: Apache 2.4.49 (CVE-2021-41773 - Path Traversal RCE)",
      "WEB-SRV-05: OpenSSL 1.1.1k (CVE-2021-3450 - Certificate validation bypass)",
    ],
    queries: [
      "index=vulnerability severity=critical status=open",
      "index=assets | where version < required_version",
    ],
    recommendation: "Apply security patches immediately to all affected systems. Implement automated patch management and vulnerability scanning on a regular schedule. Consider implementing a WAF as an interim control.",
  },
  {
    id: "F003",
    severity: "medium",
    title: "Weak Password Policy Implementation",
    affectedEntities: ["domain.local", "legacy-app.local"],
    evidenceCount: 156,
    confidence: 88,
    description: "Password policies do not meet current security best practices. Multiple user accounts have passwords that do not meet complexity requirements or have not been changed in over 12 months.",
    evidence: [
      "142 user accounts with passwords older than 365 days",
      "14 accounts using common passwords detected in breach databases",
      "Password complexity requirements: 8 chars minimum (recommended: 12+)",
    ],
    queries: [
      "index=ad EventCode=4723 | eval days_since_change=now()-password_last_set",
      "index=authentication failed_attempts > 5 | stats count by username",
    ],
    recommendation: "Update Group Policy to enforce minimum 12-character passwords with complexity requirements. Implement password expiration policies and integrate with Have I Been Pwned API to block compromised passwords. Enable MFA for all user accounts.",
  },
  {
    id: "F004",
    severity: "medium",
    title: "Insufficient Logging Coverage",
    affectedEntities: ["APP-SRV-01", "APP-SRV-02", "DB-SRV-01"],
    evidenceCount: 8,
    confidence: 91,
    description: "Several critical systems are not forwarding logs to the central SIEM, creating blind spots in security monitoring capabilities.",
    evidence: [
      "APP-SRV-01: No logs received in past 72 hours",
      "APP-SRV-02: Partial logging - authentication events only",
      "DB-SRV-01: Database audit logs not configured",
    ],
    queries: [
      "| metadata type=hosts | where lastTime < relative_time(now(), '-3d')",
      "index=* | stats dc(sourcetype) by host",
    ],
    recommendation: "Configure log forwarding on all identified systems. Enable database audit logging with focus on privileged operations and data access. Implement monitoring alerts for log collection gaps.",
  },
  {
    id: "F005",
    severity: "low",
    title: "Excessive Service Account Permissions",
    affectedEntities: ["SVC_BACKUP", "SVC_MONITORING", "SVC_APP1"],
    evidenceCount: 12,
    confidence: 85,
    description: "Service accounts have been granted broader permissions than necessary for their intended functions, violating the principle of least privilege.",
    evidence: [
      "SVC_BACKUP: Domain Admin privileges (only requires Backup Operator)",
      "SVC_MONITORING: Write access to production databases (read-only sufficient)",
      "SVC_APP1: Local admin on 45 servers (only needs access to 3)",
    ],
    queries: [
      "index=ad objectClass=user userAccountControl=SERVICE | lookup privileged_groups",
      "index=windows EventCode=4672 Account_Type=Service",
    ],
    recommendation: "Review and reduce permissions for all service accounts to minimum required levels. Implement regular access reviews quarterly. Consider implementing Managed Service Accounts (MSAs) where applicable.",
  },
];

export function AuditResults() {
  const navigate = useNavigate();
  const [selectedFinding, setSelectedFinding] = useState<Finding>(mockFindings[0]);

  const handleDownloadReport = () => {
    navigate("/report");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1440px] mx-auto px-8 py-8">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-gray-900 mb-2">Audit Results</h1>
              <p className="text-gray-600">
                Completed analysis of SIEM data from the last 180 days
              </p>
            </div>
            <Button onClick={handleDownloadReport} className="gap-2">
              <Download className="w-4 h-4" />
              Download Report
            </Button>
          </div>

          {/* Top Banner - Overview Stats */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-500 mb-2">Overall Risk Level</div>
                <RiskLevelBadge level="medium" />
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2">Total Findings</div>
                <div className="text-3xl text-gray-900">{mockFindings.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2">Confidence Score</div>
                <div className="text-3xl text-gray-900">89%</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2">Evidence Collected</div>
                <div className="text-3xl text-gray-900">217</div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-gray-900">Executive Summary</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700 leading-relaxed">
                The automated security audit identified <strong>5 findings</strong> across the target environment, including <strong>2 high-severity</strong> issues requiring immediate attention. The most critical concerns involve unauthorized privileged account usage and unpatched vulnerabilities on production web servers. While no active breaches were detected, the combination of weak access controls and outdated software creates significant risk exposure. Log coverage gaps on several critical systems limit visibility into potential security incidents. Overall, the security posture demonstrates typical enterprise challenges but requires prompt remediation of high-priority findings to reduce risk to acceptable levels.
              </p>
            </div>
          </div>

          {/* Main Content - Split View */}
          <div className="grid grid-cols-12 gap-6">
            {/* Findings Table */}
            <div className="col-span-7 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-gray-900">Findings</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Affected</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockFindings.map((finding) => (
                      <TableRow
                        key={finding.id}
                        className={`cursor-pointer ${
                          selectedFinding.id === finding.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => setSelectedFinding(finding)}
                      >
                        <TableCell>
                          <SeverityBadge severity={finding.severity} />
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate">{finding.title}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {finding.affectedEntities.length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {finding.evidenceCount}
                          </Badge>
                        </TableCell>
                        <TableCell>{finding.confidence}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Finding Details Panel */}
            <div className="col-span-5 bg-white rounded-lg border border-gray-200 shadow-sm sticky top-8 self-start">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-gray-900">Finding Details</h3>
              </div>
              <div className="px-6 py-4 space-y-6 max-h-[800px] overflow-y-auto">
                {/* Title and Severity */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-gray-900">{selectedFinding.title}</h4>
                    <SeverityBadge severity={selectedFinding.severity} />
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>ID: {selectedFinding.id}</span>
                    <span>•</span>
                    <span>Confidence: {selectedFinding.confidence}%</span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h5 className="text-sm text-gray-700 mb-2">Description</h5>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {selectedFinding.description}
                  </p>
                </div>

                {/* Affected Entities */}
                <div>
                  <h5 className="text-sm text-gray-700 mb-2">Affected Entities</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedFinding.affectedEntities.map((entity, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Evidence */}
                <div>
                  <h5 className="text-sm text-gray-700 mb-2">Evidence Snippets</h5>
                  <div className="space-y-2">
                    {selectedFinding.evidence.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-50 rounded p-3 text-xs font-mono text-gray-700"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Queries */}
                <div>
                  <h5 className="text-sm text-gray-700 mb-2">Queries Executed</h5>
                  <div className="space-y-2">
                    {selectedFinding.queries.map((query, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-900 rounded p-3 text-xs font-mono text-green-400"
                      >
                        {query}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation */}
                <div>
                  <h5 className="text-sm text-gray-700 mb-2">Recommendation</h5>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {selectedFinding.recommendation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
