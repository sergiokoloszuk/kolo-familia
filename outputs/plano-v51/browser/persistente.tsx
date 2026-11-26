import React from 'react';
import { createRoot } from 'react-dom/client';
import { PlanoV51, type ServicosPlanoV51 } from '@/components/plano-v51/plano-v51';
async function api(caminho: string, dados?: unknown) {
  const r=await fetch(`/qa/${caminho}`,dados?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}:undefined);
  const v=await r.json(); if(!r.ok)throw Error(v.erro);return v;
}
const estado=await api('estado');
const servicos:ServicosPlanoV51={preparar:async()=>{throw Error('Porta não utilizada')},iniciar:p=>api('iniciar',p),persistir:p=>api('eventos',p)};
createRoot(document.getElementById('root')!).render(<PlanoV51 familyId={estado.familyId} nome="Karina" membros={estado.membros} planosIniciais={estado.planos} servicos={servicos} interno />);
