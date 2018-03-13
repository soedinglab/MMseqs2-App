import { execFileSync } from 'child_process';
import { platform } from 'os';

const os = platform();
const suffix = os == "win32" ? "windows.exe" : os;

const level = String(execFileSync(`${__dirname}/bin/cpu-check-${suffix}`)).trim();

export default level;
