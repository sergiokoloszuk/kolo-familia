import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const pastas=['apps/web/src/lib/plano-v51','apps/web/src/components/plano-v51','apps/web/src/app/(app)/planos/desenvolvimento','apps/web/src/app/admin/plano-v51'];
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const arquivos=[...pastas.flatMap(walk),'apps/web/src/app/(app)/planos/[id]/page.tsx','docs/specs/plano-web-v51.md','apps/web/vercel.json'];
const protegidos=['apps/web/src/app/(app)/painel/page.tsx','apps/web/src/lib/ia/engine.ts','apps/web/src/lib/ia/context.ts','apps/web/src/lib/ayla/orchestrator.ts','apps/web/src/lib/ia/plano.ts','apps/web/src/app/api/stripe/webhook/route.ts'];
const r={base:git('rev-parse','HEAD'),branch:git('branch','--show-current'),geradoEm:new Date().toISOString(),producaoAlterada:false,modeloRealExecutado:false,
 arquivos:arquivos.map(p=>({caminho:p.replaceAll('\\','/'),sha256:sha(fs.readFileSync(p))})),
 protegidos:protegidos.map(p=>{const atual=sha(fs.readFileSync(p)),base=sha(execFileSync('git',['show',`HEAD:${p}`]));return{caminho:p,sha256:atual,identicoAHEAD:atual===base}}),
 testeStripePreexistente:'apps/web/src/app/api/stripe/webhook/route.test.ts — não pertence a esta entrega',
};
if(r.protegidos.some(p=>!p.identicoAHEAD))throw Error('Arquivo protegido difere da base. Revisar antes de concluir.');
fs.writeFileSync('outputs/plano-v51/MANIFESTO.json',JSON.stringify(r,null,2));console.log(JSON.stringify({arquivos:r.arquivos.length,protegidos:r.protegidos.length,todosProtegidosIntactos:true}));
