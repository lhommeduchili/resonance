// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Preload APIs will live here for loopback audio or secure wallet access in future phases
    isElectron: true
});
