/* 尸变纪元 · 专属助手 v1.3.0
 * 当前消息页（swipe）绑定读取、MVU 真存档核验。
 * 只读：不写入/重算/修正任何 MVU 存档；未落库时绝不回退为旧回复。
 */
(async function shibianAssistant() {
  'use strict';
  const BUILD = '1.3.0';
  const ROOT_ID = 'shibian-mvu-assistant';
  const OWNER = '__shibianV2Assistant';
  let w = window;
  try { if (window.parent !== window && window.parent.document?.body) w = window.parent; } catch (_) {}
  const doc = w.document;
  try { if (w[OWNER]?.destroy) w[OWNER].destroy(); } catch (_) {}
  doc.getElementById(ROOT_ID)?.remove();

  const state = { opened: false, current: null, prev: null, info: null, busy: false, queued: false,
    timer: null, interval: null, unsubscribe: [], errors: [], last: '', events: 0 };
  const has = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const statOf = v => has(v?.stat_data) ? v.stat_data : null;
  const own = (v,k) => Object.prototype.hasOwnProperty.call(v||{},k);
  const str = v => v === undefined ? '未记录' : v === null ? '未设定' : String(v);
  const value = v => Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' ? v[0] : v;
  const at = (v,path) => path.reduce((p,k) => p != null ? p[k] : undefined, v);
  const idnum = n => Number.isInteger(Number(n)) && Number(n) >= 0 ? Number(n) : null;
  const sjson = obj => { try { return JSON.stringify(obj); } catch (_) { return String(obj); } };
  const brief = obj => { const x = value(obj);return typeof x === 'object' && x!==null ? sjson(x).slice(0,115) : str(x); };
  const stablehash = s => { let h=2166136261;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619);}return (h>>>0).toString(16).padStart(8,'0');};
  function digest(stat){
    const f=p=>value(at(stat||{},p));
    return {date:f(['世界','日期']),time:f(['世界','时间']),place:f(['当前位置','空间']),
      location:[f(['当前位置','城市']),f(['当前位置','场所'])].filter(x=>x!=null&&x!=='未设定'&&x!=='').join(' / '),
      stamina:f(['主角','体力']),hunger:f(['主角','饥饿']),thirst:f(['主角','口渴']),
      weapon:f(['特殊能力','善良之枪','当前持有武器']),weapons:f(['特殊能力','善良之枪','武器记录']),
      inv:f(['随身物品']),relations:f(['人物关系']),space:f(['储物空间']),party:f(['同场人物'])};
  }
  const keys = x => has(x) ? (Object.keys(x).slice(0,8).join('、')||'无') : Array.isArray(x) ? x.map(str).slice(0,8).join('、') : '无';
  const copy = obj => JSON.parse(JSON.stringify(obj));

  function msgArray(v){return Array.isArray(v)?v:(has(v)?[v]:[]);}
  async function messages(id,options) {
    if (typeof getChatMessages !== 'function') return [];
    try {return msgArray(await Promise.resolve(getChatMessages(id,options)));}
    catch(e){state.errors.push('getChatMessages: '+String(e?.message||e));return [];}
  }
  function ctxRow(id){
    try {return typeof SillyTavern !== 'undefined' && typeof SillyTavern?.getContext==='function'
      ? SillyTavern.getContext()?.chat?.[id] : null; } catch (_) {return null;}
  }
  async function newestId() {
    let candidate = null;
    try { if(typeof getLastMessageId==='function') candidate=idnum(await Promise.resolve(getLastMessageId())); }catch(_){ }
    const newest=(await messages(-1))[0];
    const read=idnum(newest?.message_id);
    if(read!==null) candidate=read;
    if(candidate===null){try{const chat=SillyTavern.getContext()?.chat;if(Array.isArray(chat)&&chat.length)candidate=chat.length-1;}catch(_){}}
    return candidate;
  }
  async function selected(id) {
    // 获取完整页集合。每个重生成页有自己的 swipes_data[swipe_id]。
    const [full] = await messages(id,{include_swipes:true});
    const [plain] = await messages(id);
    const context = ctxRow(id);
    const row = full || plain || context;
    if (!row) return null;
    const swipe = idnum(full?.swipe_id ?? plain?.swipe_id ?? context?.swipe_id) ?? 0;
    const pages = full?.swipes || context?.swipes || null;
    const count=Array.isArray(pages)?pages.length:1;
    const text = typeof pages?.[swipe]==='string' ? pages[swipe]
      : typeof plain?.message==='string' ? plain.message
      : typeof full?.message==='string' ? full.message
      : typeof context?.mes==='string' ? context.mes : '';
    const swipeData=full?.swipes_data || context?.variables || null;
    const hasSwipeDataset=Array.isArray(swipeData);
    let stat=null,source='',notes=[],isCurrent=true;
    if(hasSwipeDataset){
      const slot=swipeData[swipe];
      stat=statOf(slot);
      source=`当前重生成页 swipes_data[${swipe}]`;
      if(!stat)notes.push('当前选中的消息页没有 stat_data；禁止用其他页的旧值替代。');
    }else{
      // 仅在宿主没有暴露分页变量时，才尝试读取单页变量 API。
      let v=null;
      try {if(typeof Mvu!=='undefined'&&typeof Mvu?.getMvuData==='function')v=await Promise.resolve(Mvu.getMvuData({type:'message',message_id:id}));}
      catch(e){notes.push('Mvu.getMvuData: '+String(e?.message||e));}
      if(statOf(v)){stat=statOf(v);source='Mvu.getMvuData（宿主未提供分页变量）';}
      else if(statOf(plain?.data)){stat=statOf(plain.data);source='getChatMessages.data（宿主未提供分页变量）';}
      else if(statOf(full?.data)){stat=statOf(full.data);source='getChatMessages.data（宿主未提供分页变量）';}
      else notes.push('该楼当前未读到 MVU 存档。');
      if(count>1)notes.push('宿主未暴露独立分页变量：无法独立核验重生成页的存档。');
    }
    // 同一选中页的正文应与宿主直接消息正文一致。不一致就不能保证数据是当前回复。
    if(typeof plain?.message==='string' && text && plain.message!==text){
      isCurrent=false;notes.push('分页原文与直接消息原文不一致，宿主消息快照可能尚未同步。');
    }
    if(idnum(row.message_id)!==null && Number(row.message_id)!==id) notes.push('返回的楼层 ID 与目标不一致。');
    return {id,swipe,count,stat,source,text,hash:stablehash(text),notes,valid:isCurrent,
      role:row.role|| (context?.is_user?'user':'assistant')};
  }
  function jsonPatch(text){
    // 只解读当前消息原文，不解析正则渲染的 HTML 状态栏。
    // 修正 v1.2 BUG：AI 可能在合法 JSON 数组之后接解释或标签；整段 JSON.parse 会把合法数组误判为失败。
    const src=String(text||'');
    const open=/<JSONPatch\b[^>]*>/gi;
    let match, valid=[], problems=[];
    while((match=open.exec(src))!==null){
      let begin=match.index+match[0].length;
      const close=/<\/JSONPatch\s*>/ig;
      close.lastIndex=begin;
      const closeMatch=close.exec(src);
      const limit=closeMatch?closeMatch.index:Math.min(src.length,begin+110000);
      const body=src.slice(begin,limit);
      const parsed=balancedPatchArray(body);
      if(parsed.ops){
        const prefix=body.slice(0,parsed.start).trim().replace(/^```(?:json)?\s*/i,'').trim();
        const suffix=body.slice(parsed.end).trim().replace(/^```\s*/,'').trim();
        const warnings=[];
        if(prefix||suffix)warnings.push('JSONPatch 数组前/后含额外文字，诊断已提取数组；MVU 引擎是否接受仍须看实际存档。');
        if(!closeMatch)warnings.push('缺少 </JSONPatch> 结束标签；真实 MVU 可能拒绝处理。');
        valid.push({ops:parsed.ops,message:'',warnings,source:body.slice(parsed.start,parsed.end)});
      }else{problems.push(parsed.error||'找不到有效 JSONPatch 操作数组');}
      if(closeMatch)open.lastIndex=close.lastIndex;
      // 为避免旧版脚本因 HTML 标签后误延伸，仅把每个明确的 JSONPatch 标记视为候选。
    }
    if(valid.length){
      // 多个补丁块时优先取最后一个，通常是本轮最后输出的实际更新。
      const picked=valid[valid.length-1];
      if(valid.length>1)picked.warnings.push(`本条回复出现 ${valid.length} 个可解析 JSONPatch 块，仅核对最后一个；真实 MVU 可能处理多块。`);
      return picked;
    }
    return {ops:null,warnings:[],message:problems.length?
      `发现 JSONPatch 标签，但没有找到可解析的操作数组：${problems.at(-1)}`:
      '当前回复原文未发现 <JSONPatch> 标签；可能被正则隐藏，或 APP 返回了不同的消息文本。'};
  }
  function balancedPatchArray(body){
    // 跳过字符串内部的 []，精确定位第一层完整的 JSON 数组，不需要依赖闭合标签对齐。
    for(let start=0;start<body.length;start++){
      if(body[start]!=='[')continue;
      let inString=false,escaped=false,depth=0,end=-1;
      for(let i=start;i<body.length;i++){
        const c=body[i];
        if(inString){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c==='"'){inString=false;}continue;}
        if(c==='"'){inString=true;continue;}
        if(c==='['||c==='{')depth++;
        if(c===']'||c==='}'){
          depth--;
          if(depth<0)break;
          if(depth===0){end=i+1;break;}
        }
      }
      if(end<0)continue;
      try{
        const ops=JSON.parse(body.slice(start,end));
        if(Array.isArray(ops)&&ops.every(op=>op&&typeof op==='object'&&typeof op.op==='string'&&typeof op.path==='string')){
          return {ops,start,end};
        }
        if(Array.isArray(ops)&&ops.length===0)return {ops,start,end};
      }catch(_){/* 当前候选可能是说明中的示例，继续尝试下一个数组 */}
    }
    return {ops:null,error:'数组未闭合、JSON 字符串错误或操作对象缺少 op/path。'};
  }
  function ptr(root,path) {
    if(typeof path!=='string'||!path.startsWith('/'))throw Error('不是合法 JSON Pointer：'+str(path));
    const tokens=path.slice(1).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'));
    let p=root;for(let i=0;i<tokens.length-1;i++){p=p?.[tokens[i]];if(p===undefined||p===null)throw Error('父级路径不存在：'+tokens.slice(0,i+1).join('/'));}
    return {parent:p,key:tokens[tokens.length-1],tokens};
  }
  function applyPatchPreview(base,ops){
    const out=copy(base);const errors=[];const touched=[];
    for(let i=0;i<ops.length;i++){
      const op=ops[i],action=op?.op;
      if(!['replace','insert','delta','remove'].includes(action)){
        errors.push(`#${i+1} op=${str(action)} 不属于《缄默之秋》使用的 MVU JSONPatch 操作集。新增对象用 insert，数值加减用 delta。`);
        continue;
      }
      try {
        const p=ptr(out,op.path), {parent,key,tokens}=p;
        if(!has(parent)&&!Array.isArray(parent))throw Error('父节点不是对象');
        if(action==='replace') {if(!own(parent,key)&&!Array.isArray(parent))throw Error('replace 路径不存在');parent[key]=copyVal(op.value);}
        if(action==='delta'){if(typeof parent[key]!=='number'||typeof op.value!=='number')throw Error('delta 必须是数字');parent[key]+=op.value;}
        if(action==='insert'){if(Array.isArray(parent)){if(key==='-')parent.push(copyVal(op.value));else if(/^\d+$/.test(key))parent.splice(Number(key),0,copyVal(op.value));else throw Error('数组索引错误');}
          else {parent[key]=copyVal(op.value);}}
        if(action==='remove'){if(Array.isArray(parent)&&/^\d+$/.test(key))parent.splice(Number(key),1);else delete parent[key];}
        touched.push({path:op.path,tokens,op:action});
      }catch(e){errors.push(`#${i+1} ${String(e?.message||e)}`);}
    }
    return {out,touched,errors};
  }
  const copyVal=x=>x===undefined?null:JSON.parse(JSON.stringify(x));
  function assess(current,prior){
    const parsed=jsonPatch(current.text);
    if(!parsed.ops){return {status:'补丁解析失败（非存档错误）',detail:parsed.message};}
    const parseNote=parsed.warnings?.length?parsed.warnings.join('\n')+'\n':'';
    if(!current.stat)return {status:'当前页未读到存档',detail:`成功提取本轮 ${parsed.ops.length} 条补丁，但当前选中的消息页缺少 stat_data；无法判断 MVU 是否完成保存。\n${parseNote}`};
    if(!current.valid)return {status:'消息快照不一致',detail:'PiuPiu 返回的当前页原文不一致，禁止使用旧快照断言落库。\n'+parseNote};
    if(!prior?.stat){
      const direct=parsed.ops.filter(o=>o.op==='replace'||o.op==='insert');
      const wrong=direct.filter(o=>{
        try{return sjson(at(current.stat,ptr(current.stat,o.path).tokens))!==sjson(o.value)}catch(_){return true;}
      });
      return {status:wrong.length?'直接赋值不一致':'存档存在·缺少上轮基准',detail:`本轮 ${parsed.ops.length} 条补丁；可以直接核对 ${direct.length} 条 replace/insert，其中 ${wrong.length} 条与当前存档不同。没有上一轮存档，无法校验 delta。\n${parseNote}`};
    }
    const preview=applyPatchPreview(prior.stat,parsed.ops);
    if(preview.errors.length)return {status:'模拟更新存在疑点',detail:`本轮数组已解析，但本地模拟应用有疑点（不等于 MVU 引擎必然失败）：\n${preview.errors.join('\n').slice(0,700)}\n${parseNote}`};
    const diff=[];
    for(const p of preview.touched){const expect=at(preview.out,p.tokens),actual=at(current.stat,p.tokens);
      if(sjson(expect)!==sjson(actual))diff.push(`${p.path}: 应为 ${brief(expect)}；存档 ${brief(actual)}`);
    }
    return diff.length?{status:'补丁与存档不一致',detail:`解析成功，但 ${diff.length}/${preview.touched.length} 个目标字段不符：\n${diff.slice(0,10).join('\n')}\n${parseNote}`}
      :{status:'已核对存档',detail:`成功解析 ${parsed.ops.length} 条操作，相关字段与当前页的实际存档一致。\n${parseNote}`};
  }
  const BOX=`<style>
#${ROOT_ID}{all:initial;color:#ead8ce;font:13px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif}
#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID} .sb-bubble{position:fixed;right:8px;top:46%;z-index:2147483000;width:48px;height:56px;border:2px solid #bd866a;border-radius:14px 0 0 14px;background:#612531;color:#ffe9d3;font:bold 19px system-ui;cursor:pointer}
#${ROOT_ID} .sb-bubble span{display:block;font-size:10px;font-weight:400}
#${ROOT_ID} .sb-panel{position:fixed;top:13%;right:60px;width:min(390px,calc(100vw - 73px));max-height:75vh;z-index:2147483001;display:none;flex-direction:column;background:#1b1115;border:2px solid #80444d;border-radius:12px;box-shadow:0 10px 40px #000a;overflow:hidden}
#${ROOT_ID} .sb-panel.open{display:flex}
#${ROOT_ID} header{display:flex;justify-content:space-between;align-items:center;padding:12px;background:#632832;color:#fff0df;gap:8px;font-size:15px;font-weight:700}
#${ROOT_ID} button{cursor:pointer}#${ROOT_ID} header button{background:#442027;border:1px solid #aa7672;color:#fff1e9;border-radius:6px;padding:5px 9px}
#${ROOT_ID} main{overflow-y:auto;overscroll-behavior:contain;padding:12px}
#${ROOT_ID} .info{padding:8px;border:1px solid #7d4448;background:#29171b;border-radius:7px;color:#f0d3bf;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
#${ROOT_ID} .alert{border-color:#bd674d;color:#ffcab2}
#${ROOT_ID} .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
#${ROOT_ID} .tile{padding:9px;background:#26161a;border:1px solid #664249;border-radius:7px;min-width:0}
#${ROOT_ID} .tile span{display:block;font-size:11px;color:#ba9487}#${ROOT_ID} .tile b{display:block;font-size:15px;color:#ffd4b8;word-break:break-all}
#${ROOT_ID} h4{color:#f0bea4;font-size:13px;margin:13px 0 5px;border-bottom:1px solid #664249}
#${ROOT_ID} pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#190f12;border:1px dashed #664249;padding:8px;border-radius:7px;margin:0;font:12px/1.6 system-ui;color:#dfc8bd;max-height:180px;overflow:auto}
#${ROOT_ID} .buttons{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}#${ROOT_ID} .buttons button{background:#742f3b;border:1px solid #b88470;border-radius:7px;padding:8px;color:#fff0df}
#${ROOT_ID} .note{font-size:11px;color:#b8a19b;margin-top:10px}
</style>
<button type="button" class="sb-bubble" aria-label="打开尸变纪元助手">尸<span>MVU</span></button>
<section class="sb-panel" role="dialog" aria-label="尸变纪元当前重生成页 MVU 存档">
<header><span>尸变纪元 · 专属助手 v${BUILD}</span><button type="button" class="close">关闭</button></header>
<main>
<div class="info" id="sb-meta">尚未读取</div>
<div class="grid"><div class="tile"><span>真实日期/时间</span><b id="sb-date">—</b></div><div class="tile"><span>空间/位置</span><b id="sb-place">—</b></div><div class="tile"><span>体力</span><b id="sb-stamina">—</b></div><div class="tile"><span>饱腹/水分</span><b id="sb-needs">—</b></div></div>
<h4>武器和物资（仅实际存档）</h4><pre id="sb-gear">—</pre>
<h4>本轮 JSONPatch 解析 ↔ 当前页 MVU 存档核对</h4><div class="info" id="sb-check">—</div>
<h4>相邻楼层存档变化</h4><pre id="sb-diff">—</pre>
<div class="buttons"><button type="button" id="sb-refresh">核验当前回复</button><button type="button" id="sb-copy">复制诊断</button></div>
<div class="note" id="sb-note">只读：不会修改变量。重生成后必须检查选中页及落库状态。</div>
</main></section>`;
  const root=doc.createElement('div');root.id=ROOT_ID;root.innerHTML=BOX;(doc.body||doc.documentElement).appendChild(root);
  const q=id=>root.querySelector('#'+id);
  const put=(id,t)=>{if(q(id))q(id).textContent=str(t)};
  function changed(a,b){
    if(!a?.stat||!b?.stat)return '缺少相邻两份完整的存档，不能对照。';
    const l=digest(a.stat),r=digest(b.stat);const labels={date:'日期',time:'时间',place:'空间',location:'位置',stamina:'体力',hunger:'饥饿',thirst:'口渴',weapon:'当前武器',weapons:'枪械记录',inv:'随身物品',relations:'人物关系'};
    const out=[];for(const key of Object.keys(labels)) if(sjson(l[key])!==sjson(r[key]))out.push(`${labels[key]}：${brief(r[key])} → ${brief(l[key])}`);
    return out.length?out.slice(0,20).join('\n'):'没有检测到差异；这不代表新一页已经成功落库。';
  }
  async function refresh(manual=false){
    if(state.busy){state.queued=true;return;}
    state.busy=true;state.errors=[];const btn=q('sb-refresh');if(btn){btn.disabled=true;btn.textContent='读取中…';}
    try{
      // 一些酒馆兼容宿主提供显式快照刷新；不支持时不臆造 API。
      if(manual && typeof refreshHelperSnapshot === 'function') {
        try { await Promise.resolve(refreshHelperSnapshot()); }
        catch(e){state.errors.push('宿主快照刷新失败：'+String(e?.message||e));}
      }
      const last=await newestId();
      if(last===null){put('sb-meta','无法获取当前消息编号');return;}
      const current=await selected(last);
      let prev=null;
      for(let i=last-1;i>=Math.max(0,last-25);i--){const x=await selected(i);if(x?.stat){prev=x;break;}}
      state.current=current;state.prev=prev;
      if(!current){put('sb-meta','最新消息不存在或宿主尚未刷新消息快照');return;}
      const check=assess(current,prev);const d=digest(current.stat),good=Boolean(current.stat)&&current.valid;
      const info=[`当前楼层：#${current.id}；选中页：${current.swipe+1}/${current.count}；原文指纹：${current.hash}`,
        `真实存档：${good?'已读取':'未核实'}；来源：${current.source||'无'}`,
        `核对结果：${check.status}；刷新：${new Date().toLocaleTimeString('zh-CN',{hour12:false})}`,
        ...current.notes,...state.errors];
      put('sb-meta',info.join('\n'));q('sb-meta').classList.toggle('alert',!good||check.status!=='已核对存档'&&check.status!=='存档存在·缺少上轮基准');
      put('sb-date',good?`${str(d.date)} ${str(d.time)}`:'⚠ 当前页无可信存档');
      put('sb-place',good?`${str(d.place)} / ${d.location}`:'—');
      put('sb-stamina',good?str(d.stamina):'—');
      put('sb-needs',good?`${typeof d.hunger==='number'?100-d.hunger:'未设定'} / ${typeof d.thirst==='number'?100-d.thirst:'未设定'}`:'—');
      put('sb-gear',good?`当前武器：${str(d.weapon)}\n弹药记录：${sjson(d.weapons||{})}\n随身物品：${keys(d.inv)}\n人物关系：${keys(d.relations)}`:'当前页尚无可信真实存档，不能用旧版回复的数据代替。');
      put('sb-check',`${check.status}\n${check.detail}`);
      put('sb-diff',good?changed(current,prev):'当前消息页未落库，不能比较。');
      put('sb-note','只读。面板必须和当前选中的消息页一致；重新生成后楼层号可能不变，但页号/指纹会变。'+(state.events?` 最近捕获MVU事件 ${state.events} 次。`:''));
    } catch(e){put('sb-meta','读取失败：'+String(e?.stack||e));}
    finally{state.busy=false;if(btn){btn.disabled=false;btn.textContent='核验当前回复';}if(state.queued){state.queued=false;setTimeout(()=>refresh(),450);}}
  }
  function report(){return `尸变纪元 v${BUILD}\n${q('sb-meta')?.textContent}\n核验：${q('sb-check')?.textContent}\n当前：${q('sb-date')?.textContent} ${q('sb-place')?.textContent}\n差异：${q('sb-diff')?.textContent}`;}
  const panel=root.querySelector('.sb-panel');
  root.querySelector('.sb-bubble').addEventListener('click',()=>{state.opened=!state.opened;panel.classList.toggle('open',state.opened);if(state.opened)void refresh(true);});
  root.querySelector('.close').addEventListener('click',()=>{state.opened=false;panel.classList.remove('open');});
  q('sb-refresh').addEventListener('click',()=>void refresh(true));
  q('sb-copy').addEventListener('click',async()=>{try{await w.navigator.clipboard.writeText(report());put('sb-note','诊断已复制。');}catch(e){put('sb-note','无法复制。可截图面板或长按文本。');}});
  function later(ms=850){if(state.timer)clearTimeout(state.timer);state.timer=setTimeout(()=>{if(state.opened)void refresh();},ms);}
  try{if(typeof eventOn==='function'){
    for(const ev of ['mag_variable_update_ended',
      ...(typeof tavern_events!=='undefined'?['MESSAGE_RECEIVED','CHARACTER_MESSAGE_RENDERED','MESSAGE_SWIPED','MESSAGE_UPDATED','CHAT_CHANGED'].map(k=>tavern_events[k]).filter(Boolean):[])]){
        const handler=()=>{state.events++;later(1100);};eventOn(ev,handler);
        if(typeof eventRemoveListener==='function')state.unsubscribe.push(()=>eventRemoveListener(ev,handler));
    }
  }}catch(e){state.errors.push(String(e));}
  // 重新生成同一楼时消息编号不变，所以开着面板时还要轮询页号和当前原文。
  state.interval=setInterval(()=>{if(state.opened)void refresh();},2200);
  w[OWNER]={version:BUILD,refresh,destroy(){clearTimeout(state.timer);clearInterval(state.interval);state.unsubscribe.forEach(fn=>{try{fn();}catch(_){}});root.remove();delete w[OWNER];}};
  console.info('[尸变纪元] v'+BUILD+' 已挂载；补丁与真实存档分别校验。');
})();
