import {normalize, validateInventory} from './core.js';

export const STORE = 'fridge-first-v1';
const copy = value => structuredClone(value);
export const uid = () => globalThis.crypto.randomUUID();
const text = (value, max, required = true) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('That saved item is incomplete.');
  return value.trim();
};
export function recipeSnapshot(raw, source = raw?.source, id = raw?.id || uid()) {
  if (!raw || !['sample','gemma'].includes(source) || !Number.isInteger(raw.minutes) || raw.minutes < 1 || raw.minutes > 180 || !Number.isInteger(raw.servings) || raw.servings < 1 || raw.servings > 4 || !Array.isArray(raw.ingredients) || raw.ingredients.length < 2 || raw.ingredients.length > 18 || !Array.isArray(raw.steps) || raw.steps.length < 2 || raw.steps.length > 8) throw new Error('That recipe is incomplete.');
  const ingredients = raw.ingredients.map(i => ({name:text(i.name,80),amount:text(i.amount,80)}));
  if (new Set(ingredients.map(i=>normalize(i.name))).size !== ingredients.length) throw new Error('The recipe has duplicate ingredients.');
  return {id:text(id,100),source,title:text(raw.title,100),description:text(raw.description,350),minutes:raw.minutes,servings:raw.servings,ingredients,steps:raw.steps.map(s=>text(s,550))};
}
export function matchRecipe(recipe, inventory, basics) {
  const stock = new Map(inventory.map(i=>[normalize(i.name),i]));
  const pantry = new Set(basics ? ['oil','salt','pepper','water'] : ['water']);
  const ingredients = recipe.ingredients.map(i => {const item=stock.get(normalize(i.name));return {...i,inStock:!!item||pantry.has(normalize(i.name)),soon:!!item?.soon};});
  return {...recipe,ingredients,missing:ingredients.filter(i=>!i.inStock),soonCount:ingredients.filter(i=>i.soon).length};
}
export function rankRecipes(recipes, inventory, basics, minutes = 180) {
  return recipes.filter(r=>r.minutes<=minutes).map(r=>matchRecipe(r,inventory,basics)).sort((a,b)=>b.soonCount-a.soonCount||a.missing.length-b.missing.length||a.minutes-b.minutes||a.title.localeCompare(b.title));
}
export function emptyState() {return {version:2,inventory:[],minutes:'30',servings:'2',basics:true,revision:0,menu:[],book:[],journal:[],pick:null,invitation:null};}
export function readState(raw) {
  const state=emptyState(),warnings=[];
  if (!raw) return {state,warnings};
  let data;try{data=JSON.parse(raw);if(!data||typeof data!=='object')throw 0;}catch{return {state,warnings:['Your saved data could not be read. It has not been overwritten.']};}
  try{state.inventory=validateInventory(data.inventory??[]);}catch{warnings.push('The saved fridge list could not be read.');}
  if(['15','30','45'].includes(String(data.minutes)))state.minutes=String(data.minutes);
  if(['1','2','3','4'].includes(String(data.servings)))state.servings=String(data.servings);
  state.basics=data.basics!==false;
  state.revision=Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0;
  for(const key of ['menu','book']){
    const seen=new Set();
    const items=Array.isArray(data[key])?data[key]:[],limit=key==='menu'?3:100;
    if(items.length>limit)warnings.push('Some saved recipes exceeded the storage limit and were skipped.');
    for(const rawRecipe of items.slice(0,limit)){try{const recipe=recipeSnapshot(rawRecipe);if(seen.has(recipe.id))continue;seen.add(recipe.id);state[key].push(recipe);}catch{warnings.push('An unreadable recipe was skipped.');}}
  }
  const eventIds=new Set();
  for(const rawEntry of (Array.isArray(data.journal)?data.journal:[]).slice(0,200)){try{
    const entry={id:text(rawEntry.id,100),recipe:recipeSnapshot(rawEntry.recipe),cookedAt:text(rawEntry.cookedAt,40),note:text(rawEntry.note??'',500,false),used:rawEntry.used.map(x=>text(x,80)),patch:[],revisionAfter:rawEntry.revisionAfter};
    if(!Number.isFinite(Date.parse(entry.cookedAt))||!Number.isSafeInteger(entry.revisionAfter))throw 0;
    const names=new Set(entry.recipe.ingredients.map(i=>normalize(i.name)));if(entry.used.some(n=>!names.has(normalize(n))))throw 0;
    for(const p of rawEntry.patch??[]){const before=validateInventory([p.before])[0],after=p.after===null?null:validateInventory([p.after])[0];if(after&&normalize(after.name)!==normalize(before.name))throw 0;entry.patch.push({key:normalize(before.name),before,after});}
    if(!eventIds.has(entry.id)){state.journal.push(entry);eventIds.add(entry.id);}
  }catch{warnings.push('An unreadable supper entry was skipped.');}}
  if(data.pick&&state.menu.some(r=>r.id===data.pick))state.pick=data.pick;
  if(data.invitation){try{state.invitation=makeInvitation(recipeSnapshot(data.invitation.recipe),data.invitation.selected,data.invitation.note);}catch{warnings.push('An unreadable invitation was skipped.');}}
  return {state,warnings:[...new Set(warnings)]};
}
export function persist(storage,state,guard={}) {
  try {
    if(Object.hasOwn(guard,'expected')&&storage.getItem(STORE)!==guard.expected)return {saved:false,conflict:true,message:'Another tab saved newer changes. This tab’s changes are kept for this visit only; the newer saved data has not been overwritten.'};
    if(guard.backup)storage.setItem(guard.backup.key,guard.backup.value);
    const raw=JSON.stringify(state);storage.setItem(STORE,raw);return {saved:true,raw};
  }catch{return {saved:false,message:'Kept for this visit only. Browser storage is unavailable or full; download anything you want to keep.'};}
}
export function setInventory(state, inventory) {return {...state,inventory:validateInventory(inventory),revision:state.revision+1,pick:null};}
function sameRecipe(a,b) {const {id:ai,...av}=a,{id:bi,...bv}=b;return JSON.stringify(av)===JSON.stringify(bv);}
export function saveRecipe(state,recipe) {
  const snapshot=recipeSnapshot(recipe);
  if(state.book.some(r=>r.id===snapshot.id||sameRecipe(r,snapshot)))return state;
  if(state.book.length>=100)throw new Error('Your book has 100 recipes. Remove one before adding another.');
  return {...state,book:[snapshot,...state.book]};
}
export function isSaved(state,recipe){return state.book.some(r=>r.id===recipe.id||sameRecipe(r,recipe));}
export function removeRecipe(state,id) {const index=state.book.findIndex(r=>r.id===id);if(index<0)throw new Error('Recipe not found.');return {state:{...state,book:state.book.filter(r=>r.id!==id)},removed:{recipe:state.book[index],index}};}
export function restoreRecipe(state,removed){if(state.book.some(r=>r.id===removed.recipe.id))return state;if(state.book.length>=100)throw new Error('Your book is full. Remove a recipe before restoring this one.');const book=[...state.book];book.splice(Math.min(removed.index,book.length),0,recipeSnapshot(removed.recipe));return {...state,book};}
export function nextDinner(state) {
  const eligible=rankRecipes(state.menu.filter(r=>r.servings===Number(state.servings)),state.inventory,state.basics,Number(state.minutes));
  if(!eligible.length)throw new Error('None of these recipes fits your time and servings. Adjust those choices or make a new menu.');
  const index=eligible.findIndex(r=>r.id===state.pick);
  return {...state,pick:eligible[(index+1)%eligible.length].id};
}
export function recordMeal(state,recipe,{id=uid(),note='',used=[],changes=[]},now=new Date().toISOString()) {
  if(state.journal.some(e=>e.id===id))return state;
  if(state.journal.length>=200)throw new Error('Your journal has 200 suppers. Remove an old entry before adding another.');
  const snapshot=recipeSnapshot(recipe),names=new Set(snapshot.ingredients.map(i=>normalize(i.name)));
  if(!Array.isArray(used)||used.some(n=>typeof n!=='string'||!names.has(normalize(n))))throw new Error('Choose ingredients from this recipe.');
  const selected=new Set(used.map(normalize)),changeKeys=new Set(),patch=[];
  let inventory=copy(state.inventory);
  for(const change of changes){
    const key=normalize(change.name);
    if(changeKeys.has(key)||!names.has(key)||!selected.has(key))throw new Error('Only confirmed recipe ingredients can update your fridge.');
    changeKeys.add(key);
    const index=inventory.findIndex(i=>normalize(i.name)===key);if(index<0)throw new Error('Your fridge changed. Reopen the cooking check before saving.');
    if(!['keep','remove','edit'].includes(change.action))throw new Error('Choose how much is left.');
    if(change.action==='keep')continue;
    const before=copy(inventory[index]);let after=null;
    if(change.action==='edit'){after={...before,quantity:text(change.quantity,35,false)};inventory[index]=after;}else{inventory.splice(index,1);}
    patch.push({key,before,after});
  }
  const revision=state.revision+1;
  const entry={id:text(id,100),recipe:snapshot,cookedAt:now,note:text(note,500,false),used:[...new Set(used)],patch,revisionAfter:revision};
  return {...state,inventory:validateInventory(inventory),revision,journal:[entry,...state.journal],pick:null};
}
export function undoMeal(state,id) {
  const entry=state.journal.find(e=>e.id===id);if(!entry)throw new Error('That supper entry is no longer here.');
  if(state.revision!==entry.revisionAfter)throw new Error('Your fridge has changed since this supper. Undo would overwrite later edits, so nothing was changed.');
  let inventory=copy(state.inventory);
  for(const patch of entry.patch){const index=inventory.findIndex(i=>normalize(i.name)===patch.key),current=index<0?null:inventory[index];if(JSON.stringify(current)!==JSON.stringify(patch.after))throw new Error('Your fridge has changed. Nothing was undone.');if(index<0)inventory.push(copy(patch.before));else inventory[index]=copy(patch.before);}
  return {...state,inventory:validateInventory(inventory),revision:state.revision+1,journal:state.journal.filter(e=>e.id!==id),pick:null};
}
export function updateNote(state,id,note){if(!state.journal.some(e=>e.id===id))throw new Error('Supper entry not found.');return {...state,journal:state.journal.map(e=>e.id===id?{...e,note:text(note,500,false)}:e)};}
export function deleteEntry(state,id){const entry=state.journal.find(e=>e.id===id);if(!entry)throw new Error('Supper entry not found.');return {state:{...state,journal:state.journal.filter(e=>e.id!==id)},entry};}
export function restoreEntry(state,entry){if(state.journal.some(e=>e.id===entry.id))return state;if(state.journal.length>=200)throw new Error('Your journal is full. Remove an entry before restoring this one.');return {...state,journal:[entry,...state.journal].sort((a,b)=>b.cookedAt.localeCompare(a.cookedAt))};}
export function makeInvitation(recipe,selected,note=''){
  const snapshot=recipeSnapshot(recipe);
  if(!Array.isArray(selected)||selected.some(n=>typeof n!=='string'||!snapshot.ingredients.some(i=>normalize(i.name)===normalize(n))))throw new Error('Choose ingredients from the recipe.');
  return {recipe:snapshot,selected:[...new Set(selected.map(normalize))],note:text(note,500,false)};
}
export function recipeText(recipe){return `${recipe.title}\n${recipe.source==='sample'?'Prepared sample recipe':'Gemma recipe'} · ${recipe.minutes} minutes · ${recipe.servings} servings\n\nIngredients\n${recipe.ingredients.map(i=>`${i.amount} ${i.name}`).join('\n')}\n\nMethod\n${recipe.steps.map((s,i)=>`${i+1}. ${s}`).join('\n\n')}`;}
export function invitationText(draft){const selected=draft.recipe.ingredients.filter(i=>draft.selected.includes(normalize(i.name)));return `Dinner together?\n\nI’ll make ${draft.recipe.title}.\n${selected.length?'Could you bring:\n'+selected.map(i=>`${i.amount} ${i.name}`).join('\n'):'Just bring yourself.'}${draft.note?'\n\n'+draft.note:''}\n\n— The full recipe —\n${recipeText(draft.recipe)}`;}
export function postcardText(entry){return `A little of tonight.\n${entry.recipe.title}\n${new Date(entry.cookedAt).toLocaleDateString(undefined,{dateStyle:'long'})}\n${entry.used.length?'Made with: '+entry.used.join(', '):'Ingredients not recorded.'}${entry.note?'\n\n'+entry.note:''}\n\n${recipeText(entry.recipe)}`;}
