import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import { DashboardCard } from "./DashboardCard";
import { Progress } from "./ui/progress";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

type StageStatus = "pending" | "in-progress" | "complete";

interface Stage {
  id: string;
  label: string;
  status: StageStatus;
}

export function AuditInProgress() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([
    { id: "coverage", label: "Coverage Checks", status: "in-progress" },
    { id: "selecting", label: "Selecting Hunts", status: "pending" },
    { id: "running", label: "Running Hunts", status: "pending" },
    { id: "packaging", label: "Packaging Evidence", status: "pending" },
    { id: "report", label: "Generating Report", status: "pending" },
  ]);

  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    "[10:23:41] Connecting to Splunk instance...",
    "[10:23:42] Connection established successfully",
    "[10:23:43] Validating API credentials...",
    "[10:23:44] Credentials validated - read-only access confirmed",
    "[10:23:45] Starting coverage checks...",
  ]);

  useEffect(() => {
    // Simulate progress
    const stageTimings = [
      { stage: 0, time: 2000, progress: 15 },
      { stage: 1, time: 3000, progress: 30 },
      { stage: 2, time: 8000, progress: 70 },
      { stage: 3, time: 2000, progress: 85 },
      { stage: 4, time: 3000, progress: 100 },
    ];

    let currentStage = 0;
    let logCounter = 5;

    const progressInterval = setInterval(() => {
      if (currentStage >= stageTimings.length) {
        clearInterval(progressInterval);
        setTimeout(() => navigate("/audit/results"), 1000);
        return;
      }

      const { stage, time, progress: targetProgress } = stageTimings[currentStage];

      // Update stage status
      setStages((prev) =>
        prev.map((s, idx) => {
          if (idx < stage) return { ...s, status: "complete" as StageStatus };
          if (idx === stage) return { ...s, status: "in-progress" as StageStatus };
          return s;
        })
      );

      // Update progress
      setProgress(targetProgress);

      // Add logs based on stage
      const newLogs: string[] = [];
      const timestamp = `[10:${23 + Math.floor(logCounter / 60)}:${(40 + logCounter) % 60}]`;
      
      switch (stage) {
        case 0:
          newLogs.push(`${timestamp} Analyzing log sources coverage...`);
          break;
        case 1:
          newLogs.push(`${timestamp} Selected 47 threat hunting queries`);
          break;
        case 2:
          newLogs.push(`${timestamp} Executing query: Privileged Account Usage`);
          newLogs.push(`${timestamp} Executing query: Lateral Movement Detection`);
          newLogs.push(`${timestamp} Executing query: Unauthorized Access Attempts`);
          break;
        case 3:
          newLogs.push(`${timestamp} Collecting evidence artifacts...`);
          break;
        case 4:
          newLogs.push(`${timestamp} Generating executive summary...`);
          newLogs.push(`${timestamp} Compiling findings report...`);
          break;
      }

      setLogs((prev) => [...prev, ...newLogs]);
      logCounter += newLogs.length;

      // Mark current stage complete and move to next
      setTimeout(() => {
        setStages((prev) =>
          prev.map((s, idx) =>
            idx === stage ? { ...s, status: "complete" as StageStatus } : s
          )
        );
        currentStage++;
      }, time - 500);
    }, stageTimings[currentStage]?.time || 2000);

    return () => clearInterval(progressInterval);
  }, [navigate]);

  const getStageIcon = (status: StageStatus) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "in-progress":
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
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
              {logs.map((log, idx) => (
                <div key={idx} className="text-green-400 mb-1">
                  {log}
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </main>
    </div>
  );
}
