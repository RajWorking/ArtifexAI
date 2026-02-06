import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Header } from "./Header";
import { SeverityBadge } from "./SeverityBadge";
import { RiskLevelBadge } from "./RiskLevelBadge";
import { Button } from "./ui/button";
import { Download, FileText, ArrowLeft } from "lucide-react";
import type { AuditResultsResponse, Finding } from "../lib/api";

interface TocItem {
  id: string;
  label: string;
  level: number;
}

function buildTableOfContents(findings: Finding[]): TocItem[] {
  const toc: TocItem[] = [
    { id: "executive-summary", label: "Executive Summary", level: 1 },
    { id: "methodology", label: "Methodology", level: 1 },
    { id: "scope", label: "Scope & Coverage", level: 1 },
    { id: "findings", label: "Findings", level: 1 },
  ];

  findings.forEach((f, idx) => {
    toc.push({
      id: `finding-${idx + 1}`,
      label: `${f.id}: ${f.title}`,
      level: 2,
    });
  });

  toc.push(
    { id: "recommendations", label: "Recommendations", level: 1 },
    { id: "appendix", label: "Appendix", level: 1 },
    { id: "queries", label: "Query Log", level: 2 },
    { id: "evidence", label: "Evidence Archive", level: 2 },
  );

  return toc;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ReportPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { auditId?: string; results?: AuditResultsResponse } | null;
  const auditId = state?.auditId;
  const results = state?.results;

  const [activeSection, setActiveSection] = useState("executive-summary");

  if (!results || !results.findings) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-[1440px] mx-auto px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-6 py-4">
            <p className="font-medium text-yellow-800 mb-1">No report data available</p>
            <p className="text-sm text-yellow-700 mb-4">
              Navigate here from the Audit Results page to generate a report.
            </p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const { findings, stats, summary } = results;
  const today = formatDate(new Date());
  const allQueries = findings.flatMap((f) => f.queries);
  const uniqueQueries = [...new Set(allQueries)];

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;

  const tableOfContents = buildTableOfContents(findings);

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
                      {auditId && <span>Audit: {auditId}</span>}
                      <span>•</span>
                      <span>Generated: {today}</span>
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
                    <div className="text-sm text-gray-500 mb-1">Generated</div>
                    <div className="text-gray-900">{today}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Overall Risk</div>
                    <RiskLevelBadge level={stats.riskLevel} />
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
                    <p>{summary}</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
                      <h4 className="text-gray-900 mb-3">Key Metrics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Total Findings</div>
                          <div className="text-2xl text-gray-900 mt-1">{stats.totalFindings}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Evidence Collected</div>
                          <div className="text-2xl text-gray-900 mt-1">{stats.evidenceCount}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Severity Breakdown</div>
                          <div className="mt-1 flex gap-2 flex-wrap">
                            {criticalCount > 0 && <span className="text-sm text-red-900">{criticalCount} Critical</span>}
                            {highCount > 0 && <span className="text-sm text-orange-700">{highCount} High</span>}
                            {mediumCount > 0 && <span className="text-sm text-yellow-700">{mediumCount} Medium</span>}
                            {lowCount > 0 && <span className="text-sm text-blue-700">{lowCount} Low</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Avg Confidence Score</div>
                          <div className="text-2xl text-gray-900 mt-1">{stats.avgConfidence}%</div>
                        </div>
                      </div>
                    </div>
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
                        <li><strong>Hunt Selection:</strong> Applied threat hunting queries targeting common attack patterns and misconfigurations</li>
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
                      The audit scope encompassed all systems forwarding logs to the SIEM instance during the assessment period.
                      A total of {uniqueQueries.length} unique queries were executed across {findings.length} threat hunting playbooks.
                    </p>
                  </div>
                </section>

                {/* Findings */}
                <section id="findings">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Detailed Findings
                  </h2>

                  {findings.length === 0 && (
                    <p className="text-gray-500 italic py-4">No findings were identified during this audit.</p>
                  )}

                  {findings.map((finding, idx) => (
                    <div key={finding.id} id={`finding-${idx + 1}`} className="mb-8 scroll-mt-8">
                      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <h3 className="text-gray-900">{finding.id}: {finding.title}</h3>
                          <SeverityBadge severity={finding.severity} />
                        </div>

                        <div>
                          <h4 className="text-sm text-gray-700 mb-2">Description</h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {finding.description}
                          </p>
                        </div>

                        <div>
                          <h4 className="text-sm text-gray-700 mb-2">Affected Entities</h4>
                          <div className="flex flex-wrap gap-2">
                            {finding.affectedEntities.map((entity, i) => (
                              <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">{entity}</span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm text-gray-700 mb-2">Evidence ({finding.evidenceCount} items)</h4>
                          <ul className="space-y-1 text-sm text-gray-600">
                            {finding.evidence.map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))}
                          </ul>
                          <p className="text-xs text-gray-500 mt-2">Confidence: {finding.confidence}%</p>
                        </div>

                        {finding.queries.length > 0 && (
                          <div>
                            <h4 className="text-sm text-gray-700 mb-2">Queries Executed</h4>
                            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1">
                              {finding.queries.map((q, i) => (
                                <div key={i}>{q}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm text-gray-700 mb-2">Recommendation</h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {finding.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>

                {/* Recommendations */}
                <section id="recommendations">
                  <h2 className="text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Consolidated Recommendations
                  </h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    {findings.length === 0 ? (
                      <p className="text-gray-500 italic">No remediation actions required.</p>
                    ) : (
                      <ol className="space-y-4 text-sm list-decimal list-inside">
                        {findings.map((f) => (
                          <li key={f.id}>
                            <strong className="text-gray-900">{f.id} ({f.severity}):</strong>{" "}
                            {f.recommendation}
                          </li>
                        ))}
                      </ol>
                    )}
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
                      {uniqueQueries.length} unique threat hunting queries were executed during this audit.
                    </p>
                    {uniqueQueries.length > 0 ? (
                      <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-2 max-h-64 overflow-y-auto">
                        {uniqueQueries.map((q, i) => (
                          <div key={i}>{q}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No queries recorded.</p>
                    )}
                  </div>

                  <div id="evidence">
                    <h3 className="text-gray-900 mb-3">Evidence Archive</h3>
                    <p className="text-sm text-gray-600">
                      All supporting evidence including raw log entries, event details, and contextual data has been compiled.
                      This audit collected {stats.evidenceCount} distinct evidence items across {findings.length} findings.
                    </p>
                  </div>
                </section>
              </div>

              {/* Report Footer */}
              <div className="px-8 py-4 border-t border-gray-200 text-center text-sm text-gray-500">
                <p>Report generated by ArtifexAI | Confidential & Proprietary</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
