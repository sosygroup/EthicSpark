import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import { reportNotice } from "./notification-store";
import { openNotifications } from "./NotificationCenter";

export default function VisualImage({
  src,
  name,
}: {
  src: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <>
      {failedSource === src ? (
        <Button onClick={openNotifications}>
          Image preview unavailable · open Notifications
        </Button>
      ) : (
        <button
          type="button"
          className="visual-image-button"
          onClick={() => setOpen(true)}
          aria-label={"Enlarge " + name}
        >
          <img
            src={src}
            alt={name}
            onError={() => {
              setFailedSource(src);
              reportNotice({
                key: "image:" + name,
                source: "Image preview",
                severity: "warning",
                title: "An image could not be displayed",
                explanation:
                  "The browser could not decode this image. Its data may be incomplete, invalid or unsupported. This is a preview failure; the original artifact is still available.",
                nextStep:
                  "Download the original artifact, check its format or ask for a self-contained SVG or supported raster image.",
                details: name,
              });
            }}
          />
          <span>Click to enlarge</span>
        </button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>{name}</DialogTitle>
        <DialogContent>
          <img className="expanded-visual" src={src} alt={name} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
