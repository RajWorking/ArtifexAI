import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import { DashboardCard } from "./DashboardCard";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Info } from "lucide-react";
import { api } from "../lib/api";

export function LandingPage() {
  const navigate = useNavigate();
  const [siemType, setSiemType] = useState("splunk");
  const [baseUrl, setBaseUrl] = useState("https://localhost:8089/services/mcp");
  const [apiToken, setApiToken] = useState("");
  const [timeRange, setTimeRange] = useState("180");
  const [scope, setScope] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunAudit = async () => {
    if (!baseUrl || !apiToken) {
      setError("Please provide both Base URL and API Token");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.audit.start({
        command: "npx",
        args: [
          "-y",
          "mcp-remote",
          baseUrl,
          "--header",
          `Authorization: Bearer ${apiToken}`
        ],
        env: {
          NODE_TLS_REJECT_UNAUTHORIZED: "0"
        },
        timeRange,
        scope: scope || undefined
      });

      if (result.ok) {
        navigate("/audit/in-progress", {
          state: { auditId: result.auditId }
        });
      } else {
        setError(result.error?.message || "Failed to start audit");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1440px] mx-auto px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-gray-900 mb-2">Run Security Audit</h1>
            <p className="text-gray-600">
              Configure your SIEM connection and audit parameters to begin automated cybersecurity due diligence.
            </p>
          </div>

          {/* SIEM Connection Card */}
          <DashboardCard title="Connect SIEM" description="Provide read-only credentials for your security information and event management system.">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siem-type">SIEM Type</Label>
                <Select value={siemType} onValueChange={setSiemType}>
                  <SelectTrigger id="siem-type" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="splunk">Splunk</SelectItem>
                    <SelectItem value="sentinel">Microsoft Sentinel</SelectItem>
                    <SelectItem value="qradar">IBM QRadar</SelectItem>
                    <SelectItem value="elastic">Elastic Security</SelectItem>
                    <SelectItem value="chronicle">Google Chronicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  type="url"
                  placeholder="https://your-siem.example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-token">API Token</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Enter your read-only API token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>
          </DashboardCard>

          {/* Audit Scope Card */}
          <DashboardCard title="Audit Scope" description="Define the time range and specific systems or domains to include in the audit.">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="time-range">Time Range</Label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger id="time-range" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="180">Last 180 days</SelectItem>
                    <SelectItem value="365">Last 365 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope">Optional Scope Filter</Label>
                <Textarea
                  id="scope"
                  placeholder="e.g., Domain Controllers only, Production servers, specific IP ranges..."
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="bg-white min-h-[80px] resize-none"
                />
              </div>
            </div>
          </DashboardCard>

          {/* Action Section */}
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <Info className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handleRunAudit}
              className="w-full h-12"
              size="lg"
              disabled={isLoading || !baseUrl || !apiToken}
            >
              {isLoading ? "Starting Audit..." : "Run Audit"}
            </Button>

            <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span>
                Read-only access. No data will be modified. All queries are logged and can be reviewed in the audit report.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
