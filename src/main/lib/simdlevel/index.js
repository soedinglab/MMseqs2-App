import { execFileSync } from 'child_process';
import { platform } from 'os';

const os = platform();
const suffix = os == "win32" ? "windows.exe" : os;

export default execFileSync(`${__dirname}/bin/cpu-check-${suffix}`, { encoding: "utf8" }).trim();
