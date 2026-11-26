/** Test double do Supabase, exclusivamente para QA. Sem cliente, URL ou arquivo de banco. */
export function bancoControlado() {
  const rows=[];
  const subset=(a,b)=>Array.isArray(b)?Array.isArray(a)&&b.every(x=>a.some(y=>subset(y,x))):b&&typeof b==='object'?a&&typeof a==='object'&&Object.entries(b).every(([k,v])=>subset(a[k],v)):a===b;
  return {rows,db:{from(table){
    if(table!=='planos')throw Error('Tabela não autorizada no teste');
    let op='read',payload;const filtros=[];
    const executar=single=>{
      if(op==='insert'){if(rows.some(r=>r.id===payload.id))return{data:null,error:{code:'23505'}};rows.push(structuredClone(payload));return{data:{id:payload.id},error:null};}
      const lista=rows.filter(r=>filtros.every(([k,v,contains])=>contains?subset(r[k],v):r[k]===v));
      if(op==='update')lista.forEach(r=>Object.assign(r,structuredClone(payload)));
      return{data:structuredClone(single?lista[0]??null:lista),error:null};
    };
    const q={select(){return q},eq(k,v){filtros.push([k,v,false]);return q},contains(k,v){filtros.push([k,v,true]);return q},order(){return q},limit(){return q},insert(p){op='insert';payload=p;return q},update(p){op='update';payload=p;return q},single:async()=>executar(true),maybeSingle:async()=>executar(true),then(resolve){return Promise.resolve(executar(false)).then(resolve)}};
    return q;
  }}};
}
