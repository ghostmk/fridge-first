import {normalize,validateInventory} from './core.js';
const aliases={egg:'Eggs',eggs:'Eggs',tomato:'Tomatoes',tomatoes:'Tomatoes',onions:'Onion',onion:'Onion',spinach:'Spinach',rice:'Rice',yoghurt:'Yogurt',yogurt:'Yogurt',potato:'Potatoes',potatoes:'Potatoes'};
const amount='(?:\\d+(?:[./]\\d+)?(?:\\s+\\d+/\\d+)?|half|a quarter|one|two|three|four|five|six|a couple|a few|a|an)';
const unit='(?:kg|g|grams?|kilograms?|ml|l|litres?|liters?|cups?|tbsp|tsp|tablespoons?|teaspoons?|bags?|packets?|packs?|cans?|tins?|jars?|bottles?|bunch(?:es)?|handfuls?|pieces?|slices?|cloves?|pots?)';
const prefix=new RegExp(`^(${amount}(?:\\s*(?:a\\s+)?${unit})?)(?:\\s+of)?\\s+(.+)$`,'i');
const suffix=new RegExp(`^(.+?)\\s+(${amount}\\s*${unit})$`,'i');
export function parseList(value){
  if(typeof value!=='string'||value.length>2000)throw new Error('Try a shorter list—up to 16 ingredients at a time.');
  const rows=value.split(/[,;\n]+/).map(s=>s.trim().replace(/^(?:[-•]\s*|\d+[.)]\s+|\[[ xX]\]\s*)/, '')).filter(Boolean);
  if(!rows.length)throw new Error('Add anything you have, like eggs or spinach.');
  return rows.map(row=>{
    let name=row,quantity='';
    const explicit=row.match(/^(.+?)\s*(?:[|:]\s*(.+)|\(([^()]+)\))$/);
    const front=row.match(prefix),back=row.match(suffix);
    if(explicit){name=explicit[1];quantity=explicit[2]??explicit[3];}
    else if(front){quantity=front[1];name=front[2];}
    else if(back){name=back[1];quantity=back[2];}
    name=aliases[normalize(name)]??name.trim();
    return validateInventory([{name,quantity:quantity.trim(),soon:false}])[0];
  });
}
export function addList(inventory,value){
  const parsed=parseList(value),next=[...inventory],seen=new Set(inventory.map(i=>normalize(i.name))),added=[],skipped=[];
  for(const item of parsed){const key=normalize(item.name);if(seen.has(key)){skipped.push(item.name);continue;}seen.add(key);next.push(item);added.push(item.name);}
  return {inventory:validateInventory(next),added,skipped:[...new Set(skipped)]};
}
