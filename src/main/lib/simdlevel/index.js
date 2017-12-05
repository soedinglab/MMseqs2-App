import { execSync } from 'child_process';
import { platform } from 'os';

const os = platform();
const suffix = os == "win32" ? ".exe" : "";
const simdLevel = execSync(`${__dirname}/checksimd-${os}${suffix}`, { encoding: "utf8" }).trim();

export default simdLevel;