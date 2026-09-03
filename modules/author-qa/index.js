import { AUTHOR_QA_MARKER, AUTHOR_QA_PROMPT, latestAuthorQaExchange, hasVisibleAuthorQaAnswer } from '../creative/author-qa.js';

const runtime={timer:0,recoveredUserKey:'',running:false,observer:null};
let services={events:null,overlays:null,toast:console.log,getContext:()=>globalThis.SillyTavern?.getContext?.()||null};

function textOf(message){return String(message?.mes??message?.content??message?.message??message?.text??'');}
function isSystem(message){return Boolean(message?.is_system)||String(message?.role||'').toLowerCase()==='system';}
function isUser(message){return !isSystem(message)&&(message?.is_user===true||String(message?.role||'').toLowerCase()==='user');}

export function isAuthorQaRequest(chat){
  const rows=Array.isArray(chat)?chat:[];
  for(let i=rows.length-1;i>=0;i--){
    const m=rows[i];if(!m||isSystem(m))continue;
    if(!isUser(m))return false;
    return textOf(m).trimStart().startsWith(AUTHOR_QA_MARKER);
  }
  return false;
}

export function injectAuthorQaPrompt(chat){
  if(!Array.isArray(chat)||!isAuthorQaRequest(chat))return false;
  let userIndex=-1;for(let i=chat.length-1;i>=0;i--){if(isUser(chat[i])){userIndex=i;break;}}
  if(userIndex<0)return false;
  const sample=chat[userIndex]||{};
  const openAiShape=Object.prototype.hasOwnProperty.call(sample,'role')||Object.prototype.hasOwnProperty.call(sample,'content');
  const note=openAiShape?{role:'system',content:AUTHOR_QA_PROMPT.content}:{name:'VVV Hỏi đáp ngoài lề với tác giả',is_user:false,is_system:true,mes:AUTHOR_QA_PROMPT.content,send_date:Date.now()};
  // Avoid duplicate insertion if another interception pass runs in the same generation.
  const already=chat.some(m=>textOf(m).includes('【CHẾ ĐỘ HỎI ĐÁP NGOÀI LỀ VỚI TÁC GIẢ｜LƯỢT NÀY GHI ĐÈ QUY TRÌNH CHÍNH VĂN THÔNG THƯỜNG】'));
  if(!already)chat.splice(userIndex,0,note);
  return true;
}

function toast(msg,type='info'){try{services.toast?.(msg,type);}catch{}}

async function sendQuestion(value){
  const question=String(value||'').trim().slice(0,6000);if(!question)throw new Error('Hãy nhập câu hỏi bạn muốn hỏi tác giả trước đã');
  const input=document.querySelector('#send_textarea');if(!input)throw new Error('Không tìm thấy ô nhập liệu của SillyTavern');
  const mod=await import('/script.js');
  const generating=typeof mod.isGenerating==='function'?mod.isGenerating():Boolean(mod.isGenerating);if(generating)throw new Error('Chính văn vẫn đang được sinh, hãy đợi hết lượt này rồi mới hỏi tác giả');
  if(typeof mod.sendTextareaMessage!=='function')throw new Error('Phiên bản SillyTavern hiện tại không hỗ trợ đường gửi tin thông thường');
  const previous=String(input.value||'');const message=`${AUTHOR_QA_MARKER}\n${question}`;let sent=false;
  try{input.value=message;input.dispatchEvent(new Event('input',{bubbles:true}));await mod.sendTextareaMessage();sent=true;}
  finally{if(previous){input.value=previous;input.dispatchEvent(new Event('input',{bubbles:true}));}else if(!sent){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}}
  toast('Đã tạm dừng nhập vai và gửi cho tác giả; câu trả lời của lượt này sẽ hiện thẳng trong khung chat','success');
}

function openDialog(){
  services.overlays?.activate?.('author-qa');
  document.querySelector('.vvvsm-author-qa-dialog')?.remove();
  const root=document.createElement('div');root.className='vvvsm-author-qa-dialog';
  root.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="vvvsm-author-title"><header><div><span>OUT OF CHARACTER</span><b id="vvvsm-author-title">Hỏi tác giả</b></div><button type="button" data-vvvsm-author-close aria-label="Đóng">×</button></header><main><textarea maxlength="6000" placeholder="Ví dụ: Tác giả ơi, cho tôi biết trong thẻ này tôi vào vai ai, đối phương là ai, quan hệ giữa chúng tôi ra sao, và nên tiếp nối màn mở đầu này thế nào."></textarea><small data-vvvsm-author-status>Lượt này chỉ trả lời câu hỏi về thiết định và mạch truyện, không viết tiếp chính văn.</small></main><footer><button type="button" data-vvvsm-author-cancel>Hủy</button><button type="button" data-vvvsm-author-send>Gửi cho tác giả</button></footer></section>`;
  const close=()=>root.remove(),textarea=root.querySelector('textarea'),send=root.querySelector('[data-vvvsm-author-send]'),status=root.querySelector('[data-vvvsm-author-status]');
  const submit=async()=>{send.disabled=true;status.textContent='Đang chuyển cho mô hình chính của SillyTavern…';try{await sendQuestion(textarea.value);close();}catch(e){status.textContent=e?.message||String(e);status.classList.add('error');send.disabled=false;textarea.focus();}};
  root.addEventListener('click',e=>{if(e.target===root||e.target.closest('[data-vvvsm-author-close],[data-vvvsm-author-cancel]'))close();});send.addEventListener('click',submit);textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}});
  document.body.appendChild(root);requestAnimationFrame(()=>textarea.focus());
}

function ensureEntry(){
  const modal=document.getElementById('vvvtm-modal');if(!modal)return false;
  const actions=modal.querySelector('.vvvtm-head > div:last-child');if(!actions||actions.querySelector('[data-vvvsm-author-entry]'))return Boolean(actions);
  const button=document.createElement('button');button.type='button';button.className='vvvsm-author-qa-entry';button.dataset.vvvsmAuthorEntry='1';button.textContent='✒ Hỏi tác giả';button.addEventListener('click',openDialog);actions.insertBefore(button,actions.firstChild);return true;
}

function visibleAnswerFromMessage(message){
  let t=textOf(message);
  t=t.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi,'').replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi,'').replace(/```(?:thinking|reasoning)[\s\S]*?```/gi,'').trim();
  return hasVisibleAuthorQaAnswer(t);
}
async function recoverEmptyAuthorQaAnswer(){
  const c=services.getContext?.();const exchange=latestAuthorQaExchange(c?.chat);
  if(!exchange||runtime.running||runtime.recoveredUserKey===exchange.userKey)return false;
  const assistant=c?.chat?.[exchange.assistantIndex];if(visibleAnswerFromMessage(assistant))return false;
  const mod=await import('/script.js');const generating=typeof mod.isGenerating==='function'?mod.isGenerating():Boolean(mod.isGenerating);if(generating)return false;
  if(typeof mod.Generate!=='function')return false;
  runtime.recoveredUserKey=exchange.userKey;runtime.running=true;toast('Phần hỏi đáp tác giả mới chỉ trả về suy nghĩ, đang tự động lấy lại câu trả lời cuối cùng…','warning');
  try{await mod.Generate('regenerate');return true;}catch(e){console.error('[VVV Hỏi đáp ngoài lề với tác giả] Tự động lấy lại thất bại',e);toast(`Lấy lại câu trả lời cuối cùng của tác giả thất bại: ${e?.message||e}`,'error');return false;}finally{runtime.running=false;}
}
function scheduleRecovery(){clearTimeout(runtime.timer);runtime.timer=setTimeout(()=>recoverEmptyAuthorQaAnswer().catch(e=>console.warn('[VVV Hỏi đáp ngoài lề với tác giả] Kiểm tra tính toàn vẹn thất bại',e)),900);}

export async function initAuthorQa(input={}){
  services={...services,...input};
  services.overlays?.register?.('author-qa',{close:()=>document.querySelector('.vvvsm-author-qa-dialog')?.remove()});
  globalThis.VVVStoryMemoryAuthorQa={open:openDialog,send:sendQuestion,marker:AUTHOR_QA_MARKER};
  const on=services.events?.on?.bind(services.events);
  on?.('APP_READY',()=>setTimeout(ensureEntry,200));on?.('CHAT_CHANGED',()=>setTimeout(ensureEntry,200));on?.('MESSAGE_RECEIVED',scheduleRecovery);on?.('GENERATION_ENDED',()=>{scheduleRecovery();setTimeout(ensureEntry,120);});
  if(!runtime.observer){runtime.observer=new MutationObserver(()=>ensureEntry());runtime.observer.observe(document.documentElement,{subtree:true,childList:true});}
  setTimeout(ensureEntry,250);setTimeout(ensureEntry,1000);
  return true;
}
