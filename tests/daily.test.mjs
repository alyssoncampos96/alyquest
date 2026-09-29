import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Intl,Date});return exports;}
const {taskDayGroup,previousExercise}=load('lib/task-dates.ts');
const {extraAchievements}=load('lib/achievements.ts');
test('daily grouping separates future, overdue, today and unscheduled including year boundaries',()=>{for(const [due_date,expected] of [[null,'unscheduled'],['2026-12-31','overdue'],['2027-01-01','today'],['2027-01-02','future']])assert.equal(taskDayGroup({due_date},'2027-01-01'),expected);});
test('last exercise record ignores empty records and matches normalized exercise names',()=>{assert.equal(previousExercise([{title:'Braços',actual:''},{title:' BRAÇOS ',actual:'3 × 12 / 8 kg'},{title:'Braços',actual:'2 × 12 / 6 kg'}],'braços'),'3 × 12 / 8 kg');assert.equal(previousExercise([],'Esteira'),'');});
test('empty profile does not unlock extra achievements',()=>{assert.equal(extraAchievements([],[],0,0,0,[],[]).filter(a=>a[3]).length,0);});
test('achievements require completed workouts and all checked steps',()=>{const tasks=[{id:'x',status:'pending',due_date:null}];const plans=[{task_id:'x',kind:'workout',steps:[{done:true,actual:'3 km'}]}];let result=extraAchievements(tasks,plans,0,0,0,[],[]);assert.equal(result[3][3],false);assert.equal(result[5][3],false);tasks[0].status='completed';result=extraAchievements(tasks,plans,0,0,0,[],[]);assert.equal(result[3][3],true);assert.equal(result[5][3],true);assert.equal(result[9][3],true);plans[0].steps[0].done=false;assert.equal(extraAchievements(tasks,plans,0,0,0,[],[])[9][3],false);});
test('early completion uses São Paulo date, not UTC date',()=>{const tasks=[{id:'x',status:'completed',due_date:'2026-09-28',completed_at:'2026-09-28T01:00:00Z'}];assert.equal(extraAchievements(tasks,[],0,0,0,[],[])[1][3],true);tasks[0].completed_at='2026-09-28T14:00:00Z';assert.equal(extraAchievements(tasks,[],0,0,0,[],[])[1][3],false);});
test('return achievement requires completion after resuming the linked routine',()=>{const tasks=[{id:'x',status:'completed',completed_at:'2026-09-28T14:00:00Z'}],plans=[{task_id:'x',kind:'task',routine_id:'r',steps:[]}],routines=[{id:'r',resumed_at:'2026-09-28T15:00:00Z'}];assert.equal(extraAchievements(tasks,plans,0,0,0,[],routines)[2][3],false);routines[0].resumed_at='2026-09-28T13:00:00Z';assert.equal(extraAchievements(tasks,plans,0,0,0,[],routines)[2][3],true);});
