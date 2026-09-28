export const sheetId='1Vj-jlOGcrPvc_Y9nVSdhw0tAKh546VeKQybTOrsZvdE';
export function parseCSV(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('CSV incompleto.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function sheetRows(csv:string,responsible:string){
 const [head,...rows]=parseCSV(csv);if(!head)throw new Error('Planilha vazia.');
 const columns=['id_tarefa','descricao','status','responsavel','prazo','projeto'];if(columns.some(c=>!head.includes(c)))throw new Error('As colunas da planilha mudaram.');
 const norm=(s:string)=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const seen=new Set<string>();return rows.flatMap(row=>{const get=(key:string)=>row[head.indexOf(key)]??'';if(norm(get('responsavel'))!==norm(responsible))return [];const id=get('id_tarefa').trim();if(!id||seen.has(id))return [];seen.add(id);
 const raw=get('prazo').trim();let due:string|null=null;if(/^\d{2}\/\d{2}\/\d{4}$/.test(raw)){const [d,m,y]=raw.split('/');due=`${y}-${m}-${d}`;}else if(/^\d{4}-\d{2}-\d{2}$/.test(raw))due=raw;
 if(due&&(!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))due=null;
 const status=get('status').trim();return [{id,title:get('descricao').trim().slice(0,200),status,active:['pendente','em andamento','em progresso','a fazer'].includes(norm(status)),due,project:get('projeto')}];}).filter(r=>r.title);
}
