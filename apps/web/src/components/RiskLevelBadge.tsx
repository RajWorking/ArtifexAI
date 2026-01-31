import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";

type RiskLevel = "low" | "medium" | "high";

interface RiskLevelBadgeProps {
  level: RiskLevel;
  className?: string;
}

const riskConfig = {
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
};

export function RiskLevelBadge({ level, className = "" }: RiskLevelBadgeProps) {
  const config = riskConfig[level];
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
