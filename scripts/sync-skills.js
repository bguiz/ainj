import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export async function syncSkills({
  _readFile = readFile,
  _spawn = spawnSync,
  _cp = (src, dest, opts) => cp(src, dest, opts),
  _rm = rm,
  _mkdir = mkdir,
  _mkdtemp = mkdtemp,
  _env = process.env,
  _cwd = () => process.cwd(),
} = {}) {
  const configText = await _readFile(
    path.join(_cwd(), 'ainj.config.json'),
    'utf8',
  );
  const config = JSON.parse(configText);

  if (!config.skillsRef) {
    throw new Error(
      'ainj.config.json is missing required field: skillsRef',
    );
  }

  const { skillsRef } = config;
  const token = _env.GITHUB_TOKEN;
  const repoUrl = token
    ? `https://${token}@github.com/InjectiveLabs/agent-skills.git`
    : 'https://github.com/InjectiveLabs/agent-skills.git';

  const tmpDir = await _mkdtemp(path.join(os.tmpdir(), 'ainj-skills-'));

  try {
    const result = _spawn(
      'git',
      ['clone', '--depth=1', '--branch', skillsRef, repoUrl, tmpDir],
      { stdio: 'pipe' },
    );
    if (result.status !== 0) {
      const stderr = result.stderr?.toString?.() ?? '';
      throw new Error(`git clone failed (exit ${result.status}): ${stderr}`);
    }

    const agentsSkillsDir = path.join(_cwd(), '.agents', 'skills');
    await _rm(agentsSkillsDir, { recursive: true, force: true });
    await _mkdir(agentsSkillsDir, { recursive: true });

    const srcSkillsDir = path.join(tmpDir, 'skills');
    await _cp(srcSkillsDir, agentsSkillsDir, { recursive: true });
  } finally {
    await _rm(tmpDir, { recursive: true, force: true });
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (currentFilePath === process.argv[1]) {
  await syncSkills();
}
