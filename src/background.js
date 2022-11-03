const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const path = require('path')
const fs = require('fs/promises')

const utils = require('./utils')

// サンドボックス機能を有効化
app.enableSandbox()



const createWindow = () => {
    const store = require('./store')

    // ファイルを開く
    const changeViewFile = async (path) => {
        store.set({ viewingFile: path })

        const stat = await fs.stat(path)

        mainWindow.webContents.send('viewImage', {
            path: path,
            filesize: utils.fileSizeString(stat.size)
        })
    }

    const mainWindow = new BrowserWindow({
        x: store.get('x'),
        y: store.get('y'),
        width: store.get('w'),
        height: store.get('h'),
        center: false,

        title: "Simple image view",
        disableAutoHideCursor: true,

        webPreferences: {
            preload: path.join(__dirname, 'back/preload.js')
        }
    })

    mainWindow.removeMenu()
    mainWindow.loadFile(path.join(__dirname, 'front/index.html'))

    if ( process.env.ReleaseType === 'Debug') { mainWindow.webContents.openDevTools() }

    // ロード終了時
    mainWindow.webContents.once('did-finish-load', () => {
        // 関連付けを開く
        const defaultImage = require('./defaultImage')()
        const viewingFile = defaultImage ?? store.get('viewingFile')
        if (viewingFile) { changeViewFile(viewingFile) }
    })

    // ダークテーマ対応
    ipcMain.handle('dark-mode:toggle', () => {
        if (nativeTheme.shouldUseDarkColors) {
            nativeTheme.themeSource = 'light'
        } else {
            nativeTheme.themeSource = 'dark'
        }

        return nativeTheme.shouldUseDarkColors
    })

    // ダークテーマ対応
    ipcMain.handle('dark-mode:system', () => {
        nativeTheme.themeSource = 'system'
    })

    // ドロップされたファイル名を受け取り
    ipcMain.handle('dropFile', (ev, dropFilePath) => {
        if (dropFilePath) { changeViewFile(dropFilePath) }
    })

    // 前のファイルを表示
    ipcMain.handle('prevView', async (ev) => {
        const viewingFile = store.get('viewingFile')
        const dirname = path.dirname(viewingFile)
        const viewFile = path.basename(viewingFile)
        let previewFile = ''

        const dir = await fs.opendir(dirname)

        for await (const dircurrent of dir) {
            if (viewFile === dircurrent.name ) {
                const viewPath = path.join(dirname, previewFile)
                changeViewFile(viewPath)
                return
            }

            previewFile = dircurrent.name
        }
    })

    // 次のファイルを表示
    ipcMain.handle('nextView', async (ev) => {
        const viewingFile = store.get('viewingFile')
        const dirname = path.dirname(viewingFile)
        const viewFile = path.basename(viewingFile)
        let nextFile = false

        const dir = await fs.opendir(dirname)

        for await (const dircurrent of dir) {
            if (nextFile) {
                const viewPath = path.join(dirname, dircurrent.name)
                changeViewFile(viewPath)
                return
            }

            if (viewFile === dircurrent.name ) {
                nextFile = true
            }
        }
    })

    // 終了時データ保存
    mainWindow.once('close', () => {
        const { x, y, width, height } = mainWindow.getBounds()

        store.set({
            x: x,
            y: y,
            w: width,
            h: height
        })
    })
}



// アプリケーションの初期化処理が完了してからウィンドウを生成する
app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) { createWindow() }
    })
})



// 全ウィンドウが終了した時にアプリケーションを終了する
// MacOSは除く
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})


