import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Button } from "@mui/material";
import { reportIssue } from "./notification-store";
import { openNotifications } from "./NotificationCenter";
import { checkForAppUpdate, isModuleLoadError } from "./app-update";

export class ModuleLoadBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (isModuleLoadError(error)) void checkForAppUpdate(true, error);
    else reportIssue(error.message, "Interface view");
  }
  render() {
    if (this.state.error && this.props.fallback) return this.props.fallback;
    if (this.state.error)
      return (
        <Button onClick={openNotifications}>
          View unavailable · open Notifications
        </Button>
      );
    return this.props.children;
  }
}
