import {parseTeamNames,numberedTeamNames} from './team-engine.js';
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const teamText=result=>result.teams.map(team=>`${team.name} (${team.members.length}명): ${team.members.map(p=>p.name).join(', ')}`).join('\n');
export function teamReport(result){
 const e=escapeHTML;
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>g·class 팀 편성 결과</title><style>*{box-sizing:border-box}body{font-family:system-ui,"Malgun Gothic",sans-serif;color:#2a493b;background:#f6f8f1;margin:0;padding:30px}main{max-width:1000px;margin:auto}h1{font-size:30px}header p{font-size:13px;color:#77856e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}.team{background:#fff;border:1px solid #d8e2ce;border-top:5px solid #9eb391;border-radius:14px;padding:22px;break-inside:avoid}.team h2{font-size:20px;margin:0 0 12px}.team h2 small{font-size:12px;margin-left:8px;color:#819276}.team ul{padding-left:22px;line-height:2;overflow-wrap:anywhere}.score{font-size:12px;color:#819276}button{background:#315b47;color:white;border:0;border-radius:8px;padding:12px 20px;cursor:pointer;font:inherit;margin-bottom:20px}footer{font-size:12px;color:#819276;margin-top:24px}@media print{@page{size:A4;margin:15mm}body{padding:0;background:white}button{display:none}.grid{display:block}.team{margin-bottom:14px}}</style></head><body><main><button onclick="window.print()">인쇄 / PDF로 저장</button><header><p>g·class · 고양외국어고등학교</p><h1>우리 반 팀 편성</h1><p>${result.count}명 · ${result.teams.length}팀 · ${result.balance?'능력치 균형 배정':'무작위 배정'} · 묶음/분리 조건 ${result.ruleCount}개</p></header><div class="grid">${result.teams.map(team=>`<section class="team"><h2>${e(team.name)}<small>${team.members.length}명</small></h2><ul>${team.members.map(p=>`<li>${e(p.name)}</li>`).join('')}</ul></section>`).join('')}</div><footer>팀별 인원 차이는 최대 1명입니다.</footer></main></body></html>`;
}
export function teamsUI({shell,esc,toast,cleanup}){
 const key='gyfl-team-maker';
 let state={mode:'numbers',total:30,excluded:'',namesText:'',method:'count',amount:6,balance:false,skills:{},rules:[],result:null,resultKey:null};
 try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved&&Array.isArray(saved.rules))state={...state,...saved}}catch{}
 let worker=null,active=true,people=[];const printFrames=new Set();
 const $=s=>document.querySelector(s);
 const save=()=>{try{sessionStorage.setItem(key,JSON.stringify(state))}catch{}};
 const roster=()=>state.mode==='numbers'?numberedTeamNames(state.total,state.excluded):parseTeamNames(state.namesText);
 const settings=()=>{const names=roster();return {names,method:state.method,amount:state.amount,balance:state.balance,skills:state.balance?Object.fromEntries(names.map(name=>[name,Object.hasOwn(state.skills,name)?state.skills[name]:5])):{},rules:state.rules}};
 const settingsKey=()=>{try{return JSON.stringify(settings())}catch{return ''}};
 shell('teams',`<div class="team-maker"><form id="teamForm" novalidate><fieldset id="teamSettings"><section class="panel"><div class="team-panel-title"><div><span class="eyebrow">STEP 01</span><h2>누구와 함께할까요?</h2></div><span class="team-count" id="teamCount"></span></div><div class="tabs" aria-label="명단 입력 방식"><button type="button" id="numberMode">번호로 입력</button><button type="button" id="nameMode">이름으로 입력</button></div><div class="fields" id="teamNumberFields"><div><label for="teamTotal">총 학생 수</label><input id="teamTotal" type="number" min="2" max="200" value="${esc(state.total)}"></div><div><label for="teamExcluded">제외할 번호</label><input id="teamExcluded" placeholder="예: 3, 7-9" value="${esc(state.excluded)}"></div></div><div id="teamNameFields"><label for="teamNames">학생 이름 · 한 줄에 한 명씩</label><textarea id="teamNames" rows="5" placeholder="1번 김민지&#10;2번 이서준&#10;3번 박지우">${esc(state.namesText)}</textarea><p class="small">쉼표로 구분해도 됩니다. 같은 이름은 번호를 붙여 구분해 주세요.</p></div><p class="small" id="rosterPreview"></p></section><section class="panel"><div class="team-panel-title"><div><span class="eyebrow">STEP 02</span><h2>어떻게 나눌까요?</h2></div></div><div class="fields"><div><label for="teamMethod">편성 기준</label><select id="teamMethod"><option value="count">팀 수로 나누기</option><option value="size">팀당 인원으로 나누기</option></select></div><div><label for="teamAmount" id="teamAmountLabel">팀 수</label><input id="teamAmount" type="number" min="1" max="200" value="${esc(state.amount)}"></div></div><p class="team-distribution" id="distribution"></p><label class="team-checkbox"><input type="checkbox" id="teamBalance" ${state.balance?'checked':''}> 능력치를 고려해 균형 있게 나누기</label><p class="small">기본은 무작위 배정입니다. 능력치를 켜면 팀별 점수 차이를 줄이도록 배정합니다.</p><div id="teamSkills" hidden><p class="small">학생별로 1~10점을 입력하세요. 기본 점수는 5점이며 결과 명단에는 개인 점수가 표시되지 않습니다.</p><div class="skill-grid" id="skillInputs"></div></div></section><section class="panel"><div class="team-panel-title"><div><span class="eyebrow">STEP 03 · OPTIONAL</span><h2>묶거나, 떨어뜨리거나</h2></div><button type="button" class="secondary" id="showTeamRule" aria-expanded="false">+ 조건 추가</button></div><p class="small">‘같은 팀’은 함께 배치하고, ‘서로 다른 팀’은 선택한 학생을 한 팀에 한 명씩 배치합니다.</p><div id="teamRules"></div><div class="rule-editor" id="ruleEditor" hidden><label for="teamRuleType">배치 조건</label><select id="teamRuleType"><option value="together">같은 팀에 배치</option><option value="apart">서로 다른 팀에 배치</option></select><p class="small">아래에서 학생을 두 명 이상 선택하세요.</p><div class="rule-members" id="ruleMembers"></div><div class="actions"><button type="button" class="primary" id="addTeamRule">조건 추가하기</button><button type="button" class="secondary" id="cancelTeamRule">취소</button></div><p class="error" id="ruleError" role="alert"></p></div></section><div class="actions team-create-actions"><button class="primary" type="submit" id="makeTeams">✦ 팀 짜기</button></div></fieldset><button class="secondary" type="button" id="cancelTeamSearch" hidden>편성 중지</button><p class="error" id="teamError" role="alert"></p></form><section id="teamResults" hidden></section><p class="small team-source">명단과 결과는 이 브라우저 탭에 보관되며 서버로 전송하지 않습니다. · 참고: <a href="https://hobbada.github.io/" target="_blank" rel="noopener noreferrer">Team Maker ↗</a></p></div>`);
 $('#teamMethod').value=state.method;
 const markChanged=()=>{save();updateSummary();if(state.result)renderResult()};
 function updateSummary(){
  $('#teamAmountLabel').textContent=state.method==='count'?'만들 팀 수':'팀당 최대 인원';
  try{
   const names=roster(),n=names.length,value=Number(state.amount),count=state.method==='count'?value:Math.ceil(n/value);
   $('#teamCount').textContent=n+'명 참여';
   if(Number.isInteger(value)&&value>=1&&value<=n){const lo=Math.floor(n/count),hi=Math.ceil(n/count);$('#distribution').textContent=`${n}명 → ${count}팀 · 팀당 ${lo===hi?lo:lo+'~'+hi}명`}
   else $('#distribution').textContent='팀 수 또는 팀당 인원을 참여 학생 수 안에서 정해 주세요.';
  }catch(e){$('#teamCount').textContent='명단을 확인해 주세요';$('#distribution').textContent=e.message}
 }
 function updateRoster(){
  try{people=roster();$('#rosterPreview').textContent=people.slice(0,12).join(' · ')+(people.length>12?' · …':'')}
  catch{people=[];$('#rosterPreview').textContent='두 명 이상 입력하면 명단이 준비됩니다.'}
  $('#teamNumberFields').hidden=state.mode!=='numbers';$('#teamNameFields').hidden=state.mode!=='names';$('#teamTotal').disabled=state.mode!=='numbers';$('#teamExcluded').disabled=state.mode!=='numbers';$('#teamNames').disabled=state.mode!=='names';
  $('#numberMode').classList.toggle('active',state.mode==='numbers');$('#nameMode').classList.toggle('active',state.mode==='names');
  $('#skillInputs').innerHTML=people.map((name,i)=>`<label class="skill-person" for="teamSkill${i}"><span>${esc(name)}</span><input id="teamSkill${i}" type="number" min="1" max="10" value="${esc(Object.hasOwn(state.skills,name)?state.skills[name]:5)}" data-skill-index="${i}"></label>`).join('');
  document.querySelectorAll('[data-skill-index]').forEach(input=>input.oninput=()=>{state.skills={...state.skills,[people[Number(input.dataset.skillIndex)]]:input.value};markChanged()});
  $('#ruleMembers').innerHTML=people.map((name,i)=>`<label class="rule-person"><input type="checkbox" value="${i}"><span>${esc(name)}</span></label>`).join('')||'<p class="small">명단을 먼저 입력해 주세요.</p>';
  $('#teamSkills').hidden=!state.balance;$('#skillInputs').querySelectorAll('input').forEach(input=>input.disabled=!state.balance);renderRules();markChanged();
 }
 function renderRules(){
  $('#teamRules').innerHTML=state.rules.map((rule,i)=>`<div class="team-rule ${rule.members.some(n=>!people.includes(n))?'invalid-rule':''}"><div><strong>${rule.type==='together'?'같은 팀':'서로 다른 팀'}</strong><span>${rule.members.map(esc).join(' · ')}</span>${rule.members.some(n=>!people.includes(n))?'<small>명단에 없는 학생이 있어요. 명단을 수정하거나 이 조건을 지워 주세요.</small>':''}</div><button type="button" class="rule-remove" data-remove-rule="${i}" aria-label="${i+1}번째 조건 삭제">×</button></div>`).join('');
  document.querySelectorAll('[data-remove-rule]').forEach(button=>button.onclick=()=>{state.rules.splice(Number(button.dataset.removeRule),1);renderRules();markChanged()});
 }
 function showEditor(show){$('#ruleEditor').hidden=!show;$('#showTeamRule').setAttribute('aria-expanded',String(show));$('#ruleError').textContent=''}
 $('#showTeamRule').onclick=()=>showEditor($('#ruleEditor').hidden);$('#cancelTeamRule').onclick=()=>showEditor(false);
 $('#addTeamRule').onclick=()=>{
  const members=Array.from($('#ruleMembers').querySelectorAll('input:checked')).map(input=>people[Number(input.value)]);
  if(members.length<2){$('#ruleError').textContent='학생을 두 명 이상 선택해 주세요.';return}
  if(state.rules.length>=50){$('#ruleError').textContent='조건은 50개까지 추가할 수 있어요.';return}
  state.rules.push({type:$('#teamRuleType').value,members});renderRules();markChanged();showEditor(false);$('#ruleMembers').querySelectorAll('input').forEach(input=>input.checked=false);
 };
 $('#numberMode').onclick=()=>{state.mode='numbers';updateRoster()};$('#nameMode').onclick=()=>{state.mode='names';updateRoster()};
 $('#teamTotal').oninput=()=>{state.total=$('#teamTotal').value;updateRoster()};$('#teamExcluded').oninput=()=>{state.excluded=$('#teamExcluded').value;updateRoster()};$('#teamNames').oninput=()=>{state.namesText=$('#teamNames').value;updateRoster()};
 $('#teamMethod').onchange=()=>{state.method=$('#teamMethod').value;markChanged()};$('#teamAmount').oninput=()=>{state.amount=$('#teamAmount').value;markChanged()};
 $('#teamBalance').onchange=()=>{state.balance=$('#teamBalance').checked;$('#teamSkills').hidden=!state.balance;$('#skillInputs').querySelectorAll('input').forEach(input=>input.disabled=!state.balance);markChanged()};
 function stop(){worker?.terminate();worker=null;$('#teamSettings').disabled=false;$('#cancelTeamSearch').hidden=true;$('#makeTeams').textContent='✦ 팀 짜기'}
 $('#cancelTeamSearch').onclick=()=>{stop();toast('편성을 중지했어요.')};
 function generate(){
  $('#teamError').textContent='';let config;try{config=settings()}catch(e){$('#teamError').textContent=e.message;return}
  worker?.terminate();$('#teamSettings').disabled=true;$('#cancelTeamSearch').hidden=false;$('#makeTeams').textContent='팀을 나누고 있어요…';
  try{worker=new Worker('/team-worker.js',{type:'module'});
   const job=worker;worker.onmessage=event=>{
    if(!active||worker!==job)return;stop();
    if(event.data.error){$('#teamError').textContent=event.data.error;return}
    state.result=event.data.result;state.resultKey=JSON.stringify(config);save();renderResult();$('#teamResults').scrollIntoView({behavior:'smooth',block:'start'});toast('팀 편성이 완료됐어요.');
   };
   worker.onerror=()=>{if(active&&worker===job){stop();$('#teamError').textContent='팀을 나누지 못했어요. 새로고침 후 다시 시도해 주세요.'}};
   worker.postMessage(config);
  }catch{stop();$('#teamError').textContent='이 브라우저에서 팀 편성을 시작하지 못했어요. 최신 브라우저로 다시 시도해 주세요.'}
 }
 $('#teamForm').onsubmit=event=>{event.preventDefault();generate()};
 function renderResult(){
  const result=state.result,el=$('#teamResults');el.hidden=!result;if(!result)return;
  const stale=state.resultKey!==settingsKey();
  el.innerHTML=`<div class="team-result-title"><div><span class="eyebrow">READY, TEAM, GO!</span><h2>함께할 팀이 정해졌어요.</h2><p class="small">${result.count}명 · ${result.teams.length}팀 · ${result.balance?'능력치 균형':'무작위'} 배정 · 인원 차이 최대 1명</p></div><button type="button" class="secondary" id="reshuffleTeams">↻ 다시 섞기</button></div>${stale?'<p class="team-stale" role="status">설정이 바뀌었습니다. 아래는 이전 결과예요. ‘다시 섞기’를 누르면 새 설정으로 편성합니다.</p>':''}<div class="team-result-grid">${result.teams.map((team,i)=>`<article class="team-result-card" style="--team-color:${['#e9efd9','#e3edf3','#f5e8da','#eae4f3','#e2eee6','#f3e3e7'][i%6]}"><div class="team-result-header"><h3>${esc(team.name)}</h3><span>${team.members.length}명</span></div><ul>${team.members.map(p=>`<li>${esc(p.name)}</li>`).join('')}</ul>${result.balance?`<p class="small">팀 합계 ${team.skill}점 · 평균 ${(team.skill/team.members.length).toFixed(1)}점</p>`:''}</article>`).join('')}</div><div class="actions"><button type="button" class="primary" id="copyTeams">결과 복사</button><button type="button" class="secondary" id="saveTeams">결과 저장 (.html)</button><button type="button" class="secondary" id="printTeams">인쇄 / PDF로 저장</button><button type="button" class="secondary" id="fullTeams">전체 화면 ↗</button></div><p class="small">저장되는 결과에는 학생별 능력치가 포함되지 않습니다.</p>`;
  $('#reshuffleTeams').onclick=generate;
  $('#copyTeams').onclick=()=>navigator.clipboard.writeText(teamText(result)).then(()=>toast('팀 명단을 복사했어요.')).catch(()=>toast('복사 권한을 확인하거나 결과를 파일로 저장해 주세요.'));
  $('#saveTeams').onclick=()=>{const url=URL.createObjectURL(new Blob([teamReport(result)],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='우리반-팀편성.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  $('#printTeams').onclick=()=>{
   const frame=document.createElement('iframe');frame.title='팀 편성 인쇄';frame.style.display='none';frame.setAttribute('sandbox','allow-same-origin allow-modals');frame.srcdoc=teamReport(result);printFrames.add(frame);const remove=()=>{frame.remove();printFrames.delete(frame)};frame.onload=()=>{if(!active){remove();return}frame.contentWindow.addEventListener('afterprint',remove,{once:true});frame.contentWindow.focus();frame.contentWindow.print()};(document.fullscreenElement||document.body).append(frame);setTimeout(remove,120000);
  };
  $('#fullTeams').onclick=()=>document.fullscreenElement?document.exitFullscreen():el.requestFullscreen().catch(()=>toast('전체 화면을 사용할 수 없습니다.'));
 }
 updateRoster();renderResult();
 cleanup(()=>{active=false;worker?.terminate();printFrames.forEach(frame=>frame.remove());printFrames.clear()});
}
