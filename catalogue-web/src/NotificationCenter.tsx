import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge, Button, Drawer, IconButton, Typography } from "@mui/material";
import {
  clearReadNotices,
  getNotices,
  markNoticesRead,
  subscribeNotices,
} from "./notification-store";
import { reloadApp } from "./app-update";
import "./notifications.css";
export default function NotificationCenter() {
  const items = useSyncExternalStore(subscribeNotices, getNotices);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read);
  const color = unread.some((n) => n.severity === "error")
    ? "error"
    : unread.some((n) => n.severity === "warning")
      ? "warning"
      : "info";
  useEffect(() => {
    if (open) markNoticesRead();
  }, [open, items]);
  useEffect(() => {
    const show = () => setOpen(true);
    const shortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.code === "KeyN") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("ethicspark:open-notifications", show);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("ethicspark:open-notifications", show);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  return (
    <>
      <IconButton
        className="notification-toggle"
        title="Notifications (Alt+N)"
        aria-keyshortcuts="Alt+N"
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Badge color={color} variant="dot" invisible={!unread.length}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
        </Badge>
      </IconButton>
      <span className="notifications-sr" role="status" aria-live="polite">
        {unread.length ? `${unread.length} unread notifications` : ""}
      </span>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        sx={{ zIndex: 1700 }}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-labelledby": "notifications-title",
            sx: { width: 460, maxWidth: "100vw" },
          },
        }}
      >
        <div className="notifications-heading">
          <Typography id="notifications-title" variant="h6">
            Notifications
          </Typography>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
        <p className="notifications-intro">
          What happened, what it means and what you can do. Repeated reports are
          grouped. This list is kept only in this window until it is reloaded.
        </p>
        <div className="notifications-list">
          {items.length ? (
            items.map((n) => (
              <article className={`notification-card ${n.severity}`} key={n.id}>
                <div className="notification-meta">
                  <span>
                    {n.severity} · {n.source}
                  </span>
                  <time dateTime={new Date(n.lastAt).toISOString()}>
                    {new Date(n.lastAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <h3>{n.title}</h3>
                <p>{n.explanation}</p>
                <p>
                  <strong>What to do:</strong> {n.nextStep}
                </p>
                {n.action === "reload" && (
                  <Button variant="outlined" onClick={reloadApp}>
                    Reload app
                  </Button>
                )}
                {n.count > 1 && (
                  <small>
                    Observed {n.count} times · grouped into one notification
                  </small>
                )}
                {n.details && (
                  <details>
                    <summary>Technical details</summary>
                    <pre>{n.details}</pre>
                  </details>
                )}
              </article>
            ))
          ) : (
            <p className="notifications-empty">
              No notifications in this window.
            </p>
          )}
        </div>
        <div className="notifications-footer">
          <Button
            onClick={clearReadNotices}
            disabled={!items.some((n) => n.read)}
          >
            Clear read notifications
          </Button>
        </div>
      </Drawer>
    </>
  );
}
export function openNotifications() {
  window.dispatchEvent(new Event("ethicspark:open-notifications"));
}
