import React from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { Button } from "./ui/button";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname !== "/";

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-[1440px] mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <span className="text-xl text-gray-900">ArtifexAI</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}