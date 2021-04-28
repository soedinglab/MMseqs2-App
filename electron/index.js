import { app, BrowserWindow, shell, dialog, Menu, systemPreferences, nativeTheme } from 'electron';
import { execFile, execFileSync } from 'child_process';
import { default as fp } from 'find-free-port';
import { default as os } from 'os';
import { createReadStream, createWriteStream } from 'fs';
import { randomBytes } from 'crypto';
import { parse, join } from 'path';
import appRootDir from 'app-root-dir';
import defaultMenu from './menu';
import contextMenu from './context'

const winURL = app.isPackaged ? `file://${__dirname}/index.html` : `http://localhost:9080`;

const homePath = app.getPath('home');
const userData = app.getPath('userData');
const tempPath = app.getPath('temp');

const username = randomBytes(8).toString('hex');
const password = randomBytes(16).toString('hex');

const platform = os.platform();
const mapPlatform = (platform) => {
	switch (platform) {
		case "win32":
			return "win";
		case "darwin":
			return "mac";
		case "linux":
			return "linux";
		default:
			return "UNSUPPORTED-PLATFORM";
	}
}
const binPath = app.isPackaged ?
	join(process.resourcesPath, 'bin') :
	join(appRootDir.get(), 'resources', mapPlatform(platform), os.arch());

app.os = {
	arch: os.arch(),
	platform: platform
}

const mmseqsBinary = join(binPath, "mmseqs" + (platform == "win32" ? ".bat" : ""));
const backendBinary = join(binPath, "mmseqs-web-backend" + (platform == "win32" ? ".exe" : ""));

app.mmseqsVersion = String(execFileSync(mmseqsBinary, ["version"])).trim()
fp(8000, "127.0.0.1", function(err, freePort) {
//var freePort = "9080";
console.log(err);
	var server = execFile(backendBinary, 
		[
			"-local",
			"-server.address",
			`127.0.0.1:${freePort}`,
			"-server.auth.username",
			username,
			"-server.auth.password",
			password,
			"-paths.mmseqs",
			mmseqsBinary,
			"-paths.databases",
			`${userData}/databases`,
			"-paths.results",
			`${userData}/jobs`,
			"-paths.temporary",
			tempPath,
			"-server.cors",
			"true",
			"-server.dbmanagment",
			"true",
		], {
		encoding: "utf8",
		windowsHide: true
	}, (e, stdout, stderr) => {
		if (e) {
			console.log(e);
		}
	});

	server.stdout.on('data', function (data) {
		console.log(data);
	});

	server.stderr.on('data', function (data) {
		console.log(data);
	});

	app.apiEndpoint = `http://127.0.0.1:${freePort}/`
	app.token = Buffer.from(username + ':' + password).toString('base64');

	let mainWindow = null;
	app.newDatabase = function (format, callback) {
		const suffix = format == "fasta" ? ".fasta" : ".sto";
		const title = format == "fasta" ? "Select Sequences File" : "Select MSA File";
		dialog.showOpenDialog(mainWindow, {
			title: title,
		}).then((result) => {
			if (result.canceled) {
				callback("");
				return;
			}
			const selection = result.filePaths;
			if (Array.isArray(selection) && selection.length == 1) {
				const path = selection[0];
				const parsed = parse(path);
				const base = parsed.name;
				const destination = `${userData}/databases/${base}${suffix}`;
				const ws = createWriteStream(destination);
				createReadStream(path).pipe(ws);
				ws.on('finish', () => {
					callback(base);
				})
			} else {
				callback("");
			}
		});
	}

	app.handleTitleBarDoubleClick = () => {
		const action = systemPreferences.getUserDefault("AppleActionOnDoubleClick", "string") || "Maximize";
		if (action === "Minimize") {
			mainWindow.minimize();
		} else {
			mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
		}
	}

	app.saveResult = (id) => {
		dialog.showSaveDialog(mainWindow, {
			title: "Save Result",
			defaultPath: `${homePath}/mmseqs_results_${id}.tar.gz`
		}).then((result) => {
			if (!result.filePath) {
				return;
			}
			const resultPath = `${userData}/jobs/${id}/mmseqs_results_${id}.tar.gz`;
			createReadStream(resultPath).pipe(createWriteStream(result.filePath));
		});
	}

	function createWindow() {
		mainWindow = new BrowserWindow({
			backgroundColor: nativeTheme.shouldUseDarkColors ? '#121212' : "#fff",
			height: 615,
			useContentSize: true,
			width: 1000,
			show: false,
			titleBarStyle: "hidden",
			webPreferences: {
				enableRemoteModule: true,
				nodeIntegration: true,
				contextIsolation: false
			}
		});
		
		mainWindow.loadURL(winURL);

		mainWindow.once('ready-to-show', () => {
			mainWindow.show()
		});
		
		mainWindow.webContents.on('new-window', (e, url) => {
			if (url != mainWindow.webContents.getURL()) {
				e.preventDefault();
				shell.openExternal(url);
			}
		});

		const menu = defaultMenu(app, shell);
		Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
		mainWindow.setAutoHideMenuBar(true);

		contextMenu(mainWindow, {
			showInspectElement: !app.isPackaged
		});
	}

	app.on('ready', createWindow);
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	const cleanup = () => {
		if (server != null) {
			server.kill();
			server = null;
		}
	};

	app.on('quit', cleanup);
	process.on('exit', cleanup);
	process.on('SIGINT', cleanup);
	process.on('uncaughtException', function (e) {
		cleanup();
		console.log('Uncaught Exception...');
		console.log(e.stack);
		process.exit(99);
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});

});

/**
* Auto Updater
*
* Uncomment the following code below and install `electron-updater` to
* support auto updating. Code Signing with a valid certificate is required.
* https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
*/

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
	autoUpdater.quitAndInstall()
})

app.on('ready', () => {
	if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
*/
