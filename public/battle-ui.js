import {qrSvg} from '/qr.js';
export function battleUI({code,token,r,api,esc,shell,full,toast,cleanup}){
 let id=localStorage.getItem('participant');if(!id){id=crypto.randomUUID();localStorage.setItem('participant',id)}
 let active=true,latest=r,signature='',busy=false;
 const names=['입장 선택 · 대기실','1라운드 · 논리 모으기','2라운드 · 대표 대결','2라운드 · 익명 투표','3라운드 · 최종 선택','경기 종료'];
 const phases=['lobby','ideas','duel','vote','final','finished'];
 const nextText={lobby:'1라운드 시작 →',ideas:'대표 대결로 →',duel:'발언 종료 · 투표 시작 →',vote:'최종 선택 시작 →',final:'경기 종료 · 결과 공개'};
 shell('debate',`<div class="battle"><div class="battle-header"><span class="battle-label" id="battlePhase"></span><span id="battleCount"></span></div><h2 class="battle-topic">${esc(r.question)}</h2><div class="battle-steps">${['논리 모으기','대표 대결','최종 선택'].map((x,i)=>`<span data-step="${i}">${i+1}. ${x}</span>`).join('')}</div><div class="arena"><div class="arena-sky"><span>✦</span><span>✧</span><span>✦</span></div><div class="scoreboard"><span id="leftScore"></span><span class="score-vs">VS</span><span id="rightScore"></span></div><div class="arena-teams"><strong>${esc(r.options[0].text)}</strong><strong>${esc(r.options[1].text)}</strong></div><div class="battle-rope"><i id="balanceGem">◆</i></div><div class="arena-players" id="players"></div><div class="arena-ground"></div></div><p class="battle-rule">논리 10P · 친구 공감 5P · 대표 투표 20P · 최종 선택 10P · 상대 팀 설득 +30P</p><div class="battle-summary" id="summary" aria-live="polite"></div><div class="panel" id="battleControls"></div><div class="battle-ideas" id="ideas"></div><p class="small" id="battleConnection" role="status"></p></div>`);
 async function act(body){if(busy)return;busy=true;try{const data=await api('rooms/'+code+'/battle',{...body,id,token});if(active){signature='';paint(data)}}catch(e){if(active)toast(e.message)}finally{busy=false}}
 const buttons=(action)=>latest.options.map((o,i)=>`<button class="votechoice" data-action="${action}" data-side="${i}">${esc(o.text)} ${action==='final'?'쪽으로 이동 →':''}</button>`).join('');
 function paint(x){
  if(!active)return;latest=x;const g=x.game,phase=g.phase,closed=x.closed,stage=phases.indexOf(phase);
  document.querySelector('#battlePhase').textContent=closed&&phase!=='finished'?'중단된 경기':names[stage];
  document.querySelector('#battleCount').textContent=`${x.count}명 참여 · CODE ${code}`;
  document.querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('on',Number(el.dataset.step)===(stage<2?0:stage<4?1:2)));
  document.querySelector('#leftScore').textContent=g.scores[0]+' P';document.querySelector('#rightScore').textContent=g.scores[1]+' P';
  document.querySelector('#balanceGem').style.left=(g.scores[0]+g.scores[1]?25+50*g.scores[1]/(g.scores[0]+g.scores[1]):50)+'%';
  document.querySelector('#players').innerHTML=[0,1].map(side=>`<div class="team-players side-${side}">${g.players.filter(p=>p.side===side).map((p,i)=>`<span class="avatar ${p.changed?'changed':''}" title="${esc(p.label)}${p.changed?' · 진영 이동':''}" style="--delay:${i%5*.2}s">${side===0?'🧙':'🧝'}<small>${esc(p.label.replace('참가자 ',''))}</small></span>`).join('')||'<span class="waiting">참가자 대기 중</span>'}</div>`).join('');
  const summary=document.querySelector('#summary');
  summary.textContent=phase==='finished'?`${g.scores[0]===g.scores[1]?'🤝 무승부!':'🏆 '+x.options[g.scores[0]>g.scores[1]?0:1].text+' 팀 승리!'} 최종 선택 ${g.finalTotals[0]} : ${g.finalTotals[1]} · 미선택 ${x.count-g.finalCount}명`:phase==='vote'?`${g.voteCount} / ${x.count}명 투표 완료`:phase==='final'?`${g.finalCount} / ${x.count}명 최종 선택 완료`:'';
  const key=[phase,closed,!!g.me,g.me?.side,g.me?.idea,g.me?.voted,g.me?.final].join('|');
  if(signature!==key){signature=key;const el=document.querySelector('#battleControls');
   if(token){el.innerHTML=`${phase==='lobby'?`<div class="battle-invite"><div><div class="eyebrow">학생 참여 코드</div><div class="code">${code}</div><button class="secondary" id="battleCopy">참여 링크 복사</button></div>${qrSvg(location.origin+'/?join='+code)}</div><p class="small">학생 두 명 이상이 들어오면 시작하세요. 들어온 순서대로 두 팀에 번갈아 배정됩니다.</p>`:''}${phase==='duel'?'<h3>각 팀 대표가 돌아가며 1분씩 발언해 주세요.</h3><div id="duelClock" class="duel-clock"></div><p class="small">공감 수가 높은 논리의 작성자가 대표입니다. 동점이면 먼저 제출한 순서입니다. 타이머가 끝나면 선생님이 투표를 시작해 주세요.</p>':''}${phase==='vote'?'<h3>더 설득력 있었던 팀에 익명 투표!</h3><p class="small">본인 팀에도 투표할 수 있어요. 모두 참여했는지 확인하고 다음 단계로 이동하세요.</p>':''}${phase==='final'?'<h3>마음을 움직인 쪽으로 건너가세요.</h3><p class="small">자기 팀을 유지하거나 상대 팀으로 이동할 수 있어요. 선택한 팀에 10P, 상대 팀에서 이동하면 추가 30P!</p>':''}<div class="actions">${!closed&&nextText[phase]?`<button class="primary" data-action="advance">${nextText[phase]}</button>`:''}<button class="secondary" id="battleFull">전체 화면 ↗</button><button class="secondary" id="battleExport">결과 저장</button></div>`;
    document.querySelector('#battleFull').onclick=()=>document.querySelector('.battle').requestFullscreen().catch(()=>toast('전체 화면을 사용할 수 없습니다.'));
    document.querySelector('#battleExport').onclick=()=>{const a=document.createElement('a');const report={question:latest.question,code,phase:latest.game.phase,scores:latest.game.scores,finalTotals:latest.game.finalTotals,ideas:latest.game.ideas.map(({side,text,likes})=>({team:latest.options[side].text,text,likes}))};a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='논쟁배틀-'+code+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
    const copy=document.querySelector('#battleCopy');if(copy)copy.onclick=()=>navigator.clipboard.writeText(location.origin+'/?join='+code).then(()=>toast('참여 링크를 복사했어요.')).catch(()=>toast('주소창의 host를 join으로 바꾸면 학생 참여 주소입니다.'));
   }else if(closed){el.innerHTML='<h3>경기가 종료되었습니다. 함께 토론해 줘서 고마워요! ✦</h3>'}
   else if(!g.me){el.innerHTML=phase==='lobby'?'<h3>논쟁 아레나에 오신 것을 환영합니다!</h3><p class="small">참가하면 두 팀 중 하나에 자동으로 배정됩니다. 이름은 공개되지 않아요.</p><button class="primary" data-action="join">경기 참가하기 →</button>':'<h3>이미 시작된 경기입니다.</h3><p class="small">이번 경기는 관전하고 다음 경기에 참여해 주세요.</p>'}
   else{const team=`<div class="my-team">내 팀 · ${esc(x.options[g.me.side].text)}</div>`;
    if(phase==='lobby')el.innerHTML=team+'<h3>입장 완료! 선생님이 시작할 때까지 기다려 주세요.</h3>';
    if(phase==='ideas')el.innerHTML=team+(g.me.idea?'<p>내 논리를 제출했어요. 같은 팀 친구들의 논리에 공감해 주세요!</p>':'<form id="ideaForm"><label for="ideaText">우리 팀의 입장을 뒷받침하는 논리</label><textarea id="ideaText" required maxlength="300" placeholder="주장과 근거를 구체적으로 적어 주세요."></textarea><div class="actions"><button class="primary" type="submit">논리 제출 · +10P</button></div></form>');
    if(phase==='duel')el.innerHTML=team+'<h3>각 팀 대표의 이야기를 들어 주세요.</h3><div id="duelClock" class="duel-clock"></div><p class="small">아래 ★ 대표 논리의 작성자는 자기 차례에 1분 동안 발표해 주세요.</p>';
    if(phase==='vote')el.innerHTML=team+(g.me.voted?'<h3>투표 완료! 최종 선택을 기다려 주세요.</h3>':'<h3>대표 발언을 듣고 더 설득력 있었던 팀을 골라 주세요.</h3>'+buttons('vote'));
    if(phase==='final')el.innerHTML=team+(g.me.final?'<h3>최종 선택 완료! 경기장에서 내 진영을 확인해 보세요.</h3>':'<h3>최종 입장 선택 · 마음이 움직였다면 건너가세요!</h3>'+buttons('final'));
   }
   el.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act({action:b.dataset.action,...(b.dataset.side!==undefined?{side:Number(b.dataset.side)}:{})}));
   const form=document.querySelector('#ideaForm');if(form)form.onsubmit=e=>{e.preventDefault();act({action:'idea',text:document.querySelector('#ideaText').value})};
  }
  document.querySelector('#ideas').innerHTML=[0,1].map(side=>`<section class="team-ideas"><h3>${esc(x.options[side].text)} <span>${g.totals[side]}명</span></h3>${g.ideas.filter(a=>a.side===side).sort((a,b)=>b.likes-a.likes).map(a=>`<article class="idea ${g.representatives[side].includes(a.id)&&stage>=2?'representative':''}">${stage>=2&&g.representatives[side].includes(a.id)?'<span class="rep-label">★ 대표 논리</span>':''}<p>${esc(a.text)}</p><div class="idea-bottom"><span>${a.mine?'내 논리':'익명 논리'}</span><button class="like ${a.liked?'liked':''}" data-like="${a.id}" ${phase!=='ideas'||closed||token||!g.me||g.me.side!==side||a.mine?'disabled':''}>♥ ${a.likes}</button></div></article>`).join('')||'<p class="small">아직 제출된 논리가 없어요.</p>'}</section>`).join('');
  document.querySelectorAll('[data-like]').forEach(b=>b.onclick=()=>act({action:'like',idea:b.dataset.like}));
 }
 paint(r);
 const poll=setInterval(async()=>{try{const data=await api('rooms/'+code+'?id='+encodeURIComponent(id));if(active){paint(data);document.querySelector('#battleConnection').textContent='실시간 연결 중 · 1.6초마다 갱신'}}catch{if(active)document.querySelector('#battleConnection').textContent='연결을 확인하고 있어요. 자동으로 다시 시도합니다.'}},1600);
 const clock=setInterval(()=>{const el=document.querySelector('#duelClock');if(el&&latest.game.deadline){const seconds=Math.max(0,Math.ceil((latest.game.deadline-Date.now())/1000)),left=seconds>60;el.textContent=seconds?`${latest.options[left?0:1].text} 팀 · ${String(Math.floor((seconds>60?seconds-60:seconds)/60)).padStart(2,'0')}:${String((seconds>60?seconds-60:seconds)%60).padStart(2,'0')}`:'발언 시간 종료'}} ,250);
 cleanup(()=>{active=false;clearInterval(poll);clearInterval(clock)});
}
