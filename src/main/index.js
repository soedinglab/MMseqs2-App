import { app, BrowserWindow, shell, dialog } from 'electron';
import { execFile, execFileSync } from 'child_process';
import { default as fp } from 'find-free-port';
import { default as os } from 'os';
import { createReadStream, createWriteStream } from 'fs';
import { randomBytes } from 'crypto';
import { parse, join, dirname } from 'path';
import appRootDir from 'app-root-dir';

const winURL = process.env.NODE_ENV === 'development'
	? `http://localhost:9080` : `file://${__dirname}/index.html`;

const homePath = app.getPath('home');
const userData = app.getPath('userData');
const tempPath = app.getPath('temp');

const username = randomBytes(8).toString('hex');
const password = randomBytes(16).toString('hex');

const platform = os.platform();
const binPath = (process.env.NODE_ENV === 'production') ?
	join(process.resourcesPath, 'bin') :
	join(appRootDir.get(), 'resources', platform);

app.os = {
	arch: os.arch(),
	platform: platform,
	simd: String(execFileSync(join(binPath, "cpu-check" + (platform == "win32" ? ".exe" : "")))).trim()
}

const mmseqsBinary = join(binPath, "mmseqs" + (platform == "win32" ? "" : ("-" + app.os.simd)) + (platform == "win32" ? ".bat" : ""));
const backendBinary = join(binPath, "mmseqs-web-backend" + (platform == "win32" ? ".exe" : ""));

app.mmseqsVersion = String(execFileSync(mmseqsBinary, ["version"])).trim()

fp(3000, function(err, freePort) {
	var server = execFile(backendBinary, 
		[
			"-local",
			"-server.address",
			`localhost:${freePort}`,
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

	// if (module.hot) {
	// 	module.hot.dispose(() => {
	// 		server.kill();
	// 	})
	// }

	app.apiEndpoint = `http://localhost:${freePort}/`
	app.token = new Buffer(username + ':' + password).toString('base64');

	let mainWindow;
	app.newDatabase = function (format, callback) {
		const suffix = format == "fasta" ? ".fasta" : ".sto";
		const title = format == "fasta" ? "Select Sequences File" : "Select MSA File";
		dialog.showOpenDialog(mainWindow, {
			title: title,
		}, (selection) => {
			if (Array.isArray(selection) && selection.length == 1) {
				const path = selection[0];
				const parsed = parse(path);
				const base = parsed.name;
				const destination = `${userData}/databases/${base}${suffix}`;
				createReadStream(path).pipe(createWriteStream(destination));
				callback(base);
			} else {
				callback("");
			}
		});
	}

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
