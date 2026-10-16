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
    linkFolder: (project) => ipcRenderer.invoke("workspace:link", project),
    openFolder: (project) => ipcRenderer.invoke("workspace:open", project),
    workspace: (project) => ipcRenderer.invoke("workspace:get", project),
    unlinkFolder: (project) => ipcRenderer.invoke("workspace:unlink", project),
    readFile: (project, path) =>
      ipcRenderer.invoke("workspace:read", project, path),
    prepareOperation: (project, operation) =>
      ipcRenderer.invoke("workspace:prepare", project, operation),
    approveOperation: (ticket) =>
      ipcRenderer.invoke("workspace:approve", ticket),
    stopCommand: (ticket) => ipcRenderer.invoke("workspace:stop", ticket),
    onWorkspaceChanged: (callback) => listen("workspace:changed", callback),
    onCommandOutput: (callback) => listen("workspace:output", callback),
  }),
);
