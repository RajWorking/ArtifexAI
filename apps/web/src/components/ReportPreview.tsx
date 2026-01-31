import React, { useState } from "react";
import { Header } from "./Header";
import { SeverityBadge } from "./SeverityBadge";
import { RiskLevelBadge } from "./RiskLevelBadge";
import { Button } from "./ui/button";
import { Download, FileText } from "lucide-react";

interface TocItem {
  id: string;
  label: string;
  level: number;
}

const tableOfContents: TocItem[] = [
  { id: "executive-summary", label: "Executive Summary", level: 1 },
  { id: "methodology", label: "Methodology", level: 1 },
  { id: "scope", label: "Scope & Coverage", level: 1 },
  { id: "findings", label: "Findings", level: 1 },
  { id: "finding-1", label: "F001: Unauthorized Privileged Account Usage", level: 2 },
  { id: "finding-2", label: "F002: Unpatched Critical Vulnerabilities", level: 2 },
  { id: "finding-3", label: "F003: Weak Password Policy Implementation", level: 2 },
  { id: "finding-4", label: "F004: Insufficient Logging Coverage", level: 2 },
  { id: "finding-5", label: "F005: Excessive Service Account Permissions", level: 2 },
  { id: "recommendations", label: "Recommendations", level: 1 },
  { id: "appendix", label: "Appendix", level: 1 },
  { id: "queries", label: "Query Log", level: 2 },
  { id: "evidence", label: "Evidence Archive", level: 2 },
];

export function ReportPreview() {
  const [activeSection, setActiveSection] = useState("executive-summary");

  const handleDownload = (format: string) => {
    console.log(`Downloading report as ${format}`);
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1440px] mx-auto px-8 py-8">
        <div className="flex gap-6">
          {/* Table of Contents Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm sticky top-8">
              <div className="px-4 py-4 border-b border-gray-200">
                <h3 className="text-sm text-gray-900">Table of Contents</h3>
              </div>
              <nav className="px-2 py-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                {tableOfContents.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      item.level === 2 ? "pl-6" : ""
                    } ${
                      activeSection === item.id
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Report Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              {/* Report Header */}
              <div className="px-8 py-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-gray-900 mb-2">Cybersecurity Due Diligence Report</h1>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>Report ID: ADT-2025-001</span>
                      <span>•</span>
                      <span>Generated: January 30, 2025</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleDownload("pdf")} variant="outline" size="sm" className="gap-2">
                      <FileText className="w-4 h-4" />
                      PDF
                    </Button>
                    <Button onClick={() => handleDownload("html")} variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      HTML
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-6 pt-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Target Organization</div>
                    <div className="text-gray-900">Target Corp</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Audit Period</div>
                    <div className="text-gray-900">August 3, 2024 - January 30, 2025</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Overall Risk</div>
                    <RiskLevelBadge level="medium" />
                  </div>
                </div>
              </div>

              {/* Report Body */}
              <div className="px-8 py-6 space-y-8 max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* Executive Summary */}
                <section id="executive-summary">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Executive Summary
                  </h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>
                      This report presents the findings of an automated cybersecurity due diligence assessment conducted on Target Corp's IT infrastructure using SIEM data analysis. The audit examined security events, configurations, and threat indicators across the period of August 3, 2024 through January 30, 2025 (180 days).
                    </p>
                    <p>
                      The assessment identified <strong>5 distinct security findings</strong> with varying severity levels. Two findings are classified as high severity and require immediate remediation. The overall risk level is assessed as <strong>Medium</strong>, indicating that while no active breaches were detected, significant vulnerabilities exist that could be exploited by threat actors.
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
                      <h4 className="text-gray-900 mb-3">Key Metrics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Total Findings</div>
                          <div className="text-2xl text-gray-900 mt-1">5</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Evidence Collected</div>
                          <div className="text-2xl text-gray-900 mt-1">217</div>
                        </div>
                        <div>
                          <div className="text-gray-600">High Severity Issues</div>
                          <div className="text-2xl text-orange-600 mt-1">2</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Confidence Score</div>
                          <div className="text-2xl text-gray-900 mt-1">89%</div>
                        </div>
                      </div>
                    </div>
                    <p>
                      The most critical concerns involve unauthorized privileged account usage patterns indicative of potential compromise, and multiple unpatched vulnerabilities on internet-facing web servers. Additional findings relate to password policy weaknesses, logging gaps, and excessive service account privileges.
                    </p>
                  </div>
                </section>

                {/* Methodology */}
                <section id="methodology">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Methodology
                  </h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>
                      This audit employed an automated analysis framework leveraging threat hunting queries, behavioral analytics, and configuration assessments against SIEM data. The methodology follows industry-standard due diligence practices and incorporates MITRE ATT&CK framework mappings.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h4 className="text-gray-900">Analysis Phases</h4>
                      <ol className="space-y-2 text-sm list-decimal list-inside">
                        <li><strong>Coverage Assessment:</strong> Validated SIEM data completeness and quality across critical asset categories</li>
                        <li><strong>Hunt Selection:</strong> Applied 47 threat hunting queries targeting common attack patterns and misconfigurations</li>
                        <li><strong>Evidence Collection:</strong> Gathered supporting log evidence, event details, and contextual information</li>
                        <li><strong>Risk Analysis:</strong> Evaluated severity, confidence, and business impact for each finding</li>
                        <li><strong>Recommendation Development:</strong> Generated remediation guidance based on security best practices</li>
                      </ol>
                    </div>
                    <p>
                      All queries executed with read-only access credentials. No modifications were made to production systems or data.
                    </p>
                  </div>
                </section>

                {/* Scope & Coverage */}
                <section id="scope">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Scope & Coverage
                  </h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>
                      The audit scope encompassed all systems forwarding logs to the Splunk SIEM instance during the 180-day assessment period.
                    </p>
                    <div className="grid grid-cols-2 gap-4 my-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-gray-900 mb-2 text-sm">Systems Analyzed</h4>
                        <ul className="space-y-1 text-sm">
                          <li>• 145 Windows servers</li>
                          <li>• 23 Linux servers</li>
                          <li>• 8 Domain controllers</li>
                          <li>• 12 Database servers</li>
                          <li>• 18 Web servers</li>
                          <li>• 1,247 endpoints</li>
                        </ul>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-gray-900 mb-2 text-sm">Data Sources</h4>
                        <ul className="space-y-1 text-sm">
                          <li>• Windows Event Logs</li>
                          <li>• Authentication logs</li>
                          <li>• Firewall logs</li>
                          <li>• Proxy logs</li>
                          <li>• VPN access logs</li>
                          <li>• Application logs</li>
                        </ul>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 italic">
                      Note: 3 critical application servers (APP-SRV-01, APP-SRV-02, DB-SRV-01) showed logging gaps and are flagged in Finding F004.
                    </p>
                  </div>
                </section>

                {/* Findings */}
                <section id="findings">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Detailed Findings
                  </h2>
                  
                  {/* Finding 1 */}
                  <div id="finding-1" className="mb-8 scroll-mt-8">
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <h3 className="text-gray-900">F001: Unauthorized Privileged Account Usage</h3>
                        <SeverityBadge severity="high" />
                      </div>
                      
                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Description</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Multiple instances of privileged account usage detected outside of normal business hours and from unusual geographic locations. This pattern suggests potential compromise or unauthorized access to administrative accounts.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Affected Entities</h4>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">DC-01</span>
                          <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">DC-02</span>
                          <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">FILE-SRV-01</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Evidence Summary</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          <li>• 23 suspicious authentication events</li>
                          <li>• Confidence level: 92%</li>
                          <li>• Timeline: January 15-18, 2025</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Recommendation</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Immediately reset credentials for affected privileged accounts. Implement stricter conditional access policies requiring MFA for administrative access. Review and restrict privileged account usage to dedicated admin workstations only.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Finding 2 */}
                  <div id="finding-2" className="mb-8 scroll-mt-8">
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <h3 className="text-gray-900">F002: Unpatched Critical Vulnerabilities</h3>
                        <SeverityBadge severity="high" />
                      </div>
                      
                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Description</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Multiple production web servers are running outdated software versions with known critical CVEs. These vulnerabilities are actively being exploited in the wild.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Affected Entities</h4>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">WEB-SRV-03</span>
                          <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">WEB-SRV-04</span>
                          <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">WEB-SRV-05</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Evidence Summary</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          <li>• 18 critical CVEs identified</li>
                          <li>• Confidence level: 95%</li>
                          <li>• Includes known RCE vulnerabilities</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm text-gray-700 mb-2">Recommendation</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Apply security patches immediately to all affected systems. Implement automated patch management and vulnerability scanning on a regular schedule. Consider implementing a WAF as an interim control.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Additional findings abbreviated for space */}
                  <div className="text-sm text-gray-500 italic py-4">
                    [Additional findings F003-F005 follow the same detailed format...]
                  </div>
                </section>

                {/* Recommendations */}
                <section id="recommendations">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Priority Recommendations
                  </h2>
                  <div className="space-y-6 text-gray-700 leading-relaxed">
                    <div>
                      <h3 className="text-gray-900 mb-2">Immediate Actions (0-30 days)</h3>
                      <ol className="space-y-2 text-sm list-decimal list-inside">
                        <li>Reset credentials for all privileged accounts flagged in Finding F001</li>
                        <li>Apply security patches to web servers (Finding F002)</li>
                        <li>Enable MFA for all administrative accounts</li>
                        <li>Configure log forwarding on systems with coverage gaps</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-gray-900 mb-2">Short-term Actions (30-90 days)</h3>
                      <ol className="space-y-2 text-sm list-decimal list-inside">
                        <li>Update Group Policy to enforce stronger password requirements</li>
                        <li>Review and reduce service account privileges</li>
                        <li>Implement automated vulnerability scanning</li>
                        <li>Deploy SIEM monitoring alerts for critical events</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-gray-900 mb-2">Long-term Initiatives (90+ days)</h3>
                      <ol className="space-y-2 text-sm list-decimal list-inside">
                        <li>Implement zero-trust architecture for privileged access</li>
                        <li>Deploy automated patch management solution</li>
                        <li>Establish regular security audit cadence</li>
                        <li>Develop incident response playbooks for identified risks</li>
                      </ol>
                    </div>
                  </div>
                </section>

                {/* Appendix */}
                <section id="appendix">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Appendix
                  </h2>
                  
                  <div id="queries" className="mb-6">
                    <h3 className="text-gray-900 mb-3">Query Log</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      47 threat hunting queries were executed during this audit. Below is a sample:
                    </p>
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-2">
                      <div>index=windows EventCode=4624 Account_Type=Admin | where hour &gt;= 22 OR hour &lt;= 6</div>
                      <div>index=vulnerability severity=critical status=open</div>
                      <div>index=ad EventCode=4723 | eval days_since_change=now()-password_last_set</div>
                      <div className="text-gray-500">[Full query log available in attached archive]</div>
                    </div>
                  </div>

                  <div id="evidence">
                    <h3 className="text-gray-900 mb-3">Evidence Archive</h3>
                    <p className="text-sm text-gray-600">
                      All supporting evidence including raw log entries, event details, and contextual data has been compiled in a separate evidence archive. This archive includes 217 distinct evidence items organized by finding ID.
                    </p>
                  </div>
                </section>
              </div>

              {/* Report Footer */}
              <div className="px-8 py-4 border-t border-gray-200 text-center text-sm text-gray-500">
                <p>Report generated by ArtifexAI | Confidential & Proprietary</p>
                <p className="mt-1">Page 1 of 23</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}