export function wrapLines(text, maxWidth, measure) {
  const lines=[];
  for(const paragraph of String(text).split('\n')){
    if(!paragraph){lines.push('');continue;}
    let line='';
    for(const word of paragraph.split(/\s+/)){
      if(measure(word)>maxWidth){
        if(line){lines.push(line);line='';}
        let part='';for(const char of word){if(part&&measure(part+char)>maxWidth){lines.push(part);part='';}part+=char;}line=part;
      }else if(line&&measure(line+' '+word)>maxWidth){lines.push(line);line=word;}
      else line+=(line?' ':'')+word;
    }
    if(line)lines.push(line);
  }
  return lines;
}
export function postcardContent(entry){return {kind:'postcard',eyebrow:'A LITTLE OF TONIGHT',title:entry.recipe.title,subtitle:new Date(entry.cookedAt).toLocaleDateString(undefined,{dateStyle:'long'}),body:entry.used.length?'Made with\n'+entry.used.join(', '):'A meal worth remembering.',note:entry.note,source:entry.recipe.source};}
export function invitationContent(draft){const items=draft.recipe.ingredients.filter(i=>draft.selected.includes(i.name.trim().toLocaleLowerCase().replace(/\s+/g,' ')));
  return {kind:'invite',eyebrow:'COME OVER. I’LL COOK.',title:draft.recipe.title,subtitle:`I’ll cook. ${draft.recipe.servings} servings.`,body:items.length?'Could you bring…\n'+items.map(i=>`${i.amount} ${i.name}`).join('\n'):'Just bring yourself.',note:draft.note,source:draft.recipe.source};}
export function drawCard(content,canvas=document.createElement('canvas')){
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable here. Use the text download instead.');
  const width=1000,padding=74,noteBlock=content.note?[{text:content.note,font:'italic 32px Georgia, serif',color:'#a23f31',line:45,gap:35}]:[],blocks=[
    {text:content.eyebrow,font:'500 23px sans-serif',color:'#a23f31',line:34,gap:34},
    {text:content.title,font:'52px Georgia, serif',color:'#29392f',line:62,gap:25},
    {text:content.subtitle,font:'25px sans-serif',color:'#65705f',line:36,gap:45},
    ...(content.kind==='postcard'?noteBlock:[]),
    {text:content.body,font:'30px Georgia, serif',color:'#29392f',line:44,gap:35},
    ...(content.kind!=='postcard'?noteBlock:[]),
    {text:`${content.source==='sample'?'Prepared sample recipe':'Made with Gemma'}\nfridge first.  <3`,font:'21px sans-serif',color:'#65705f',line:32,gap:0}
  ];
  let height=padding*2+24;for(const block of blocks){ctx.font=block.font;block.lines=wrapLines(block.text,width-padding*2,s=>ctx.measureText(s).width);height+=block.lines.length*block.line+block.gap;}
  canvas.width=width;canvas.height=Math.max(720,height);ctx.fillStyle=content.kind==='invite'?'#f8f0e8':'#faf7ed';ctx.fillRect(0,0,width,canvas.height);ctx.strokeStyle='#c8cbbb';ctx.lineWidth=2;ctx.strokeRect(25,25,width-50,canvas.height-50);ctx.fillStyle=content.kind==='invite'?'#ba8068':'#a23f31';ctx.fillRect(padding,42,66,4);ctx.textBaseline='top';let y=padding;
  for(const block of blocks){ctx.font=block.font;ctx.fillStyle=block.color;for(const line of block.lines){ctx.fillText(line,padding,y);y+=block.line;}y+=block.gap;}
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${content.eyebrow} ${content.title}. ${content.subtitle}. ${content.body}. ${content.note||''}`);
  return canvas;
}
export function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function downloadImage(content,filename){const canvas=drawCard(content);const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('The image could not be created. Use the text download instead.')),'image/png'));downloadBlob(blob,filename+'.png');}
export function downloadText(value,filename){downloadBlob(new Blob([value],{type:'text/plain;charset=utf-8'}),filename+'.txt');}
