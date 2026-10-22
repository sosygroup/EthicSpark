"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const listen = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld(
  "ethicsparkDesktop",
  Object.freeze({
    openExternalLink: (url) => ipcRenderer.invoke("reference:open", url),
    linkFolder: (project) => ipcRenderer.invoke("workspace:link", project),
    openFolder: (project) => ipcRenderer.invoke("workspace:open", project),
    workspace: (project) => ipcRenderer.invoke("workspace:get", project),
    unlinkFolder: (project) => ipcRenderer.invoke("workspace:unlink", project),
    readFile: (project, path) =>
      ipcRenderer.invoke("workspace:read", project, path),
    prepareOperation: (project, operation) =>
      ipcRenderer.invoke("workspace:prepare", project, operation),
    approveOperation: (ticket, lease) =>
      ipcRenderer.invoke("workspace:approve", ticket, lease),
    resetWorkspaceLinks: () => ipcRenderer.invoke("workspace:reset-links"),
    stopCommand: (ticket) => ipcRenderer.invoke("workspace:stop", ticket),
    onApplicationUpdateCheck: (callback) =>
      listen("application:check-update", callback),
    onWorkspaceChanged: (callback) => listen("workspace:changed", callback),
    onCommandOutput: (callback) => listen("workspace:output", callback),
  }),
);
