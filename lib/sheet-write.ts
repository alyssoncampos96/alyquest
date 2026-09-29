import 'server-only';
import {createSign} from 'node:crypto';
import {sheetId} from './sheet-import';
import {createClient} from './supabase/server';
const normalize=(s:string)=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function accessToken(){
 const credential=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON??'{}') as {client_email?:string;private_key?:string};
 if(!credential.client_email||!credential.private_key)throw new Error('Escrita na planilha aguardando configuração Google.');
 const encode=(o:unknown)=>Buffer.from(JSON.stringify(o)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:credential.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
 const sign=createSign('RSA-SHA256');sign.update(unsigned);sign.end();const assertion=`${unsigned}.${sign.sign(credential.private_key,'base64url')}`;
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)throw new Error('Não foi possível autenticar a integração Google.');const body=await response.json();return body.access_token as string;
}
export async function deliverSheetUpdates(s:Awaited<ReturnType<typeof createClient>>,userId:string,taskId?:string){
 if(process.env.GOOGLE_SHEETS_WRITE_ENABLED!=='true')return '';
 let query=s.from('aq_sheet_outbox').select('*').eq('user_id',userId).eq('state','pending').order('updated_at').limit(20);if(taskId)query=query.eq('task_id',taskId);const {data:jobs,error}=await query;if(error||!jobs?.length)return '';
 if(!process.env.GOOGLE_SERVICE_ACCOUNT_JSON||process.env.GOOGLE_SHEETS_OWNER_ID!==userId)return 'Concluída no app. Atualização da planilha pendente de conexão Google.';
 try{
 const token=await accessToken(),base=`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/`;
 const read=async(range:string)=>{const r=await fetch(base+encodeURIComponent(range),{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Não foi possível ler a planilha para atualizar o status.');return (await r.json()).values as string[][];};
 const rows=await read("'Tarefas'!A1:P2000"),head=rows[0]??[];const idCol=head.indexOf('id_tarefa'),statusCol=head.indexOf('status'),ownerCol=head.indexOf('responsavel');if(idCol<0||statusCol<0||ownerCol<0)throw new Error('As colunas da planilha mudaram.');
 const {data:links}=await s.from('aq_sheet_links').select('task_id,external_id').eq('user_id',userId);let failed=0;
 for(const job of jobs){
 const {data:lease,error:claimError}=await s.rpc('aq_sheet_claim',{p_task_id:job.task_id,p_version:job.version});
 if(claimError||!lease){failed++;continue;}
 let ok=false,message='';
 try{
  const external=links?.find(l=>l.task_id===job.task_id)?.external_id;if(!external)throw new Error('Vínculo da tarefa não encontrado.');
  const matches=rows.map((r,i)=>({r,i})).filter(({r})=>r[idCol]===external);if(matches.length!==1)throw new Error('Identificador ausente ou duplicado na planilha.');const rowNo=matches[0].i+1;
  const fresh=(await read(`'Tarefas'!A${rowNo}:P${rowNo}`))[0];if(fresh?.[idCol]!==external||normalize(fresh[ownerCol]??'')!=='alysson campos')throw new Error('A linha mudou ou está atribuída a outra pessoa.');
  // Acknowledge only the version sent; newer local changes remain pending.
  const {data:current}=await s.from('aq_sheet_outbox').select('version').eq('task_id',job.task_id).eq('user_id',userId).single();if(current?.version!==job.version){failed++;continue;}
  if(fresh[statusCol]!==job.desired_status){if(fresh[statusCol]!==job.previous_status)throw new Error('O status mudou na planilha; revise antes de sincronizar.');
   const column=String.fromCharCode(65+statusCol);const response=await fetch(base+encodeURIComponent(`'Tarefas'!${column}${rowNo}`)+'?valueInputOption=RAW',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({values:[[job.desired_status]]}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Google não permitiu atualizar o status.');
  }
  ok=true;
 }catch(e){failed++;message=e instanceof Error?e.message:'Falha na atualização.';}finally{
 const {error:releaseError}=await s.rpc('aq_sheet_release',{p_task_id:job.task_id,p_version:job.version,p_token:lease,p_ok:ok,p_message:message});if(releaseError)failed++;
 }}
 return failed?'Salvo no app. Há atualizações da planilha pendentes; confira a sincronização.':'Status atualizado na planilha.';
 }catch{return 'Salvo no app. A planilha está indisponível; a atualização ficou pendente para nova tentativa.';}
}
