import { MODEL_ID, makePrompt, recipeSchema } from './core.js';
let engine;
self.onmessage = async ({data}) => {
  if(data.type!=='generate')return;
  try {
    if(!engine){
      self.postMessage({type:'status',text:'Loading the browser AI engine…'});
      const {CreateMLCEngine}=await import('https://esm.run/@mlc-ai/web-llm@0.2.85');
      engine=await CreateMLCEngine(MODEL_ID,{initProgressCallback:report=>self.postMessage({type:'progress',progress:report.progress,text:report.text})},{context_window_size:4096});
    }
    self.postMessage({type:'ready'});
    const result=await engine.chat.completions.create({messages:[{role:'user',content:makePrompt(data.inventory,data.options)}],temperature:.5,max_tokens:1900,response_format:{type:'json_object',schema:JSON.stringify(recipeSchema)}});
    if(result.choices[0]?.finish_reason==='length')throw new Error('The recipes were cut short. Please try again.');
    const text=result.choices[0]?.message?.content;
    if(!text)throw new Error('Gemma returned no recipes. Please try again.');
    self.postMessage({type:'result',data:JSON.parse(text)});
  } catch(error){self.postMessage({type:'error',message:error?.message||String(error)});}
};
