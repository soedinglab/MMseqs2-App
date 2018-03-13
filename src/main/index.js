import { app, BrowserWindow, shell, dialog } from 'electron';
import { execFile } from 'child_process';
import { default as fp } from 'find-free-port';
import { default as os } from 'os';
import { createReadStream, createWriteStream } from 'fs';
import { randomBytes } from 'crypto';

const winURL = process.env.NODE_ENV === 'development'
	? `http://localhost:9080` : `file://${__dirname}/index.html`;


app.os = os;
app.simdLevel = require('./lib/simdlevel').default;

const homePath = app.getPath('home');
const userData = app.getPath('userData');
const tempPath = app.getPath('temp');

const username = randomBytes(8).toString('hex');
const password = randomBytes(16).toString('hex');

fp(3000, function(err, freePort) {
	const suffix = os.platform() == "win32" ? "windows.exe" : os.platform();	
	const server = execFile(`./mmseqs-web-backend-${suffix}`, 
		[
			"-local",
			"-server.address",
			`localhost:${freePort}`,
			"-server.auth.username",
			username,
			"-server.auth.password",
			password,
			"-paths.databases",
			`${userData}/databases`,
			"-paths.results",
			`${userData}/jobs`,
			"-paths.temporary",
			tempPath
		], {
		encoding: "utf8",
		cwd: `${__dirname}/bin`,
		windowsHide: true
	}, (e, stdout, stderr) => {
		console.log(e);
		console.log(stdout);
		console.log(stderr);
	});

	server.stdout.on('data', function (data) {
		console.log(data);
	});

	server.stderr.on('data', function (data) {
		console.log(data);
	});

	// if (module.hot) {
	// 	module.hot.dispose(() => {
	// 		server.kill();
	// 	})
	// }

	app.apiEndpoint = `http://localhost:${freePort}/`
	app.token = new Buffer(username + ':' + password).toString('base64');

	let mainWindow;
	app.saveResult = (id) => {
		dialog.showSaveDialog(mainWindow, {
			title: "Save Result",
			defaultPath: `${homePath}/mmseqs_results_${id}.tar.gz`
		}, (destination) => {
			if (!destination) {
				return;
			}
			const resultPath = `${userData}/jobs/${id}/mmseqs_results_${id}.tar.gz`;
			createReadStream(resultPath).pipe(createWriteStream(destination));  
		});
	}

	function createWindow() {
		mainWindow = new BrowserWindow({
			height: 615,
			useContentSize: true,
			width: 1000,
		});
		
		mainWindow.loadURL(winURL);
		
		mainWindow.on('closed', () => {
			mainWindow = null;
		});
		
		mainWindow.webContents.on('new-window', (e, url) => {
			if (url != mainWindow.webContents.getURL()) {
				e.preventDefault();
				shell.openExternal(url);
			}
		});

		mainWindow.webContents.openDevTools();
	}

	app.on('ready', createWindow);

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('quit', () => {
		server.kill();
	});

	app.on('activate', () => {
		if (mainWindow === null) {
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
