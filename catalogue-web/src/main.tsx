import React from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";
import "./style.css";
const theme = createTheme({
  palette: {
    primary: { main: "#1967d2" },
    background: { default: "#f6f8fc" },
    text: { primary: "#202124", secondary: "#5f6368" },
  },
  typography: {
    fontFamily: "Arial, system-ui, sans-serif",
    h4: { fontWeight: 500, letterSpacing: "-.6px" },
    h5: { fontWeight: 500 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          // WebKit can leave the fieldset border painted across the label until
          // a resize when the legend's max-width transition opens the notch.
          "& legend": { transition: "none" },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: ({ theme }) => ({
          // All editable fields sit on paper surfaces. Keep the floating label
          // opaque so even a delayed fieldset repaint cannot strike through it.
          "&.MuiInputLabel-shrink": {
            backgroundColor: theme.palette.background.paper,
            paddingInline: "4px",
            marginLeft: "-4px",
            zIndex: 2,
          },
        }),
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
  },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
