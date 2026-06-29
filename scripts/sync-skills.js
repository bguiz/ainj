import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const thisDir = import.meta.dirname;

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
  console.log('Syncing skills...');
  const configText = await _readFile(path.join(thisDir, '..', 'ainj.config.json'), 'utf8');
  const config = JSON.parse(configText);

  if (!config.skillsRef) {
    throw new Error('ainj.config.json is missing required field: skillsRef');
  }

  const { skillsRef } = config;
  console.log('Skills git ref:', skillsRef);
  const token = _env.GITHUB_TOKEN;
  const repoUrl = token
    ? `https://${token}@github.com/InjectiveLabs/agent-skills.git`
    : 'https://github.com/InjectiveLabs/agent-skills.git';

  const tmpDir = await _mkdtemp(path.join(os.tmpdir(), 'ainj-skills-'));

  try {
    runGit(['init', tmpDir], 'init');
    runGit(['-C', tmpDir, 'remote', 'add', 'origin', repoUrl], 'remote add');
    runGit(['-C', tmpDir, 'fetch', '--depth=1', 'origin', skillsRef], 'fetch');
    runGit(['-C', tmpDir, 'checkout', '--detach', 'FETCH_HEAD'], 'checkout');

    const agentsSkillsDir = path.join(thisDir, '../.agents/skills');
    await _rm(agentsSkillsDir, { recursive: true, force: true });
    await _mkdir(agentsSkillsDir, { recursive: true, force: true });

    const srcSkillsDir = path.join(tmpDir, 'skills');
    await _cp(srcSkillsDir, agentsSkillsDir, { recursive: true, force: true });
    console.log('skills copied to:', agentsSkillsDir);
  } finally {
    await _rm(tmpDir, { recursive: true, force: true });
  }

  function runGit(args, action) {
    const result = _spawn('git', args, { stdio: 'pipe' });
    if (result.status !== 0) {
      const stderr = result.stderr?.toString?.() ?? '';
      throw new Error(`git ${action} failed (exit ${result.status}): ${stderr}`);
    }
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (currentFilePath === process.argv[1]) {
  await syncSkills();
}
