import {qrSvg} from '/qr.js';
import {openBattleReport,battleResultText} from '/battle-report.js';

export function battleUI({code,token,r,api,esc,shell,toast,cleanup}){
 let id=localStorage.getItem('participant');
 if(!id){id=crypto.randomUUID();localStorage.setItem('participant',id)}
 let active=true,latest=r,signature='',busy=false,boardSignature='',playersSignature='',closeReport;
 const names={lobby:'입장 선택 · 대기실',ideas:'1라운드 · 내 생각 쓰기',duel:'2라운드 · 댓글 토론',vote:'2라운드 · 토론 투표',final:'3라운드 · 최종 선택',finished:'경기 종료'};
 const phases=['lobby','ideas','duel','vote','final','finished'];
 const nextText={lobby:'1라운드 시작 →',ideas:'댓글 토론 시작 →',duel:'토론 마치고 투표 시작 →',vote:'최종 선택 시작 →',final:'경기 종료 · 결과 공개'};
 const writing=()=>!latest.closed&&['ideas','duel'].includes(latest.game.phase);
 const expired=()=>!!latest.game.deadline&&Date.now()>=latest.game.deadline;
 const $=selector=>document.querySelector(selector);
 shell('debate',`<div class="battle"><div class="battle-header"><span class="battle-label" id="battlePhase"></span><span id="battleCount"></span></div><h2 class="battle-topic">${esc(r.question)}</h2><div class="battle-steps">${['내 생각 쓰기','댓글 토론','최종 선택'].map((x,i)=>`<span data-step="${i}">${i+1}. ${x}</span>`).join('')}</div><div class="arena"><div class="arena-sky"><span>✦</span><span>✧</span><span>✦</span></div><div class="scoreboard"><span id="leftScore"></span><span class="score-vs">VS</span><span id="rightScore"></span></div><div class="arena-teams"><strong>${esc(r.options[0].text)}</strong><strong>${esc(r.options[1].text)}</strong></div><div class="battle-rope"><i id="balanceGem">◆</i></div><div class="arena-players" id="players"></div><div class="arena-ground"></div></div><p class="battle-rule">첫 댓글 10P · 친구 공감 5P · 토론 투표 20P · 최종 선택 10P · 상대 팀 설득 +30P</p><div class="battle-summary" id="summary" aria-live="polite"></div><div class="battle-clock" id="writingClock" role="timer" hidden></div><p class="small" id="writingStatus"></p><div class="panel" id="battleControls"></div><div class="battle-ideas" id="ideas"></div><nav class="battle-navigation" aria-label="토론 나가기"><a href="/">← 모든 도구로 돌아가기</a>${token?'<a href="/?tool=debate">새 논제로 토론 만들기 ↗</a>':''}</nav><p class="small" id="battleConnection" role="status"></p></div>`);

 function setBusy(value){
  busy=value;
  $('.battle').querySelectorAll('[data-action],[data-like],#ideaForm button,#battleRestart').forEach(button=>{
   if(value){button.dataset.wasDisabled=String(button.disabled);button.disabled=true}
   else if(button.dataset.wasDisabled!==undefined){button.disabled=button.dataset.wasDisabled==='true';delete button.dataset.wasDisabled}
  });
  updateClock();
 }
 async function act(body){
  if(busy)return;setBusy(true);
  try{
   const data=await api('rooms/'+code+'/battle',{...body,id,token});
   if(active){
    if(body.action==='idea'){if($('#ideaText'))$('#ideaText').value='';toast('댓글이 팀 목록과 말풍선에 추가됐어요.')}
    paint(data);
   }
  }catch(e){if(active)toast(e.message)}
  finally{if(active)setBusy(false)}
 }
 async function restart(){
  if(busy)return;setBusy(true);
  try{
   const fresh=await api('rooms',{type:'debate',game:true,question:latest.question,options:latest.options.map(o=>o.text)});
   sessionStorage.setItem('host-'+fresh.code,fresh.token);
   if(!active)return;
   history.pushState({inApp:true},'','/?host='+fresh.code);
   battleUI({code:fresh.code,token:fresh.token,r:fresh,api,esc,shell,toast,cleanup});
   toast('같은 논제로 새 대기실을 열었어요. 새 참여 코드를 공유해 주세요.');
  }catch(e){if(active){toast(e.message);setBusy(false)}}
 }
 const buttons=action=>latest.options.map((o,i)=>`<button class="votechoice" data-action="${action}" data-side="${i}">${esc(o.text)} ${action==='final'?'쪽으로 이동 →':''}</button>`).join('');

 function paint(x){
  if(!active||(x.game.revision||0)<(latest.game.revision||0))return;
  latest=x;
  const g=x.game,phase=g.phase,closed=x.closed,stage=phases.indexOf(phase);
  $('#battlePhase').textContent=closed&&phase!=='finished'?'중단된 경기':names[phase];
  $('#battleCount').textContent=`${x.count}명 참여 · CODE ${code}`;
  document.querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('on',Number(el.dataset.step)===(stage<2?0:stage<4?1:2)));
  $('#leftScore').textContent=g.scores[0]+' P';$('#rightScore').textContent=g.scores[1]+' P';
  $('#balanceGem').style.left=(g.scores[0]+g.scores[1]?25+50*g.scores[1]/(g.scores[0]+g.scores[1]):50)+'%';
  const playerKey=JSON.stringify(g.players);
  if(playerKey!==playersSignature){
   playersSignature=playerKey;
   $('#players').innerHTML=[0,1].map(side=>`<div class="team-players side-${side}">${g.players.filter(p=>p.side===side).map((p,i)=>`<div class="arena-character">${p.bubble?`<div class="speech-bubble" title="${esc(p.bubble)}"><span>${esc(p.bubble)}</span></div>`:''}<span class="avatar ${p.changed?'changed':''}" title="${esc(p.label)}${p.changed?' · 진영 이동':''}" style="--delay:${i%5*.2}s">${side===0?'🧙':'🧝'}<small>${esc(p.label.replace('참가자 ',''))}</small></span><span class="character-label">${esc(p.label)}</span></div>`).join('')||'<span class="waiting">참가자 대기 중</span>'}</div>`).join('');
  }
  $('#summary').textContent=closed?`${phase==='finished'?'🏆 ':''}${battleResultText(x)} · 최종 선택 ${g.finalTotals[0]} : ${g.finalTotals[1]} · 미선택 ${x.count-g.finalCount}명`:phase==='vote'?`${g.voteCount} / ${x.count}명 투표 완료`:phase==='final'?`${g.finalCount} / ${x.count}명 최종 선택 완료`:'';

  // Keep the textarea intact during polling and likes so unfinished comments are not lost.
  const key=[phase,closed,!!g.me,g.me?.side,g.me?.voted,g.me?.final].join('|');
  if(signature!==key){
   signature=key;const el=$('#battleControls');
   if(token){
    el.innerHTML=`${phase==='lobby'?`<div class="battle-invite"><div><div class="eyebrow">학생 참여 코드</div><div class="code">${code}</div><button class="secondary" id="battleCopy">참여 링크 복사</button></div>${qrSvg(location.origin+'/?join='+code)}</div><p class="small">학생 두 명 이상이 들어오면 시작하세요. 들어온 순서대로 두 팀에 번갈아 배정됩니다.</p>`:''}${writing()?`<h3>${phase==='ideas'?'학생들이 자기 생각을 댓글로 쓰는 시간입니다.':'양쪽 댓글을 읽고 질문·반론을 댓글로 주고받아 보세요.'}</h3><p class="small">각 단계의 작성 시간은 5분입니다. 일찍 끝나면 아래 버튼으로 바로 다음 단계로 넘길 수 있어요.</p><p class="comment-progress" id="commentProgress"></p>`:''}${phase==='vote'?'<h3>댓글 토론을 읽고 더 설득력 있었던 팀에 투표해 주세요.</h3><p class="small">모두 참여했는지 확인하고 다음 단계로 이동하세요.</p>':''}${phase==='final'?'<h3>마음을 움직인 쪽으로 건너가세요.</h3><p class="small">자기 팀을 유지하거나 상대 팀으로 이동할 수 있어요. 선택한 팀에 10P, 상대 팀에서 이동하면 추가 30P!</p>':''}<div class="actions">${!closed&&nextText[phase]?`<button class="primary" data-action="advance">${nextText[phase]}</button>`:''}${closed?'<button class="primary" id="battleRestart">같은 논제로 처음부터 다시 시작 ↻</button>':''}<button class="secondary" id="battleFull">전체 화면 ↗</button><button class="secondary" id="battleExport">결과 보고서 보기 / 저장</button></div>${closed?'<p class="small">다시 시작하면 새 참여 코드가 만들어집니다. 지금 토론의 결과와 댓글은 그대로 남아요.</p>':''}`;
    $('#battleFull').onclick=()=>$('.battle').requestFullscreen().catch(()=>toast('전체 화면을 사용할 수 없습니다.'));
    $('#battleExport').onclick=()=>{closeReport?.();closeReport=openBattleReport(latest,code)};
    if($('#battleRestart'))$('#battleRestart').onclick=restart;
    if($('#battleCopy'))$('#battleCopy').onclick=()=>navigator.clipboard.writeText(location.origin+'/?join='+code).then(()=>toast('참여 링크를 복사했어요.')).catch(()=>toast('주소창의 host를 join으로 바꾸면 학생 참여 주소입니다.'));
   }else if(closed){
    el.innerHTML='<h3>토론이 끝났습니다. 함께 생각을 나눠 줘서 고마워요! ✦</h3><p class="small">다음 토론은 선생님이 공유한 새 참여 링크나 QR 코드로 들어가 주세요.</p>';
   }else if(!g.me){
    el.innerHTML=phase==='lobby'?'<h3>논쟁 아레나에 오신 것을 환영합니다!</h3><p class="small">참가하면 두 팀 중 하나에 자동으로 배정됩니다. 이름 대신 참가자 번호를 사용해요.</p><button class="primary" data-action="join">경기 참가하기 →</button>':'<h3>이미 시작된 토론입니다.</h3><p class="small">이번에는 댓글을 읽으며 관전하고 다음 토론에 참여해 주세요.</p>';
   }else{
    const team=`<div class="my-team">내 팀 · ${esc(x.options[g.me.side].text)}</div>`;
    if(phase==='lobby')el.innerHTML=team+'<h3>입장 완료! 선생님이 시작할 때까지 기다려 주세요.</h3>';
    if(writing())el.innerHTML=team+`<h3>${phase==='ideas'?'내 입장의 주장과 근거를 댓글로 써 주세요.':'양쪽 의견을 읽고 질문이나 반론을 댓글로 써 주세요.'}</h3><form id="ideaForm"><label for="ideaText">토론 댓글</label><textarea id="ideaText" required maxlength="300" placeholder="상대를 존중하며 내 생각을 구체적으로 적어 주세요."></textarea><div class="actions"><button class="primary" type="submit">댓글 올리기 ↗</button></div><p class="small" id="commentCount"></p></form><p class="small">댓글은 아래 팀별 목록과 내 캐릭터의 말풍선에 표시됩니다. 같은 팀 친구의 댓글에 공감할 수 있어요.</p>`;
    if(phase==='vote')el.innerHTML=team+(g.me.voted?'<h3>투표 완료! 최종 선택을 기다려 주세요.</h3>':'<h3>댓글 토론에서 더 설득력 있었던 팀을 골라 주세요.</h3>'+buttons('vote'));
    if(phase==='final')el.innerHTML=team+(g.me.final?'<h3>최종 선택 완료! 경기장에서 내 진영을 확인해 보세요.</h3>':'<h3>최종 입장 선택 · 마음이 움직였다면 건너가세요!</h3>'+buttons('final'));
   }
   el.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>act({action:button.dataset.action,...(button.dataset.side!==undefined?{side:Number(button.dataset.side)}:{})}));
   if($('#ideaForm'))$('#ideaForm').onsubmit=event=>{event.preventDefault();act({action:'idea',text:$('#ideaText').value})};
  }
  if($('#commentProgress'))$('#commentProgress').textContent=`댓글 ${g.ideas.length}개 · 작성한 학생 ${new Set(g.ideas.map(a=>a.authorLabel)).size} / ${x.count}명`;
  if($('#commentCount'))$('#commentCount').textContent=`내 댓글 ${g.me?.commentCount||0} / 20개 · 300자 이내 · 첫 댓글만 10P`;

  const boardKey=JSON.stringify([g.ideas,phase,closed,g.me?.side,!!token]);
  if(boardKey!==boardSignature){
   boardSignature=boardKey;
   $('#ideas').innerHTML=[0,1].map(side=>`<section class="team-ideas"><h3>${esc(x.options[side].text)} <span>${g.totals[side]}명 · 댓글 ${g.ideas.filter(a=>a.side===side).length}개</span></h3>${g.ideas.filter(a=>a.side===side).map(a=>`<article class="idea"><div class="idea-bottom"><strong>${esc(a.authorLabel||'참가자')}${a.mine?' · 내 댓글':''}</strong><button class="like ${a.liked?'liked':''}" data-like="${a.id}" ${!writing()||expired()||token||!g.me||g.me.side!==side||a.mine?'disabled':''}>♥ ${a.likes}</button></div><p>${esc(a.text)}</p></article>`).join('')||'<p class="small">아직 작성된 댓글이 없어요.</p>'}</section>`).join('');
   document.querySelectorAll('[data-like]').forEach(button=>button.onclick=()=>act({action:'like',idea:button.dataset.like}));
  }
  updateClock();
 }
 function updateClock(){
  if(!active)return;
  const clock=$('#writingClock'),status=$('#writingStatus');clock.hidden=!writing();
  if(!writing()){status.textContent='';return}
  const seconds=latest.game.deadline?Math.max(0,Math.ceil((latest.game.deadline-Date.now())/1000)):null;
  clock.textContent=seconds===null?'댓글 작성 중':`작성 시간 ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const ended=seconds===0;
  status.textContent=ended?'작성 시간이 끝났어요. 댓글을 읽으며 선생님이 다음 단계로 넘길 때까지 기다려 주세요.':'각 단계 5분 · 작성이 끝나면 선생님이 바로 다음으로 넘길 수 있어요.';
  clock.classList.toggle('time-ended',ended);
  if($('#ideaText'))$('#ideaText').disabled=ended;
  const submit=$('#ideaForm button');if(submit)submit.disabled=busy||ended||(latest.game.me?.commentCount||0)>=20;
  $('.battle').querySelectorAll('[data-like]').forEach(button=>{const idea=latest.game.ideas.find(a=>a.id===button.dataset.like);button.disabled=busy||ended||!!token||!latest.game.me||idea?.side!==latest.game.me.side||idea?.mine});
 }
 paint(r);
 // Read personal state immediately; the original entry response has no participant id.
 const refresh=async()=>{
  try{const data=await api('rooms/'+code+'?id='+encodeURIComponent(id));if(active){paint(data);$('#battleConnection').textContent='실시간 연결 중 · 1.6초마다 갱신'}}
  catch{if(active)$('#battleConnection').textContent='연결을 확인하고 있어요. 자동으로 다시 시도합니다.'}
 };
 refresh();const poll=setInterval(refresh,1600),clock=setInterval(updateClock,250);
 cleanup(()=>{active=false;clearInterval(poll);clearInterval(clock);closeReport?.()});
}
