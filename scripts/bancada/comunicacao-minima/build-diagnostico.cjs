// Instrumentação somente no processo: observa a URL da fonte, sem corrigir
// dependências, código do produto, layout, CI ou resposta do loader.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawn}=require('node:child_process');
if(process.env.KOLO_FONT_TRACE==='1'){
 const original=Module._extensions['.js'];
 Module._extensions['.js']=function(mod,file){
  if(file.replace(/\\/g,'/').endsWith('/@next/font/dist/google/loader.js')){
   let s=fs.readFileSync(file,'utf8');
   const needle='const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];';
   s=s.replace(needle,'if (!/\\.(woff|woff2|eot|ttf|otf)$/.test(googleFontFileUrl)) console.error("[FONT_URL_SEM_EXTENSAO] " + googleFontFileUrl);\n'+needle);
   return mod._compile(s,file);
  }return original(mod,file);
 };
}else{
 const root=process.cwd(),web=path.join(root,'apps/web'),out=path.join(root,'outputs/comunicacao-minima-20261126/build.log');
 const env={...process.env,KOLO_FONT_TRACE:'1',NEXT_TELEMETRY_DISABLED:'1'};
 for(const k of Object.keys(env))if(/SUPABASE|STRIPE|DATABASE|POSTGRES|ZAPI|CRON_SECRET|API_KEY|^AYLA_/.test(k))delete env[k];
 Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fake-anon-key-for-ci',SUPABASE_SERVICE_ROLE_KEY:'fake-service-role-for-ci',NEXT_PUBLIC_APP_URL:'https://example.com'});
 env.NODE_OPTIONS=`--require="${__filename.replace(/\\/g,'/')}" --use-system-ca`;
 const fd=fs.openSync(out,'w');const p=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:web,env,stdio:['ignore',fd,fd]});
 p.on('exit',c=>{fs.closeSync(fd);console.log(JSON.stringify({exit:c,log:out}));process.exitCode=c??1;});
}
