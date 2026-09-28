"use server";
import { createClient } from '@/lib/supabase/server';
import { sheetId,sheetRows } from '@/lib/sheet-import';
import { revalidatePath } from 'next/cache';
export async function syncSheet(responsible?:string){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error('Entre novamente.');
 if(responsible===undefined){const {data,error}=await s.from('aq_sheet_settings').select('responsible,last_sync').eq('user_id',user.id).maybeSingle();if(error||!data)return null;if(data.last_sync&&Date.now()-Date.parse(data.last_sync)<300000)return null;responsible=data.responsible;}
 const name=(responsible??'').trim();if(!name||name.length>100)throw new Error('Informe o responsável como aparece na planilha.');
 const url=new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);url.searchParams.set('gid','1038364522');url.searchParams.set('tqx','out:csv');
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok||!response.headers.get('content-type')?.includes('text/csv'))throw new Error('A planilha não está disponível para leitura.');
 const csv=await response.text();if(csv.length>2000000)throw new Error('Planilha excedeu o limite de leitura.');const rows=sheetRows(csv,name);if(!rows.length)throw new Error('Nenhuma tarefa encontrada para esse responsável.');
 const {data,error}=await s.rpc('aq_import_sheet',{p_responsible:name,p_rows:rows});if(error)throw new Error('Não foi possível importar as tarefas.');['/','/tasks','/focus'].forEach(p=>revalidatePath(p));return Number(data);
}
