import { createBrowserRouter } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { AuditInProgress } from "./components/AuditInProgress";
import { AuditResults } from "./components/AuditResults";
import { ReportPreview } from "./components/ReportPreview";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/audit/in-progress",
    Component: AuditInProgress,
  },
  {
    path: "/audit/results",
    Component: AuditResults,
  },
  {
    path: "/report",
    Component: ReportPreview,
  },
]);
