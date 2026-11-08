import {qrSvg} from '/qr.js';
import {openBattleReport,battleResultText} from '/battle-report.js';

export function battleUI({code,token,r,api,esc,shell,toast,cleanup}){
 let id=localStorage.getItem('participant');
 if(!id){id=crypto.randomUUID();localStorage.setItem('participant',id)}
 let active=true,latest=r,signature='',busy=false,boardSignature='',playersSignature='',lastBoardPhase='',closeReport;
 const openFirst=r.game.workflow==='open-first';
 const names={lobby:'대기실 · 소속 없음',ideas:'1단계 · 자유 댓글',choose:'2단계 · 첫 찬반 선택',duel:'3단계 · 재토론',vote:'토론 투표',final:'4단계 · 최종 진영 선택',finished:'경기 종료'};
 const nextText={lobby:'자유 댓글 시작 →',ideas:openFirst?'첫 찬반 선택 시작 →':'재토론 시작 →',choose:'재토론 시작 →',duel:openFirst?'최종 진영 선택 시작 →':'토론 마치고 투표 시작 →',vote:'최종 선택 시작 →',final:'경기 종료 · 결과 공개'};
 const writing=()=>!latest.closed&&['ideas','duel'].includes(latest.game.phase);
 const expired=()=>!!latest.game.deadline&&Date.now()>=latest.game.deadline;
 const $=selector=>document.querySelector(selector);
 shell('debate',`<div class="battle"><div class="battle-header"><span class="battle-label" id="battlePhase"></span><span id="battleCount"></span></div><h2 class="battle-topic">${esc(r.question)}</h2><div class="battle-steps">${['자유 댓글','첫 찬반 선택','재토론','최종 선택'].map((x,i)=>`<span data-step="${i}">${i+1}. ${x}</span>`).join('')}</div><div class="arena"><div class="arena-sky"><span>✦</span><span>✧</span><span>✦</span></div><div class="scoreboard"><span id="leftScore"></span><span class="score-vs">VS</span><span id="rightScore"></span></div><div class="arena-teams"><strong>${esc(r.options[0].text)}</strong><strong>${esc(r.options[1].text)}</strong></div><div class="battle-rope"><i id="balanceGem">◆</i></div><div class="arena-players" id="players"></div><div class="arena-ground"></div></div><p class="battle-rule">첫 댓글 10P · 공감 5P · ${openFirst?'첫 선택':'토론 투표'} 20P · 최종 선택 10P · 상대 팀 설득 +30P</p><div class="battle-summary" id="summary" aria-live="polite"></div><div class="battle-clock" id="writingClock" role="timer" hidden></div><p class="small" id="writingStatus"></p><div class="panel" id="battleControls"></div><div class="battle-ideas" id="ideas"></div><nav class="battle-navigation" aria-label="토론 나가기"><a href="/">← 모든 도구로 돌아가기</a>${token?'<a href="/?tool=debate">새 논제로 토론 만들기 ↗</a>':''}</nav><p class="small" id="battleConnection" role="status"></p></div>`);

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
  const g=x.game,phase=g.phase,closed=x.closed;
  $('#battlePhase').textContent=closed&&phase!=='finished'?'중단된 경기':names[phase];
  $('#battleCount').textContent=`${x.count}명 참여 · CODE ${code}`;
  document.querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('on',Number(el.dataset.step)===({lobby:0,ideas:0,choose:1,duel:2,vote:2,final:3,finished:3}[phase])));
  $('#leftScore').textContent=g.scores[0]+' P';$('#rightScore').textContent=g.scores[1]+' P';
  $('#balanceGem').style.left=(g.scores[0]+g.scores[1]?25+50*g.scores[1]/(g.scores[0]+g.scores[1]):50)+'%';
  const playerKey=JSON.stringify(g.players);
  if(playerKey!==playersSignature){
   playersSignature=playerKey;
   const group=(list,side)=>`<div class="team-players ${side===null?'neutral-players':'side-'+side}">${side===null?'<span class="neutral-label">소속 없음 · 자유 의견</span>':''}${list.map((p,i)=>`<div class="arena-character">${p.bubble?`<div class="speech-bubble" title="${esc(p.bubble)}"><span class="bubble-round">${p.bubbleRound==='free'?'자유 댓글':'재토론'}</span><span>${esc(p.bubble)}</span></div>`:''}<span class="avatar ${p.changed?'changed':''}" title="${esc(p.label)}${p.changed?' · 진영 이동':''}" style="--delay:${i%5*.2}s">${side===null?'🧑‍🎓':side===0?'🧙':'🧝'}<small>${esc(p.label.replace('참가자 ',''))}</small></span><span class="character-label">${esc(p.label)}</span></div>`).join('')||'<span class="waiting">참가자 대기 중</span>'}</div>`;
   const neutral=g.players.filter(p=>p.side===null);
   $('#players').innerHTML=(neutral.length?group(neutral,null):'')+(neutral.length===g.players.length?'':[0,1].map(side=>group(g.players.filter(p=>p.side===side),side)).join(''));

  }
  $('#summary').textContent=closed?`${phase==='finished'?'🏆 ':''}${battleResultText(x)} · 최종 선택 ${g.finalTotals[0]} : ${g.finalTotals[1]} · 미선택 ${x.count-g.finalCount}명`:phase==='choose'?`${g.voteCount} / ${x.count}명 첫 찬반 선택 완료`:phase==='vote'?`${g.voteCount} / ${x.count}명 투표 완료`:phase==='final'?`${g.finalCount} / ${x.count}명 최종 선택 완료`:'';

  // Keep the textarea intact during polling and likes so unfinished comments are not lost.
  const key=[phase,closed,!!g.me,g.me?.side,g.me?.voted,g.me?.final].join('|');
  if(signature!==key){
   signature=key;const el=$('#battleControls');
   if(token){
    el.innerHTML=`${phase==='lobby'?`<div class="battle-invite"><div><div class="eyebrow">학생 참여 코드</div><div class="code">${code}</div><button class="secondary" id="battleCopy">참여 링크 복사</button></div>${qrSvg(location.origin+'/?join='+code)}</div><p class="small">${openFirst?'처음에는 누구도 찬성·반대에 소속되지 않습니다. 자유 댓글을 나눈 뒤 각자 첫 찬반을 선택합니다.':'이 방은 이전 진행 방식으로 열렸습니다. 새 방에서는 자유 댓글부터 시작합니다.'} 학생 두 명 이상이 들어오면 시작하세요.</p>`:''}${writing()?`<h3>${phase==='ideas'?'소속 없이 자유롭게 생각을 쓰는 시간입니다.':'첫 찬반 선택 후, 서로의 의견을 읽고 재토론하는 시간입니다.'}</h3><p class="small">각 단계의 작성 시간은 5분입니다. 일찍 끝나면 아래 버튼으로 바로 다음 단계로 넘길 수 있어요.</p><p class="comment-progress" id="commentProgress"></p>`:''}${phase==='choose'?'<h3>자유 댓글을 읽고 첫 찬반을 선택해 주세요.</h3><p class="small" id="choiceProgress"></p>':''}${phase==='vote'?'<h3>댓글 토론을 읽고 더 설득력 있었던 팀에 투표해 주세요.</h3><p class="small">모두 참여했는지 확인하고 다음 단계로 이동하세요.</p>':''}${phase==='final'?'<h3>마음을 움직인 쪽으로 건너가세요.</h3><p class="small">자기 팀을 유지하거나 상대 팀으로 이동할 수 있어요. 선택한 팀에 10P, 상대 팀에서 이동하면 추가 30P!</p>':''}<div class="actions">${!closed&&nextText[phase]?`<button class="primary" data-action="advance">${nextText[phase]}</button>`:''}${closed?'<button class="primary" id="battleRestart">같은 논제로 처음부터 다시 시작 ↻</button>':''}<button class="secondary" id="battleFull">전체 화면 ↗</button><button class="secondary" id="battleExport">결과 보고서 보기 / 저장</button></div>${closed?'<p class="small">다시 시작하면 새 참여 코드가 만들어집니다. 지금 토론의 결과와 댓글은 그대로 남아요.</p>':''}`;
    $('#battleFull').onclick=()=>$('.battle').requestFullscreen().catch(()=>toast('전체 화면을 사용할 수 없습니다.'));
    $('#battleExport').onclick=()=>{closeReport?.();closeReport=openBattleReport(latest,code)};
    if($('#battleRestart'))$('#battleRestart').onclick=restart;
    if($('#battleCopy'))$('#battleCopy').onclick=()=>navigator.clipboard.writeText(location.origin+'/?join='+code).then(()=>toast('참여 링크를 복사했어요.')).catch(()=>toast('주소창의 host를 join으로 바꾸면 학생 참여 주소입니다.'));
   }else if(closed){
    el.innerHTML='<h3>토론이 끝났습니다. 함께 생각을 나눠 줘서 고마워요! ✦</h3><p class="small">다음 토론은 선생님이 공유한 새 참여 링크나 QR 코드로 들어가 주세요.</p>';
   }else if(!g.me){
    el.innerHTML=phase==='lobby'?'<h3>논쟁 아레나에 오신 것을 환영합니다!</h3><p class="small">처음에는 소속 없이 자유롭게 의견을 남깁니다. 첫 찬반 선택은 나중에 직접 해요. 이름 대신 참가자 번호를 사용해요.</p><button class="primary" data-action="join">경기 참가하기 →</button>':'<h3>이미 시작된 토론입니다.</h3><p class="small">이번에는 댓글을 읽으며 관전하고 다음 토론에 참여해 주세요.</p>';
   }else{
    const team=`<div class="my-team">${g.me.side===null?'소속 없음 · 자유 의견':'내 입장 · '+esc(x.options[g.me.side].text)}</div>`;
    if(phase==='lobby')el.innerHTML=team+'<h3>입장 완료! 선생님이 시작할 때까지 기다려 주세요.</h3>';
    if(writing())el.innerHTML=team+`<h3>${phase==='ideas'?'아직 찬반을 고르지 않아도 됩니다. 내 생각을 자유롭게 써 주세요.':'서로의 의견을 읽고 질문이나 반론을 재토론 댓글로 써 주세요.'}</h3><form id="ideaForm"><label for="ideaText">${phase==='ideas'?'자유 댓글':'재토론 댓글'}</label><textarea id="ideaText" required maxlength="300" placeholder="상대를 존중하며 내 생각을 구체적으로 적어 주세요."></textarea><div class="actions"><button class="primary" type="submit">댓글 올리기 ↗</button></div><p class="small" id="commentCount"></p></form><p class="small">댓글은 해당 단계의 목록과 내 캐릭터 말풍선에 표시됩니다. 팀과 관계없이 다른 참가자의 댓글에 하트를 누를 수 있어요.</p>`;
    if(phase==='choose')el.innerHTML=team+(g.me.voted?'<h3>첫 찬반 선택을 마쳤어요. 모두 선택하면 선생님이 재토론을 시작합니다.</h3>':'<h3>지금 내 생각에 맞는 입장을 골라 주세요.</h3>'+buttons('choose'));
    if(phase==='vote')el.innerHTML=team+(g.me.voted?'<h3>투표 완료! 최종 선택을 기다려 주세요.</h3>':'<h3>댓글 토론에서 더 설득력 있었던 팀을 골라 주세요.</h3>'+buttons('vote'));
    if(phase==='final')el.innerHTML=team+(g.me.final?'<h3>최종 선택 완료! 경기장에서 내 진영을 확인해 보세요.</h3>':'<h3>최종 입장 선택 · 마음이 움직였다면 건너가세요!</h3>'+buttons('final'));
   }
   el.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>act({action:button.dataset.action,...(button.dataset.side!==undefined?{side:Number(button.dataset.side)}:{})}));
   if($('#ideaForm'))$('#ideaForm').onsubmit=event=>{event.preventDefault();act({action:'idea',text:$('#ideaText').value})};
  }
  const currentComments=g.ideas.filter(a=>a.round===(phase==='ideas'&&openFirst?'free':'debate'));
  if($('#commentProgress'))$('#commentProgress').textContent=`이번 단계 댓글 ${currentComments.length}개 · 작성한 학생 ${new Set(currentComments.map(a=>a.authorLabel)).size} / ${x.count}명`;
  if($('#choiceProgress'))$('#choiceProgress').textContent=`${g.voteCount} / ${x.count}명 선택 완료 · ${x.options[0].text} ${g.totals[0]}명 / ${x.options[1].text} ${g.totals[1]}명 · 모두 선택하면 재토론을 시작할 수 있어요.`;
  if($('#commentCount'))$('#commentCount').textContent=`내 댓글 ${g.me?.commentCount||0} / 20개 · 300자 이내 · 첫 댓글만 10P`;

  const boardKey=JSON.stringify([g.ideas,phase,closed,g.me?.side,!!token]);
  if(boardKey!==boardSignature){
   boardSignature=boardKey;
   const comment=a=>`<article class="idea" data-comment-round="${a.round}"><div class="idea-bottom"><strong>${esc(a.authorLabel||'참가자')}${a.mine?' · 내 댓글':''}</strong><button class="like ${a.liked?'liked':''}" data-like="${a.id}" aria-label="${a.liked?'공감 취소':'공감'} · ${a.likes}개" aria-pressed="${a.liked}" title="${esc(a.likeReason||(a.liked?'다시 누르면 공감을 취소해요.':'이 댓글에 공감해요.'))}" ${a.canLike?'':'disabled'}>♥ ${a.likes}${closed?' · 마감':''}</button></div><p>${esc(a.text)}</p></article>`;
   const free=g.ideas.filter(a=>a.round==='free'),debate=g.ideas.filter(a=>a.round==='debate');
   const freeOpen=['ideas','choose'].includes(phase)&&lastBoardPhase!==phase?true:phase==='duel'&&lastBoardPhase!=='duel'?false:($('#freeComments')?.open??(phase==='ideas'||phase==='choose'));
   const debateOpen=phase==='duel'&&lastBoardPhase!=='duel'?true:($('#debateComments')?.open??['duel','vote','final','finished'].includes(phase));
   $('#ideas').innerHTML=`<p class="small heart-help">♥ 다른 참가자의 댓글은 팀과 관계없이 공감·취소할 수 있습니다. 선생님도 공감할 수 있어요. 내 댓글과 마감된 단계의 하트는 눌리지 않습니다.</p>${openFirst?`<details id="freeComments" class="round-comments free-comments" ${freeOpen?'open':''}><summary>1. 자유 댓글 <span>${free.length}개 · 찬반 선택 전</span></summary><div class="free-comment-list">${free.map(comment).join('')||'<p class="small">아직 자유 댓글이 없어요.</p>'}</div></details>`:''}<details id="debateComments" class="round-comments debate-comments" ${debateOpen?'open':''}><summary>${openFirst?'3. ':''}재토론 댓글 <span>${debate.length}개 · 첫 찬반 선택 후</span></summary><div class="round-team-columns">${[0,1].map(side=>`<section class="team-ideas"><h3>${esc(x.options[side].text)} <span>${g.totals[side]}명 · 댓글 ${debate.filter(a=>a.side===side).length}개</span></h3>${debate.filter(a=>a.side===side).map(comment).join('')||'<p class="small">아직 재토론 댓글이 없어요.</p>'}</section>`).join('')}</div></details>`;
   lastBoardPhase=phase;

   document.querySelectorAll('[data-like]').forEach(button=>button.onclick=()=>act({action:'like',idea:button.dataset.like}));
  }
  updateClock();
 }
 function updateClock(){
  if(!active)return;
  const clock=$('#writingClock'),status=$('#writingStatus');clock.hidden=!writing();
  const ended=writing()&&expired();
  if(writing()){
   const seconds=latest.game.deadline?Math.max(0,Math.ceil((latest.game.deadline-Date.now())/1000)):null;
   clock.textContent=seconds===null?'댓글 작성 중':`작성 시간 ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
   status.textContent=ended?'작성 시간이 끝났어요. 댓글을 읽으며 선생님이 다음 단계로 넘길 때까지 기다려 주세요.':'각 작성 단계 5분 · 작성이 끝나면 선생님이 바로 다음으로 넘길 수 있어요.';
   clock.classList.toggle('time-ended',ended);
  }else status.textContent='';
  if($('#ideaText'))$('#ideaText').disabled=ended;
  const submit=$('#ideaForm button');if(submit)submit.disabled=busy||ended||(latest.game.me?.commentCount||0)>=20;
  if(latest.game.phase==='choose'&&token){const advance=$('[data-action="advance"]');if(advance)advance.disabled=busy||latest.game.voteCount<latest.count}
  $('.battle').querySelectorAll('[data-like]').forEach(button=>{const idea=latest.game.ideas.find(a=>a.id===button.dataset.like);button.disabled=busy||ended||!idea?.canLike});
 }

 paint(r);
 // Read personal state immediately; the original entry response has no participant id.
 const refresh=async()=>{
  try{const data=await api('rooms/'+code+'?id='+encodeURIComponent(id),undefined,token?{headers:{'X-Teacher-Token':token}}:{});if(active){paint(data);$('#battleConnection').textContent='실시간 연결 중 · 1.6초마다 갱신'}}
  catch{if(active)$('#battleConnection').textContent='연결을 확인하고 있어요. 자동으로 다시 시도합니다.'}
 };
 refresh();const poll=setInterval(refresh,1600),clock=setInterval(updateClock,250);
 cleanup(()=>{active=false;clearInterval(poll);clearInterval(clock);closeReport?.()});
}
