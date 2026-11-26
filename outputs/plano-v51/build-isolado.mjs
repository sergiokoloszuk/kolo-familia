import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
const env = Object.fromEntries(Object.entries(process.env).filter(([k])=>!/SECRET|TOKEN|API_KEY|SUPABASE|STRIPE|DATABASE|POSTGRES/i.test(k)));
env.NEXT_TELEMETRY_DISABLED='1';
// Identificadores sintéticos: jamais apontar a QA para serviços/banco reais.
env.NEXT_PUBLIC_SUPABASE_URL='https://example.invalid';
env.NEXT_PUBLIC_SUPABASE_ANON_KEY='chave-sintetica-de-build';
const log=createWriteStream(path.resolve('outputs/plano-v51/BUILD.log'));
const child=spawn(process.execPath,['--use-system-ca',path.resolve('node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:path.resolve('apps/web'),env,stdio:['ignore','pipe','pipe']});
child.stdout.on('data',d=>{log.write(d);process.stdout.write(d)});
child.stderr.on('data',d=>{log.write(d);process.stderr.write(d)});
child.on('exit',code=>{log.end();process.exitCode=code??1});
