import {EXAMPLE,DEMO,validateInventory,prepareRecipes,normalize} from './core.js';
import {STORE,uid,recipeSnapshot,matchRecipe,rankRecipes,readState,persist,setInventory,saveRecipe,isSaved,removeRecipe,restoreRecipe,nextDinner,recordMeal,undoMeal,updateNote,deleteEntry,restoreEntry,makeInvitation,recipeText,invitationText,postcardText} from './journal.js';
import {addList} from './entry.js';
import {drawCard,postcardContent,invitationContent,downloadImage,downloadText} from './cards.js';
const $=id=>document.getElementById(id);
let loaded,storage,expectedRaw=null,syncBlocked=false;
try{storage=localStorage;expectedRaw=storage.getItem(STORE);loaded=readState(expectedRaw);}catch{loaded=readState(null);loaded.warnings.push('Browser storage is unavailable. Changes will last for this visit only.');}
let recoveryBackup=loaded.warnings.length&&expectedRaw?{key:STORE+'-recovery-'+uid(),value:expectedRaw}:null;
let state=loaded.state,view='menu',busy=false,worker,requestTimer,elapsedTimer,requestStarted=0,runId=0,lastSaveOK=true;
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,cls,action)=>{const node=el('button',cls,text);node.type='button';node.onclick=action;return node;};
const provenance=recipe=>recipe.source==='sample'?'Prepared sample recipe':'Gemma recipe';
const settings=()=>({minutes:Number(state.minutes),servings:Number(state.servings),basics:state.basics});
function showError(message){$('error').textContent=message;$('error').hidden=!message;}
function flash(message,action,label='Undo'){
  $('notice').hidden=false;$('notice-text').textContent=message;$('notice-action').hidden=!action;$('notice-action').textContent=label;
  $('notice-action').onclick=()=>{try{action();}catch(error){flash(error.message);}};
}
$('notice-dismiss').onclick=()=>$('notice').hidden=true;
function persistCurrent(){const result=persist(storage,state,{expected:expectedRaw,backup:recoveryBackup});lastSaveOK=result.saved;if(result.saved){expectedRaw=result.raw;recoveryBackup=null;}if(result.conflict){syncBlocked=true;$('sync-note').hidden=false;}$('storage-note').textContent=result.saved?'Your fridge, recipes and suppers are saved on this browser.':result.message;return result.saved;}
window.addEventListener('storage',event=>{if((event.key===STORE||event.key===null)&&event.newValue!==expectedRaw){syncBlocked=true;$('sync-note').hidden=false;flash('Another tab changed the kitchen. Reload the latest saved data before recording or undoing a supper.');}});
$('reload-saved').onclick=()=>location.reload();
$('export-session').onclick=()=>downloadText(JSON.stringify(state,null,2),'fridge-first-session-backup');
function commit(next){state=next;persistCurrent();render();}
function savedMessage(message){return lastSaveOK?message:message+' Kept for this visit only; download it to keep a copy.';}
function updateInventory(items){commit(setInventory(state,items));showError('');}
function syncControls(){$('minutes').value=state.minutes;$('servings').value=state.servings;$('basics').checked=state.basics;}
function renderInventory(){
  $('inventory').replaceChildren();$('count').textContent=state.inventory.length;$('inventory-empty').hidden=!!state.inventory.length;$('example').hidden=!!state.inventory.length;
  state.inventory.forEach((item,index)=>{
    const row=el('li'),name=el('div','ingredient-name',item.name);if(item.quantity)name.append(el('small','',item.quantity));
    const soon=button(item.soon?'✓':'','soon-toggle',()=>{const next=structuredClone(state.inventory);next[index].soon=!item.soon;updateInventory(next);});soon.setAttribute('aria-label',`Use ${item.name} first`);soon.setAttribute('aria-pressed',String(item.soon));soon.disabled=busy;
    const remove=button('×','remove',()=>{const removed=state.inventory[index];updateInventory(state.inventory.filter((_,i)=>i!==index));const revision=state.revision;flash(`${item.name} removed.`,()=>{if(state.revision!==revision)throw new Error('Your fridge has changed since then. Add the ingredient again to keep later edits.');const next=[...state.inventory];next.splice(index,0,removed);updateInventory(next);flash(`${item.name} is back.`);});});remove.setAttribute('aria-label',`Remove ${item.name}`);remove.disabled=busy;row.append(name,soon,remove);$('inventory').append(row);
  });
  $('quick-add').replaceChildren(el('span','quick-label','Or tap:'));
  for(const name of ['Eggs','Spinach','Tomatoes','Rice','Onion','Yogurt']){const exists=state.inventory.some(i=>normalize(i.name)===normalize(name));const chip=button(exists?`${name} ✓`:name,'quick-chip',()=>addIngredients(name));chip.disabled=busy||exists;$('quick-add').append(chip);}
}
function addIngredients(value){try{const result=addList(state.inventory,value);updateInventory(result.inventory);$('ingredient').value='';const message=[result.added.length?`${result.added.length===1?result.added[0]:result.added.length+' ingredients'} added.`:'',result.skipped.length?`Already listed: ${result.skipped.join(', ')}.`:''].filter(Boolean).join(' ');flash(lastSaveOK?message:message+' This visit only.');$('ingredient').focus();}catch(error){showError(error.message);}}
$('add-form').onsubmit=event=>{event.preventDefault();addIngredients($('ingredient').value);};
$('ingredient').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!busy)addIngredients($('ingredient').value);}};
$('example').onclick=()=>{commit({...setInventory(state,EXAMPLE.map(i=>({...i}))),minutes:'30',servings:'2',basics:true});showError('');flash('Example ingredients added. You can change any of them.');};
for(const id of ['minutes','servings','basics'])$(id).onchange=()=>{commit({...state,minutes:$('minutes').value,servings:$('servings').value,basics:$('basics').checked,pick:null});};
function selectView(next){view=next;renderMain();}
for(const name of ['menu','book','journal'])$('tab-'+name).onclick=()=>selectView(name);
function render(){syncControls();renderInventory();renderMain();renderHome();$('book-count').textContent=state.book.length;$('journal-count').textContent=state.journal.length;$('resume-invite').hidden=!state.invitation;}
function renderHome(){
  $('home-pick-detail').textContent=state.pick?'Dinner chosen. Have a look.':state.menu.length?`${state.menu.length} ideas, one easy choice`:'One less decision tonight';
  $('home-book-detail').textContent=state.book.length?`${state.book.length} recipe${state.book.length===1?'':'s'} worth keeping`:'The ones you’ll make again';
  $('home-postcard-detail').textContent=state.journal.length?`${state.journal.length} supper${state.journal.length===1?'':'s'} to remember`:'Keep a little of the evening';
  $('home-invite-detail').textContent=state.invitation?'Your draft is waiting':'You bring one thing. I’ll cook.';
}
function focusKitchen(){document.querySelector('.meals').scrollIntoView({block:'start',behavior:'auto'});}
function chooseRecipe(title,action){
  const box=beginModal(title),seen=new Set(),choices=[...state.menu,...state.book,...state.journal.map(e=>e.recipe)].filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;});
  if(!choices.length){box.append(el('p','detail-copy','Every supper starts somewhere. Find something to cook, then come back to leave a note or invite someone over.'));box.append(button('Browse sample recipes','small-primary',()=>{loadSampleMenu();chooseRecipe(title,action);}));return;}
  box.append(el('p','quiet','Something new, or an old favourite? Choose a recipe below.'));
  const list=el('div','recipe-chooser');
  for(const recipe of choices){const choice=button('','recipe-choice',()=>action(recipe));choice.append(el('strong','',recipe.title),el('span','',`${recipe.minutes} min · ${recipe.servings} servings · ${provenance(recipe)}`));list.append(choice);}box.append(list);
}
$('home-book').onclick=()=>{selectView('book');focusKitchen();};
$('home-cooked').onclick=()=>chooseRecipe('What did you make?',openCook);
$('home-invite').onclick=()=>{if(state.invitation)openInvite(state.invitation.recipe,state.invitation);else chooseRecipe('What shall we cook together?',openInvite);};
$('home-postcard').onclick=()=>{
  if(state.journal.length){selectView('journal');focusKitchen();openPostcard(state.journal[0].id);}
  else {const box=beginModal('Keep a little of the evening.', 'postcard');box.append(el('p','detail-copy','What you cooked. How it went. A few words you’ll be glad you kept. Your supper notes become little postcards to save or send.'),button('I’ve cooked something','small-primary',()=>chooseRecipe('What did you make?',openCook)));}
};
$('home-pick').onclick=()=>{
  const pick=()=>{try{view='menu';commit(nextDinner(state));$('recipe-dialog').close();focusKitchen();}catch(error){flash(error.message);}};
  if(state.menu.length){pick();return;}
  const box=beginModal('Let’s find tonight’s dinner.');box.append(el('p','detail-copy','Some nights, choosing is the hard part. Start with what you have, revisit a recipe you kept, or look through an example menu.'));
  const actions=el('div','action-row');actions.append(button('Back to my ingredients','small-primary',()=>{$('recipe-dialog').close();$('ingredient').focus();}));
  if(state.book.length)actions.append(button('Choose from my book','secondary-button',()=>{commit({...state,menu:state.book.slice(0,3),pick:null});pick();}));
  actions.append(button('Try a sample dinner for two','text-button',()=>{loadSampleMenu();commit({...state,servings:'2',minutes:'30'});pick();}));box.append(actions);
};
function renderMain(){
  document.querySelector('.meals').dataset.view=view;
  $('view-kicker').textContent={menu:'A place at your table',book:'Collected, cooked, made your own',journal:'From evenings in your kitchen'}[view];
  for(const name of ['menu','book','journal'])$('tab-'+name).setAttribute('aria-pressed',String(view===name));
  $('recipes').replaceChildren();$('welcome').hidden=true;$('pick-tools').hidden=true;$('dinner-pick').hidden=true;$('result-message').hidden=true;$('recipe-note').hidden=true;$('result-label').textContent='';
  if(view==='journal'){renderJournal();return;}
  if(view==='book'){
    $('meals-title').textContent='Your kind of cooking';$('result-label').textContent=`${state.book.length} recipes`;
    if(!state.book.length){const empty=el('div','notebook-empty');empty.append(el('h3','','Soon, this will feel like your cooking.'),el('p','','Keep a recipe you like. Come back to it, make it your own, and let this little book grow with you. Choose “Keep this recipe” inside any recipe to start.'));$('recipes').append(empty);return;}
    message('Come back to an old favourite. Your notes are here, and the ingredient list checks what’s in your fridge today. Recipe quantities stay as saved.');
    state.book.map(r=>matchRecipe(r,state.inventory,state.basics)).forEach((recipe,index)=>renderRecipeCard(recipe,index,true));return;
  }
  if(!state.menu.length){$('welcome').hidden=false;$('meals-title').textContent='Make yourself something good';return;}
  const isSample=state.menu.every(r=>r.source==='sample');$('meals-title').textContent=isSample?'A taste of what’s possible':'Something good for tonight';$('result-label').textContent=isSample?'Sample recipes':'Your menu';
  message(isSample?'Three sample recipes to look around with. The ingredients below are checked against your fridge list.':'Start with the things waiting to be used. These recipes stay here for you; we’ll check the ingredients as your fridge changes.');
  const portionMismatch=state.menu.some(r=>r.servings!==Number(state.servings));if(portionMismatch)$('result-message').append(el('span','menu-caveat',` These recipes keep their original servings. Generate a new menu for ${state.servings} people.`));
  $('pick-tools').hidden=false;$('recipe-note').hidden=false;
  const ranked=rankRecipes(state.menu,state.inventory,state.basics);ranked.forEach((recipe,index)=>renderRecipeCard(recipe,index));
  const picked=ranked.find(r=>r.id===state.pick);if(picked)renderPick(picked);
}
function message(text){$('result-message').hidden=false;$('result-message').textContent=text;}
function appendCookingMemory(parent,recipe){
  const entries=state.journal.filter(entry=>entry.recipe.id===recipe.id),lastNote=entries.find(entry=>entry.note);
  if(!entries.length)return;
  const memory=el('aside','cooking-memory');
  memory.append(el('p','memory-label',entries.length===1?'You’ve made this before':`Made in your kitchen ${entries.length} times`));
  if(lastNote){memory.append(el('p','memory-note',lastNote.note),el('span','source-label','Your note · '+new Date(lastNote.cookedAt).toLocaleDateString(undefined,{dateStyle:'medium'})));}
  else memory.append(el('p','memory-note','Ready for another evening?'));
  parent.append(memory);
}
function renderRecipeCard(recipe,index,inBook=false){
  const card=el('article',inBook?'recipe-card kept-recipe':'recipe-card'),top=el('div','recipe-top');top.append(el('span','recipe-number',`No. ${index+1}`));if(recipe.soonCount)top.append(el('span','priority-badge',`Uses ${recipe.soonCount} from your “use first” list`));card.append(top,el('h3','',recipe.title),el('p','recipe-description',recipe.description));
  const meta=el('div','recipe-meta');meta.append(el('span','',`${recipe.minutes} min`),el('span','',`${recipe.servings} servings`),el('span','source-label',provenance(recipe)));card.append(meta);appendCookingMemory(card,recipe);
  const tags=el('div','ingredient-tags');recipe.ingredients.filter(i=>i.inStock&&!['oil','salt','pepper','water'].includes(normalize(i.name))).forEach(i=>tags.append(el('span',`tag${i.soon?' soon':''}`,i.name)));card.append(tags);
  if(recipe.missing.length)card.append(el('p','missing',`You'll also need: ${recipe.missing.map(i=>i.name).join(', ')}`));
  const bottom=el('div','card-bottom');bottom.append(el('p','',recipe.missing.length?`${recipe.missing.length} extra ingredient${recipe.missing.length===1?'':'s'}`:'You’ve got the ingredients'),button('Let’s make this','recipe-link',()=>openRecipe(recipe)));
  card.append(bottom);if(inBook)card.append(button('Remove from book','text-button subdued',()=>{const result=removeRecipe(state,recipe.id);commit(result.state);flash('Recipe removed from your book.',()=>{commit(restoreRecipe(state,result.removed));flash(savedMessage('Recipe restored.'));});}));$('recipes').append(card);
}
function loadSampleMenu(){const menu=prepareRecipes(DEMO,EXAMPLE,{minutes:30,servings:2,basics:true}).map(r=>recipeSnapshot(r,'sample'));commit({...state,menu,pick:null});selectView('menu');}
$('demo').onclick=loadSampleMenu;
$('pick-dinner').onclick=()=>{try{commit(nextDinner(state));}catch(error){flash(error.message);}};
function renderPick(recipe){const box=$('dinner-pick');box.hidden=false;box.replaceChildren(el('p','hand-label','One less thing to think about.'),el('h3','',recipe.title));box.append(el('p','quiet',`${recipe.minutes} minutes · ${recipe.servings} servings · ${provenance(recipe)}. ${recipe.soonCount?'Uses '+recipe.soonCount+' of your use-first ingredients.':'Fewer extras and a shorter cooking time helped decide.'}`));if(recipe.missing.length)box.append(el('p','missing',`Still needed: ${recipe.missing.map(i=>i.name).join(', ')}`));const actions=el('div','action-row');actions.append(button('Cook this','small-primary',()=>openRecipe(recipe)),button('Something else','text-button',()=>{try{commit(nextDinner(state));}catch(error){flash(error.message);}}));box.append(actions);}
function beginModal(title,kind='recipe'){const dialog=$('recipe-dialog');dialog.dataset.view=kind;$('modal-kicker').textContent={recipe:'From your kitchen',cook:'A page in your supper notes',postcard:'A little something to keep',invite:'There’s room for one more'}[kind];const box=$('recipe-detail');box.replaceChildren();const heading=el('h2','',title);heading.id='modal-title';box.append(heading);if(!$('recipe-dialog').open)$('recipe-dialog').showModal();$('recipe-dialog').scrollTop=0;return box;}
function modalError(error){const existing=$('modal-error');existing?.remove();const node=el('p','error',error.message||String(error));node.id='modal-error';node.setAttribute('role','alert');$('recipe-detail').append(node);}
$('close-dialog').onclick=()=>$('recipe-dialog').close();
$('recipe-dialog').onclick=event=>{if(event.target!==$('recipe-dialog'))return;const r=$('recipe-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('recipe-dialog').close();};
function openRecipe(raw){
  const snapshot=recipeSnapshot(raw),recipe=matchRecipe(snapshot,state.inventory,state.basics),box=beginModal(recipe.title);
  box.append(el('p','detail-copy',recipe.description),el('p','recipe-meta',`${recipe.minutes} minutes · ${recipe.servings} servings · ${provenance(recipe)}`));
  const actions=el('div','action-row');const keep=button(isSaved(state,snapshot)?'In your recipe book ✓':'Keep this recipe','small-primary',()=>{try{commit(saveRecipe(state,snapshot));keep.textContent='In your recipe book ✓';keep.disabled=true;flash(savedMessage('Kept in your recipe book.'));}catch(error){modalError(error);}});keep.disabled=isSaved(state,snapshot);
  const made=button('I made this','secondary-button mutates-fridge',()=>openCook(snapshot));made.disabled=busy;actions.append(keep,made,button('Invite a friend','text-button',()=>openInvite(snapshot)));box.append(actions);appendCookingMemory(box,snapshot);box.append(el('h3','','What goes in'));
  const list=el('ul','detail-ingredients');recipe.ingredients.forEach(item=>{const row=el('li'),label=el('span','',item.name);if(!item.inStock)label.append(el('small','','Not on your fridge list'));else if(item.soon)label.append(el('small','','Use first'));row.append(label,el('span','',item.amount));list.append(row);});box.append(list,el('h3','','How to make it'));const steps=el('ol','steps');recipe.steps.forEach(step=>steps.append(el('li','',step)));box.append(steps,el('p','quiet','Check quantities against what you have. Cooking times are estimates.'),button('Download full recipe','text-button',()=>downloadText(recipeText(snapshot),'fridge-first-recipe')));
}
function openCook(snapshot){
  if(busy){flash('Let Gemma finish before updating the fridge.');return;}
  if(syncBlocked){flash('Another tab changed your kitchen. Reload the latest saved data first.');return;}
  const revision=state.revision,eventId=uid(),box=beginModal('How did it turn out?', 'cook'),form=el('form','cook-form');
  box.append(el('p','detail-copy',snapshot.title),el('p','source-label',provenance(snapshot)));
  const noteLabel=el('label','field-label','Anything you’d like to remember? (optional)'),note=document.createElement('textarea');note.id='cook-note';note.maxLength=500;note.rows=3;note.placeholder='Extra lemon was a good idea. Ate it standing by the stove.';noteLabel.htmlFor=note.id;
  form.append(noteLabel,note,el('p','quiet','A tweak for next time, who came over, or just how your evening went. A blank page is fine too.'));
  const leftovers=el('details','leftovers'),summary=el('summary','','What did you use?');leftovers.append(summary,el('p','quiet','Untick anything you skipped. If you finished an ingredient, you can take it off the fridge list here. Otherwise the list stays as it is.'));
  const rows=[];
  snapshot.ingredients.forEach((item,index)=>{
    const row=el('div','cook-row'),label=el('label','cook-used'),check=document.createElement('input');check.type='checkbox';check.checked=true;label.append(check,document.createTextNode(item.name));row.append(label);
    const stock=state.inventory.find(i=>normalize(i.name)===normalize(item.name));let select,quantity;
    if(stock){row.append(el('p','quiet',`In the fridge: ${stock.quantity||'quantity not noted'}`));select=document.createElement('select');select.setAttribute('aria-label',`What is left of ${item.name}?`);for(const [value,title] of [['keep','Keep as it is'],['remove','Used it all'],['edit','Change what’s left']]){const option=el('option','',title);option.value=value;select.append(option);}quantity=document.createElement('input');quantity.type='text';quantity.maxLength=35;quantity.value=stock.quantity;quantity.placeholder='e.g. half a bag';quantity.setAttribute('aria-label',`Remaining ${item.name}`);quantity.hidden=true;select.onchange=()=>quantity.hidden=select.value!=='edit';check.onchange=()=>{select.disabled=!check.checked;quantity.disabled=!check.checked;};row.append(select,quantity);}else row.append(el('p','quiet','Not on your current fridge list.'));
    rows.push({item,check,select,quantity});leftovers.append(row);
  });
  const submit=el('button','primary','Keep this supper');submit.type='submit';const actions=el('div','action-row');actions.append(submit,button('Back to recipe','text-button',()=>openRecipe(snapshot)));form.append(leftovers,actions);box.append(form);
  form.onsubmit=event=>{event.preventDefault();submit.disabled=true;try{if(syncBlocked)throw new Error('Another tab changed your kitchen. Reload the latest saved data first.');if(state.revision!==revision)throw new Error('Your fridge changed while this was open. Go back and reopen this check.');const used=rows.filter(r=>r.check.checked).map(r=>r.item.name),changes=rows.filter(r=>r.check.checked&&r.select).map(r=>({name:r.item.name,action:r.select.value,quantity:r.quantity.value}));const next=recordMeal(state,snapshot,{id:eventId,used,changes,note:note.value});commit(next);view='journal';renderMain();openPostcard(eventId);flash(savedMessage('A page from tonight, kept for you.'),()=>undoCooking(eventId));}catch(error){submit.disabled=false;modalError(error);}};
}
function undoCooking(id){if(syncBlocked)throw new Error('Another tab changed your kitchen. Reload the latest saved data before undoing.');commit(undoMeal(state,id));$('recipe-dialog').close();flash(savedMessage('Supper undone. Your fridge is back as it was.'));}
function renderJournal(){
  $('meals-title').textContent='The dinners you’ve made';$('result-label').textContent=`${state.journal.length} supper${state.journal.length===1?'':'s'}`;
  if(!state.journal.length){const empty=el('div','notebook-empty');empty.append(el('h3','','The dinners worth a little note.'),el('p','','More chilli next time. Good with toast. Made it for two. After cooking, choose “I made this” in the recipe to keep a small piece of the evening.'));$('recipes').append(empty);return;}
  for(const entry of state.journal){const card=el('article','journal-card');card.append(el('p','hand-label',new Date(entry.cookedAt).toLocaleDateString(undefined,{dateStyle:'medium'})),el('h3','',entry.recipe.title),el('p','source-label',provenance(entry.recipe)));if(entry.note)card.append(el('p','journal-note',entry.note));else card.append(button('Add a few words about tonight','text-button empty-note',()=>openPostcard(entry.id)));const actions=el('div','action-row');actions.append(button('Open postcard','recipe-link',()=>openPostcard(entry.id)),button('Make again','text-button',()=>openRecipe(entry.recipe)));card.append(actions);$('recipes').append(card);}
}
function previewCard(parent,content){parent.replaceChildren();try{parent.append(drawCard(content));}catch(error){parent.append(el('p','quiet',error.message));}}
function exportButtons(parent,getText,getContent,filename,title){
  const actions=el('div','action-row export-actions'),fallback=document.createElement('textarea');fallback.className='share-fallback';fallback.readOnly=true;fallback.rows=8;fallback.hidden=true;fallback.setAttribute('aria-label','Full text to copy manually');
  const copy=button('Copy text + recipe','secondary-button',async()=>{const text=getText();try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);flash('Copied. Ready to paste.');}catch{fallback.value=text;fallback.hidden=false;fallback.focus();fallback.select();flash('Copying is unavailable here. The full text is selected below for you to copy.');}});
  actions.append(button(filename.includes('invite')?'Save invitation image':'Save postcard image','small-primary',async()=>{try{await downloadImage(getContent(),filename);flash('Your image download is ready.');}catch(error){modalError(error);}}),copy,button('Download text','text-button',()=>{try{downloadText(getText(),filename);}catch(error){modalError(error);}}));
  if(navigator.share)actions.append(button('Share…','text-button',async()=>{try{await navigator.share({title,text:getText()});}catch(error){if(error.name==='AbortError')flash('Sharing cancelled. Your card is still here.');else{fallback.value=getText();fallback.hidden=false;flash('Sharing is unavailable here. Download or copy the text instead.');}}}));
  parent.append(actions,fallback);
}
function openPostcard(id){
  const entry=state.journal.find(e=>e.id===id);if(!entry){flash('That supper entry is no longer here.');return;}
  const box=beginModal('A little of tonight.', 'postcard'),preview=el('div','card-preview');box.append(preview);
  const getEntry=()=>{const current=state.journal.find(e=>e.id===id);if(!current)throw new Error('That supper entry was removed.');return current;};
  previewCard(preview,postcardContent(entry));
  const label=el('label','field-label','What would you like to remember?'),note=document.createElement('textarea'),status=el('p','quiet');note.id='postcard-note';note.rows=3;note.maxLength=500;note.value=entry.note;note.placeholder='The part of the evening you want to keep.';label.htmlFor=note.id;
  note.oninput=()=>{try{state=updateNote(state,id,note.value);persistCurrent();renderMain();status.textContent=lastSaveOK?'Note saved on this browser.':'Note kept for this visit only.';previewCard(preview,postcardContent(getEntry()));}catch(error){status.textContent=error.message;}};
  box.append(label,note,status);exportButtons(box,()=>postcardText(getEntry()),()=>postcardContent(getEntry()),'fridge-first-supper',entry.recipe.title);
  const actions=el('div','action-row');actions.append(button('Make again','text-button',()=>openRecipe(getEntry().recipe)),button('Keep the recipe','text-button',()=>{try{commit(saveRecipe(state,getEntry().recipe));flash(savedMessage('Recipe kept in your book.'));}catch(error){modalError(error);}}),button('Undo cooking','text-button',()=>{try{undoCooking(id);}catch(error){modalError(error);}}));box.append(actions,el('p','quiet','Undo cooking restores the fridge only if you haven’t changed it since.'));
  box.append(button('Remove this journal entry','text-button subdued',()=>{const result=deleteEntry(state,id);commit(result.state);$('recipe-dialog').close();flash('Journal entry removed. The fridge was left as it is.',()=>{commit(restoreEntry(state,result.entry));flash(savedMessage('Journal entry restored.'));});}));
}
function openInvite(recipe,existing=null,replace=false){
  if(!existing&&!replace&&state.invitation){
    if(state.invitation.recipe.id===recipe.id)existing=state.invitation;
    else {const box=beginModal('You have an invitation started.', 'invite');box.append(el('p','detail-copy',`Your draft for ${state.invitation.recipe.title} is still here.`));const actions=el('div','action-row');actions.append(button('Resume that draft','small-primary',()=>openInvite(state.invitation.recipe,state.invitation)),button('Replace with this recipe','secondary-button',()=>openInvite(recipe,null,true)));box.append(actions);return;}
  }
  const snapshot=recipeSnapshot(recipe),availability=matchRecipe(snapshot,state.inventory,state.basics);
  let draft=existing??makeInvitation(snapshot,availability.missing.filter(i=>!['oil','salt','pepper','water'].includes(normalize(i.name))).map(i=>i.name),'');
  state={...state,invitation:draft};persistCurrent();render();
  const box=beginModal('Come over. I’ll cook.', 'invite'),form=el('div','invite-form');box.append(el('p','quiet','Dinner doesn’t have to be an occasion. Pick something they could bring, or leave it all unticked and just ask them over.'));
  const choices=el('fieldset','invite-choices');choices.append(el('legend','','Ask them to bring…'));const selected=[];
  for(const item of snapshot.ingredients){if(normalize(item.name)==='water')continue;const label=el('label','invite-choice'),check=document.createElement('input');check.type='checkbox';check.checked=draft.selected.includes(normalize(item.name));label.append(check,el('span','',`${item.name} · ${item.amount}`));selected.push({check,item});choices.append(label);}
  const label=el('label','field-label','Make it sound like you (optional)'),note=document.createElement('textarea');note.id='invite-note';note.rows=3;note.maxLength=500;note.value=draft.note;note.placeholder='Come round after work? No need to dress up.';label.htmlFor=note.id;const status=el('p','quiet',lastSaveOK?'Draft saved on this browser.':'Draft kept for this visit only.'),preview=el('div','card-preview');
  const update=()=>{try{draft=makeInvitation(snapshot,selected.filter(i=>i.check.checked).map(i=>i.item.name),note.value);state={...state,invitation:draft};persistCurrent();$('resume-invite').hidden=false;status.textContent=lastSaveOK?'Draft saved on this browser.':'Draft kept for this visit only.';previewCard(preview,invitationContent(draft));}catch(error){status.textContent=error.message;}};
  for(const item of selected)item.check.onchange=update;note.oninput=update;
  form.append(choices,label,note,status);box.append(form,preview);previewCard(preview,invitationContent(draft));exportButtons(box,()=>invitationText(draft),()=>invitationContent(draft),'fridge-first-dinner-invite','Dinner together?');
  box.append(el('p','quiet','The image is a dinner card. Copy or download the text to include every recipe step.'),button('Discard invitation draft','text-button subdued',()=>{const discarded=state.invitation;commit({...state,invitation:null});$('recipe-dialog').close();flash('Invitation draft removed.',()=>{if(state.invitation)throw new Error('You have a newer draft. It was left untouched.');commit({...state,invitation:discarded});flash(savedMessage('Invitation restored.'));});}));
}
$('resume-invite').onclick=()=>{if(state.invitation)openInvite(state.invitation.recipe,state.invitation);};
function setBusy(value){busy=value;document.querySelector('.meals').setAttribute('aria-busy',String(value));for(const node of document.querySelectorAll('#add-form textarea,#add-form button,.preferences select,.preferences input,#example,#demo,#generate,.mutates-fridge'))node.disabled=value;$('cancel').hidden=!value;$('generate').textContent=value?'Finding a few things to cook…':'What could I cook?';renderInventory();if(!value){clearTimeout(requestTimer);clearInterval(elapsedTimer);$('progress-wrap').hidden=true;}}
function stopWorker(){runId++;worker?.terminate();worker=undefined;$('stop-model').hidden=true;$('model-note').textContent='Gemma is off. It only starts when you ask for a new menu.';}
function finish(){setBusy(false);}
$('stop-model').onclick=()=>{stopWorker();finish();flash('Gemma stopped. Your fridge and saved recipes are still here.');};
window.addEventListener('pagehide',()=>worker?.terminate());
$('cancel').onclick=()=>{stopWorker();finish();showError('Cancelled. Your ingredients and saved recipes are still here.');};
async function generate(){
  if(busy)return;if(state.inventory.length<2){showError('Add at least two ingredients to get started.');$('ingredient').focus();return;}
  showError('');
  if(!navigator.gpu){showError('Gemma needs a browser with WebGPU, such as current desktop Chrome or Edge with hardware acceleration enabled. Your recipe book and the example recipes still work.');return;}
  const thisRun=++runId;setBusy(true);$('progress-wrap').hidden=false;$('progress').value=0;$('progress-text').textContent='Checking your device…';
  try{
    const adapter=await navigator.gpu.requestAdapter();if(!busy||thisRun!==runId)return;if(!adapter)throw new Error('No compatible graphics device was found. Enable hardware acceleration or try another computer.');
    const inventory=structuredClone(state.inventory),options=settings();requestStarted=Date.now();
    if(!worker)worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});$('stop-model').hidden=false;
    worker.onmessage=({data})=>{
      if(!busy||thisRun!==runId)return;
      if(data.type==='progress'){$('progress').value=Math.max(0,Math.min(1,Number(data.progress)||0));$('progress-text').textContent=data.text;}
      if(data.type==='status')$('progress-text').textContent=data.text;
      if(data.type==='ready'){$('model-note').textContent='Gemma is ready. Your menu is generated on this device.';$('progress').removeAttribute('value');$('progress-text').textContent='Gemma is planning three meals…';elapsedTimer=setInterval(()=>{$('progress-text').textContent=`Gemma is planning three meals… ${Math.round((Date.now()-requestStarted)/1000)}s`;},1000);}
      if(data.type==='result'){try{const menu=prepareRecipes(data.data,inventory,options).map(r=>recipeSnapshot(r,'gemma'));finish();view='menu';commit({...state,menu,pick:null});}catch(error){finish();showError(error.message);}}
      if(data.type==='error'){stopWorker();finish();showError(`Gemma couldn't finish: ${data.message}. Your existing recipes are still here.`);}
    };
    worker.onerror=()=>{stopWorker();finish();showError('The browser AI engine could not load. Check your connection and try again in a browser with WebGPU support.');};
    requestTimer=setTimeout(()=>{stopWorker();finish();showError('This is taking too long on this device. Check your connection and try again. Your recipes are still here.');},15*60*1000);
    worker.postMessage({type:'generate',inventory,options});
  }catch(error){if(thisRun===runId){finish();showError(error.message);}}
}
$('generate').onclick=generate;
render();if(loaded.warnings.length){flash(loaded.warnings.join(' '));$('storage-note').textContent=loaded.warnings.join(' ');}
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tools=[
    {name:'read_fridge',description:'Read the ingredient list, preferences, current menu, and saved-recipe/supper counts.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({inventory:state.inventory,options:settings(),recipes:state.menu,bookCount:state.book.length,supperCount:state.journal.length,busy})},
    {name:'set_fridge_ingredients',description:'Replace the visible ingredient list and save it in this browser. Retains saved recipes and suppers. Does not generate meals.',inputSchema:{type:'object',properties:{ingredients:{type:'array',maxItems:16,items:{type:'object',properties:{name:{type:'string',maxLength:50},quantity:{type:'string',maxLength:35},soon:{type:'boolean'}},required:['name','quantity','soon'],additionalProperties:false}}},required:['ingredients'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{if(busy)throw new Error('Wait for meal generation to finish.');updateInventory(validateInventory(input?.ingredients));return {inventory:state.inventory,persisted:lastSaveOK};}}
  ];
  for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
