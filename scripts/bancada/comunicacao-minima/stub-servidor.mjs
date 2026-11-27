export async function createClient(){if(!globalThis.__COMUNICACAO_DB)throw Error('Banco fictício ausente');return globalThis.__COMUNICACAO_DB;}
export function createServiceRoleClient(){if(!globalThis.__COMUNICACAO_DB)throw Error('Banco fictício ausente');return globalThis.__COMUNICACAO_DB;}
export function cookies(){throw Error('Cookies reais proibidos');}
export function headers(){throw Error('Headers reais proibidos');}
export function revalidatePath(){}
export function revalidateTag(){}
