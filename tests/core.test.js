import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRecipes,validateInventory,EXAMPLE,DEMO,makePrompt} from '../dist/core.js';
const options={minutes:30,servings:2,basics:true};
const clone=()=>structuredClone(DEMO);
test('prioritizes meals using soon ingredients; stocked status is derived from inventory',()=>{
  const inventory=EXAMPLE.map(x=>({...x,soon:x.name==='Yogurt'}));
  const recipes=prepareRecipes(clone(),inventory,options);
  assert.match(recipes[0].title,/yogurt/i);
  assert.equal(recipes[0].soonCount,1);
  assert.ok(recipes.every(x=>x.missing.length===0));
});
test('unlisted ingredient cannot claim it is in stock',()=>{
  const data=clone();data.recipes[0].ingredients.push({name:'Cheese',amount:'50 g',inStock:true});
  const recipes=prepareRecipes(data,EXAMPLE,options);
  const cheese=recipes.flatMap(x=>x.ingredients).find(x=>x.name==='Cheese');
  assert.equal(cheese.inStock,false);
  assert.equal(recipes.find(x=>x.ingredients.includes(cheese)).missing[0].name,'Cheese');
});
test('pantry basics are only assumed when opted in',()=>{
  const recipes=prepareRecipes(clone(),EXAMPLE,{...options,basics:false});
  assert.ok(recipes.every(x=>x.missing.some(i=>i.name==='oil')));
});
test('rejects over-time, truncated, duplicated, and irrelevant recipes',()=>{
  const slow=clone();slow.recipes[0].minutes=50;assert.throws(()=>prepareRecipes(slow,EXAMPLE,options));
  const partial=clone();partial.recipes.pop();assert.throws(()=>prepareRecipes(partial,EXAMPLE,options));
  const repeat=clone();repeat.recipes[1].title=repeat.recipes[0].title;assert.throws(()=>prepareRecipes(repeat,EXAMPLE,options));
  const irrelevant=clone();irrelevant.recipes[0].ingredients=[{name:'Cheese',amount:'50g'},{name:'Pasta',amount:'100g'}];assert.throws(()=>prepareRecipes(irrelevant,EXAMPLE,options));
});
test('duplicate/invalid inventory is rejected without mutating input',()=>{
  assert.throws(()=>validateInventory([...EXAMPLE,{name:'  SPINACH  ',quantity:'1',soon:false}]));
  assert.throws(()=>validateInventory([{name:'',quantity:'',soon:false}]));
  assert.throws(()=>validateInventory([{name:'Eggs',quantity:'6',soon:'false'}]));
  const source=[{name:' Eggs ',quantity:' 6 ',soon:true}];assert.equal(validateInventory(source)[0].name,'Eggs');assert.equal(source[0].name,' Eggs ');
});
test('prompt includes real inventory, servings, time limit, and no assumed staples',()=>{
  const prompt=makePrompt(EXAMPLE,{minutes:15,servings:4,basics:false});
  assert.match(prompt,/4 people/);assert.match(prompt,/15 minutes/);assert.match(prompt,/No pantry basics/);assert.ok(prompt.includes(JSON.stringify(EXAMPLE)));
});
