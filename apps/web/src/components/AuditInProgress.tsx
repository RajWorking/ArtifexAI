import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Header } from "./Header";
import { DashboardCard } from "./DashboardCard";
import { Progress } from "./ui/progress";
import { CheckCircle2, Circle, Loader2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { api, type LogEntry } from "../lib/api";

type StageStatus = "pending" | "in-progress" | "complete" | "failed";

interface Stage {
  id: string;
  label: string;
  status: StageStatus;
}

export function AuditInProgress() {
  const navigate = useNavigate();
  const location = useLocation();
  const auditId = location.state?.auditId;

  const [stages, setStages] = useState<Stage[]>([
    { id: "coverage", label: "Coverage Checks", status: "pending" },
    { id: "selecting", label: "Selecting Hunts", status: "pending" },
    { id: "running", label: "Running Hunts", status: "pending" },
    { id: "packaging", label: "Packaging Evidence", status: "pending" },
    { id: "report", label: "Generating Report", status: "pending" },
  ]);

  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId) {
      setError("No audit ID provided");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    // Poll for audit status
    const pollInterval = setInterval(async () => {
      try {
        const status = await api.audit.status(auditId);

        if (!status.ok) {
          setError(status.error?.message || "Failed to fetch audit status");
          clearInterval(pollInterval);
          return;
        }

        // Update progress
        setProgress(status.progress);

        // Update logs
        setLogs(status.logs);

        // Update stages based on current stage
        const currentStageId = status.stage;
        setStages(prev => prev.map(stage => {
          const stageOrder = ["coverage", "selecting", "running", "packaging", "report"];
          const currentIndex = stageOrder.indexOf(currentStageId);
          const stageIndex = stageOrder.indexOf(stage.id);

          if (currentStageId === "failed") {
            // Mark the in-progress stage as failed, earlier ones as complete, later ones as pending
            const lastLoggedStage = prev.findIndex(s => s.status === "in-progress");
            const failIndex = lastLoggedStage >= 0 ? lastLoggedStage : 0;
            if (stageIndex < failIndex) return { ...stage, status: "complete" as StageStatus };
            if (stageIndex === failIndex) return { ...stage, status: "failed" as StageStatus };
            return { ...stage, status: "pending" as StageStatus };
          }

          if (stageIndex < currentIndex) {
            return { ...stage, status: "complete" as StageStatus };
          } else if (stageIndex === currentIndex) {
            return { ...stage, status: currentStageId === "complete" ? "complete" : "in-progress" as StageStatus };
          } else {
            return { ...stage, status: "pending" as StageStatus };
          }
        }));

        // Handle failed state
        if (status.stage === "failed") {
          clearInterval(pollInterval);
          setError("Audit failed — see logs below for details.");
          return;
        }

        // Navigate to results when complete
        if (status.stage === "complete") {
          clearInterval(pollInterval);
          setTimeout(() => {
            navigate("/audit/results", { state: { auditId } });
          }, 1000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to poll audit status");
        clearInterval(pollInterval);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [auditId, navigate]);

  const getStageIcon = (status: StageStatus) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "in-progress":
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "pending":
        return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1440px] mx-auto px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-gray-900 mb-2">Audit In Progress</h1>
            <p className="text-gray-600">
              Running automated security analysis on your SIEM data...
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
              <p className="font-medium">Error</p>
              <p className="text-sm mb-3">{error}</p>
              <Button variant="outline" size="sm" className="gap-2 text-red-700 border-red-300 hover:bg-red-100" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </div>
          )}

          {/* Progress Timeline */}
          <DashboardCard title="Progress" className="mb-6">
            <div className="space-y-6">
              <div className="space-y-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Overall Progress</span>
                  <span className="text-gray-900">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-3 pt-2">
                {stages.map((stage, idx) => (
                  <div key={stage.id} className="flex items-center gap-3">
                    {getStageIcon(stage.status)}
                    <span
                      className={
                        stage.status === "complete"
                          ? "text-gray-900"
                          : stage.status === "in-progress"
                          ? "text-blue-600"
                          : stage.status === "failed"
                          ? "text-red-600"
                          : "text-gray-400"
                      }
                    >
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </DashboardCard>

          {/* Live Logs */}
          <DashboardCard title="Live Activity Log" description="Real-time query execution and processing status">
            <div className="bg-gray-900 rounded-md p-4 h-[400px] overflow-y-auto font-mono text-sm">
              {logs.map((entry, idx) => (
                <div
                  key={idx}
                  className="mb-1 font-mono"
                  style={{ color: entry.level === "error" ? "#ff2f2f" : "#4ade80" }}
                >
                  {entry.message}
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </main>
    </div>
  );
}
