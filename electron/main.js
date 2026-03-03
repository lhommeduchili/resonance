// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow, systemPreferences } = require('electron');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    if (process.platform === 'darwin') {
        try {
            await systemPreferences.askForMediaAccess('microphone');
        } catch (e) {
            console.warn('Failed to ask for media access', e);
        }
    }

    if (isDev) {
        win.loadURL('http://localhost:3000/broadcast');
        win.webContents.openDevTools();
    } else {
        // Requires a static export from Next.js (`output: 'export'` in next.config.js)
        win.loadFile(path.join(__dirname, '../out/broadcast.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
