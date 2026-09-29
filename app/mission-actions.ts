"use server";
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import {deliverSheetUpdates} from '@/lib/sheet-write';
async function rpc(name:string,args:Record<string,unknown>){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error('Entre novamente.');const {data,error}=await s.rpc(name,args);if(error)throw new Error(error.code==='P0001'?error.message:'Não foi possível salvar. Tente novamente.');return {s,user,data};}
function refresh(){['/','/tasks','/workouts','/bosses','/achievements','/shop','/focus'].forEach(p=>revalidatePath(p));}
export async function finishMission(id:string){const {s,user,data}=await rpc('aq_finish_mission',{p_task_id:id});const sheet=await deliverSheetUpdates(s,user.id,id);refresh();return {...data,sheet};}
export async function undoMission(id:string){const {s,user}=await rpc('aq_undo_mission',{p_event_id:id});const sheet=await deliverSheetUpdates(s,user.id);refresh();return sheet;}
export async function changeTaskState(id:string,action:string,date?:string){await rpc('aq_task_state',{p_task_id:id,p_action:action,p_date:date||null});refresh();}
