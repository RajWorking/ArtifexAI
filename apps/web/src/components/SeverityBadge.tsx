import React from "react";

type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

interface SeverityBadgeProps {
  severity: SeverityLevel;
}

const severityConfig = {
  critical: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    label: "Critical",
  },
  high: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    label: "High",
  },
  medium: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    label: "Medium",
  },
  low: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Low",
  },
  info: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    label: "Info",
  },
};

const fallbackConfig = severityConfig.info;

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = severityConfig[severity] ?? fallbackConfig;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border ${config.bg} ${config.text} ${config.border} text-xs`}
    >
      {config.label}
    </span>
  );
}
