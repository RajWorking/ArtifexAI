import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskLevelBadgeProps {
  level: RiskLevel;
  className?: string;
}

const riskConfig: Record<RiskLevel, { bg: string; text: string; border: string; label: string; icon: typeof AlertCircle }> = {
  low: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    label: "Low Risk",
    icon: CheckCircle,
  },
  medium: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    label: "Medium Risk",
    icon: AlertTriangle,
  },
  high: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    label: "High Risk",
    icon: AlertCircle,
  },
  critical: {
    bg: "bg-red-100",
    text: "text-red-900",
    border: "border-red-400",
    label: "Critical Risk",
    icon: ShieldAlert,
  },
};

const fallbackConfig = riskConfig.medium;

export function RiskLevelBadge({ level, className = "" }: RiskLevelBadgeProps) {
  const config = riskConfig[level] ?? fallbackConfig;
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <Icon className="w-5 h-5" />
      <span>{config.label}</span>
    </div>
  );
}
