import test from 'node:test';
import assert from 'node:assert/strict';
import {EXAMPLE,DEMO,prepareRecipes} from '../dist/core.js';
import {emptyState,recipeSnapshot,readState,matchRecipe,setInventory,saveRecipe,isSaved,removeRecipe,restoreRecipe,nextDinner,recordMeal,undoMeal,updateNote,deleteEntry,restoreEntry,makeInvitation,invitationText,postcardText,persist,STORE} from '../dist/journal.js';
import {addList,parseList} from '../dist/entry.js';
import {wrapLines,postcardContent,invitationContent,drawCard} from '../dist/cards.js';
const options={minutes:30,servings:2,basics:true};
function fixture(){const menu=prepareRecipes(structuredClone(DEMO),EXAMPLE,options).map((r,i)=>recipeSnapshot(r,'sample','recipe-'+i));return {...emptyState(),inventory:structuredClone(EXAMPLE),menu};}
const reload=state=>readState(JSON.stringify(state)).state;
test('one-field entry understands common quantities, pasted lines and punctuation',()=>{
  assert.deepEqual(parseList('2 eggs, spinach, half a bag of rice'),[{name:'Eggs',quantity:'2',soon:false},{name:'Spinach',quantity:'',soon:false},{name:'Rice',quantity:'half a bag',soon:false}]);
  const items=parseList('• 400g tomatoes; 1/2 onion\nYogurt (1 pot)\npaneer 200 g\n2% milk');
  assert.deepEqual(items.map(i=>i.quantity),['400g','1/2','1 pot','200 g','']);
  assert.equal(items.at(-1).name,'2% milk');
});
test('duplicate entry skips only duplicates, preserves current quantities, and fails oversized batches atomically',()=>{
  const start=[{name:'Eggs',quantity:'6',soon:true}];
  const result=addList(start,'2 eggs, spinach, spinach, 1 tomato');
  assert.deepEqual(result.added,['Spinach','Tomatoes']);assert.deepEqual(result.skipped,['Eggs','Spinach']);
  assert.deepEqual(result.inventory[0],start[0]);assert.equal(start.length,1);
  assert.throws(()=>addList(start,Array.from({length:17},(_,i)=>'item '+i).join(',')));
  assert.equal(start.length,1);assert.throws(()=>parseList(' , ; \n'));
});
test('recipe book survives reload and fridge changes; availability is recomputed',()=>{
  let state=fixture(),recipe=state.menu[0];
  state=saveRecipe(state,recipe);state=saveRecipe(state,recipe);assert.equal(state.book.length,1);
  state=saveRecipe(state,{...recipe,id:'duplicate-content'});assert.equal(state.book.length,1);
  state=reload(setInventory(state,state.inventory.filter(i=>i.name!=='Spinach')));
  assert.equal(state.book[0].source,'sample');assert.deepEqual(state.book[0].steps,recipe.steps);
  assert.equal(matchRecipe(state.book[0],state.inventory,state.basics).missing.some(i=>i.name==='Spinach'),true);
  assert.equal(state.menu.length,3);assert.equal(isSaved(state,recipe),true);
  const removal=removeRecipe(state,recipe.id);assert.equal(removal.state.book.length,0);assert.equal(restoreRecipe(removal.state,removal.removed).book.length,1);
});
test('dinner pick respects current urgency, time and servings, cycles and survives reload',()=>{
  let state=fixture();state=setInventory(state,state.inventory.map(i=>({...i,soon:i.name==='Yogurt'})));
  state=nextDinner(state);assert.match(state.menu.find(r=>r.id===state.pick).title,/yogurt/i);
  const first=state.pick;state=reload(state);assert.equal(state.pick,first);
  state=nextDinner(state);assert.notEqual(state.pick,first);state=nextDinner(state);state=nextDinner(state);assert.equal(state.pick,first);
  state={...state,minutes:'15',pick:null};state=nextDinner(state);assert.equal(state.menu.find(r=>r.id===state.pick).minutes,15);
  assert.throws(()=>nextDinner({...state,servings:'4'}));
});
test('complete meal flow: keep/remove/edit, reload, postcard note and safe undo',()=>{
  const start=fixture(),recipe=start.menu.find(r=>r.title.includes('skillet'));
  let state=recordMeal(start,recipe,{id:'cooked-1',used:['Spinach','Tomatoes','Eggs'],note:'More pepper next time.',changes:[{name:'Spinach',action:'remove'},{name:'Tomatoes',action:'edit',quantity:'2 left'},{name:'Eggs',action:'keep'}]},'2026-10-05T10:00:00.000Z');
  assert.equal(state.inventory.some(i=>i.name==='Spinach'),false);assert.equal(state.inventory.find(i=>i.name==='Tomatoes').quantity,'2 left');assert.equal(state.inventory.find(i=>i.name==='Eggs').quantity,'6');
  state=recordMeal(state,recipe,{id:'cooked-1',used:[],changes:[]});assert.equal(state.journal.length,1);
  state=reload(state);state=updateNote(state,'cooked-1','Less salt next time.');state=reload(state);
  assert.equal(state.journal[0].note,'Less salt next time.');assert.match(postcardText(state.journal[0]),/Less salt next time/);assert.match(postcardText(state.journal[0]),/Prepared sample recipe/);
  assert.equal(postcardContent(state.journal[0]).note,'Less salt next time.');
  state=undoMeal(state,'cooked-1');assert.deepEqual([...state.inventory].sort((a,b)=>a.name.localeCompare(b.name)),[...start.inventory].sort((a,b)=>a.name.localeCompare(b.name)));assert.equal(state.journal.length,0);assert.throws(()=>undoMeal(state,'cooked-1'));
});
test('later fridge edits block undo without losing the edit or journal entry',()=>{
  let state=fixture();state=recordMeal(state,state.menu[0],{id:'cooked',used:['Spinach'],changes:[{name:'Spinach',action:'remove'}]});
  state=setInventory(state,[...state.inventory,{name:'Bread',quantity:'1 loaf',soon:false}]);
  const before=JSON.stringify(state);assert.throws(()=>undoMeal(state,'cooked'),/later edits/);assert.equal(JSON.stringify(state),before);
});
test('cooking same recipe twice intentionally creates two entries; stale prior undo fails',()=>{
  let state=fixture();state=recordMeal(state,state.menu[0],{id:'one'});state=recordMeal(state,state.menu[0],{id:'two'});assert.equal(state.journal.length,2);assert.throws(()=>undoMeal(state,'one'));
});
test('sample cooking uses actual inventory, unconfirmed inputs cannot mutate stock, and deleting an entry never changes fridge',()=>{
  let state=fixture();state=setInventory(state,[]);state=recordMeal(state,state.menu[0],{id:'example-cooked',used:['Eggs'],changes:[]});assert.deepEqual(state.inventory,[]);
  assert.throws(()=>recordMeal(fixture(),state.menu[0],{id:'bad',used:[],changes:[{name:'Spinach',action:'remove'}]}));
  const result=deleteEntry(state,'example-cooked');assert.deepEqual(result.state.inventory,[]);assert.equal(result.state.journal.length,0);assert.throws(()=>undoMeal(result.state,'example-cooked'));
  assert.equal(restoreEntry(result.state,result.entry).journal.length,1);
});
test('invitation survives reload and contains only selected requests plus full recipe',()=>{
  let state=fixture();const recipe=state.menu.find(r=>r.title.includes('omelette'));
  state={...state,invitation:makeInvitation(recipe,['Yogurt'],'Friday at 7?')};state=reload(state);
  const text=invitationText(state.invitation),request=text.split('— The full recipe —')[0];assert.match(request,/4 tablespoons Yogurt/);assert.doesNotMatch(request,/oil|salt|pepper/);assert.match(text,/Method/);assert.ok(text.includes(recipe.steps.at(-1)));assert.match(text,/Prepared sample recipe/);assert.equal(invitationContent(state.invitation).note,'Friday at 7?');
  assert.match(invitationText(makeInvitation(recipe,[],'')),/Just bring yourself/);assert.throws(()=>makeInvitation(recipe,['Chocolate'],''));
});
test('failed storage keeps state usable and reports non-persistence',()=>{
  const state=saveRecipe(fixture(),fixture().menu[0]);const before=JSON.stringify(state);
  const result=persist({setItem(){throw new Error('Quota exceeded');}},state);assert.equal(result.saved,false);assert.match(result.message,/visit only/);assert.equal(JSON.stringify(state),before);
  const storage=new Map();assert.equal(persist({setItem:(k,v)=>storage.set(k,v)},state).saved,true);assert.equal(readState(storage.get(STORE)).state.book.length,1);
});
test('stale tab cannot overwrite newer saved kitchen data',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const base=fixture(),first=persist(storage,base,{expected:null});assert.equal(first.saved,true);
  const newer=saveRecipe(base,base.menu[0]),saved=persist(storage,newer,{expected:first.raw});assert.equal(saved.saved,true);
  const stale=persist(storage,{...base,minutes:'15'},{expected:first.raw});assert.equal(stale.saved,false);assert.equal(stale.conflict,true);
  assert.equal(readState(storage.getItem(STORE)).state.book.length,1);assert.equal(storage.getItem(STORE),saved.raw);
});
test('recovery backs up original data before replacement and backup failure leaves original untouched',()=>{
  const raw='{unreadable',values=new Map([[STORE,raw]]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const fixed=readState(raw).state;
  const saved=persist(storage,fixed,{expected:raw,backup:{key:'recovery-copy',value:raw}});assert.equal(saved.saved,true);assert.equal(values.get('recovery-copy'),raw);
  let writes=0;const full={getItem:()=>raw,setItem(){writes++;throw new Error('Full');}};
  assert.equal(persist(full,fixed,{expected:raw,backup:{key:'recovery-copy',value:raw}}).saved,false);assert.equal(writes,1);assert.equal(full.getItem(STORE),raw);
});
test('numbered pasted lists and labelled quantities are accepted',()=>{
  assert.deepEqual(parseList('1. Eggs\n2) Spinach: 1 bag\n[x] Rice | 1 cup').map(i=>[i.name,i.quantity]),[['Eggs',''],['Spinach','1 bag'],['Rice','1 cup']]);
});
test('legacy list migrates; corrupt optional data does not discard valid fridge or recipes',()=>{
  const valid=fixture();const {state,warnings}=readState(JSON.stringify({inventory:EXAMPLE,minutes:15,servings:2,book:[valid.menu[0],{broken:true}],journal:[{}]}));assert.equal(state.minutes,'15');assert.deepEqual(state.inventory,EXAMPLE);assert.equal(state.book.length,1);assert.ok(warnings.length);assert.equal(readState('{').state.inventory.length,0);
});
test('export wrapping fits long titles and unbroken text without clipping',()=>{
  const measure=t=>t.length*10;
  for(const line of wrapLines('Very long supper title\n'+('x'.repeat(220)),180,measure))assert.ok(measure(line)<=180);
  const drawn=[];const ctx={font:'',measureText:t=>({width:t.length*20}),fillRect(){},strokeRect(){},fillText(text,x,y){drawn.push({text,x,y});}};
  const canvas={getContext:()=>ctx,setAttribute(){}};drawCard({eyebrow:'SUPPER',title:'x'.repeat(100),subtitle:'Today',body:'Spinach',note:'n'.repeat(500),source:'sample'},canvas);
  assert.ok(canvas.height>720);assert.ok(drawn.every(item=>item.y<canvas.height));assert.ok(drawn.some(item=>item.text==='Prepared sample recipe'));assert.throws(()=>drawCard({}, {getContext:()=>null}),/text download/);
});
