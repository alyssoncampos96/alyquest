export const stepSavers=new Map<string,()=>Promise<void>>();
export async function flushSteps(id:string){await stepSavers.get(id)?.();}

export async function flushAllSteps(){await Promise.all([...stepSavers.values()].map(save=>save()));}
