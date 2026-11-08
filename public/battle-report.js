const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function battleResultText(room){
 const g=room.game;
 if(!room.closed)return '진행 중인 토론 · 중간 결과';
 if(g.phase!=='finished')return '중단된 토론 · 최종 집계 전';
 return g.scores[0]===g.scores[1]?'무승부':room.options[g.scores[0]>g.scores[1]?0:1].text+' 팀 승리';
}
export function buildBattleReport(room,code,{printButton=true,now=new Date()}={}){
 const g=room.game,e=escapeHTML,total=room.count;
 const date=now.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
 const columns=room.options.slice(0,2).map((o,side)=>{
  const comments=g.ideas.filter(a=>a.side===side);
  return `<section class="team team-${side}"><h2>${e(o.text)}</h2><div class="metrics"><strong>${g.scores[side]}<small> 점</small></strong><span>시작 ${g.totals[side]}명<br>최종 선택 ${g.finalTotals[side]}명</span></div><h3>팀 댓글 · ${comments.length}개</h3>${comments.map(a=>`<article><div class="comment-head"><b>${e(a.authorLabel||'참가자')}</b><span>공감 ${a.likes}</span></div><p>${e(a.text)}</p></article>`).join('')||'<p class="empty">작성된 댓글이 없습니다.</p>'}</section>`;
 }).join('');
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>논쟁 배틀 결과 · ${e(code)}</title><style>
 *{box-sizing:border-box}body{margin:0;background:#eef2ed;color:#253c32;font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif;line-height:1.7}main{max-width:1000px;margin:30px auto;padding:36px;background:white;border-radius:20px}.brand{font-size:13px;font-weight:700;letter-spacing:2px;color:#54745e}h1{font-size:30px;line-height:1.5;margin:12px 0}header p{color:#718275;font-size:12px}.result{background:#243f36;color:#fff2be;padding:20px;border-radius:13px;font-size:24px;font-weight:800;text-align:center}.overview{display:flex;flex-wrap:wrap;gap:20px;background:#f2f5ed;border-radius:12px;padding:18px;margin:20px 0;font-size:13px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:22px}.team{border:1px solid #dce4d8;border-radius:13px;padding:22px;min-width:0}.team h2{font-size:20px;margin:0}.team-0{border-top:5px solid #b4a0dd}.team-1{border-top:5px solid #7fb8a5}.metrics{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:20px 0;border-bottom:1px solid #e5ebdf}.metrics strong{font-size:42px;line-height:1.2}.metrics small{font-size:15px}.metrics span{font-size:12px}.team h3{font-size:14px;margin:22px 0}article{background:#f4f6f0;border-radius:10px;padding:15px;margin:12px 0;break-inside:avoid}.comment-head{display:flex;justify-content:space-between;font-size:11px;color:#74806d}article p{font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0 0}.empty{color:#899281;font-size:13px}footer{margin-top:25px;font-size:11px;color:#798474}.print{border:0;border-radius:9px;padding:12px 20px;background:#315b47;color:white;cursor:pointer;font:inherit;font-size:13px;margin:0 0 20px}@media(max-width:600px){main{margin:0;padding:20px;border-radius:0}.columns{grid-template-columns:1fr}h1{font-size:24px}}@media print{@page{size:A4;margin:14mm}body{background:white}main{max-width:none;padding:0;margin:0;border-radius:0}.print{display:none}.columns{display:block}.team{margin-bottom:20px}.result,.overview,article{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 </style></head><body><main>${printButton?'<button class="print" onclick="window.print()">인쇄 / PDF로 저장</button>':''}<header><div class="brand">g·class · 토론 기록</div><h1>${e(room.question)}</h1><p>참여 코드 ${e(code)} · 저장 시각 ${e(date)} (한국 시간)</p></header><div class="result">${e(battleResultText(room))}</div><div class="overview"><span>참가자 <b>${total}명</b></span><span>댓글 <b>${g.ideas.length}개</b></span><span>토론 투표 <b>${g.voteCount} / ${total}명</b></span><span>최종 선택 <b>${g.finalCount} / ${total}명</b></span><span>미선택 <b>${total-g.finalCount}명</b></span></div><div class="columns">${columns}</div><footer>점수: 첫 댓글 10P · 받은 공감 5P · 토론 투표 20P · 최종 선택 10P · 상대 팀 설득 추가 30P<br>점수는 수업 활동용이며 성적이 아닙니다. 같은 학생의 댓글은 참가자 번호로 확인할 수 있습니다.</footer></main></body></html>`;
}
export function openBattleReport(room,code){
 const dialog=document.createElement('dialog');dialog.className='battle-report-dialog';
 dialog.innerHTML='<div class="report-toolbar"><strong>토론 결과 보고서</strong><div class="actions"><button class="primary" data-report="download">보고서 내려받기 (.html)</button><button class="secondary" data-report="print">인쇄 / PDF로 저장</button><button class="secondary" data-report="close">닫기</button></div></div><p class="small">내려받은 파일은 인터넷 없이 브라우저에서 열 수 있어요. PDF는 인쇄 창의 ‘대상’ 또는 ‘프린터’에서 ‘PDF로 저장’을 선택하세요.</p><iframe title="토론 결과 보고서 미리보기" sandbox="allow-same-origin allow-modals"></iframe><p class="error" role="alert"></p>';
 const iframe=dialog.querySelector('iframe');iframe.srcdoc=buildBattleReport(room,code,{printButton:false});
 const close=()=>{dialog.close();dialog.remove()};
 dialog.querySelector('[data-report="close"]').onclick=close;
 dialog.addEventListener('cancel',()=>dialog.remove());
 dialog.querySelector('[data-report="download"]').onclick=()=>{
  const url=URL.createObjectURL(new Blob([buildBattleReport(room,code)],{type:'text/html;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='논쟁배틀-결과-'+code+'.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 dialog.querySelector('[data-report="print"]').onclick=()=>{try{iframe.contentWindow.focus();iframe.contentWindow.print()}catch{dialog.querySelector('.error').textContent='보고서를 내려받아 브라우저에서 연 뒤 인쇄해 주세요.'}};
 (document.fullscreenElement||document.body).append(dialog);dialog.showModal();return close;
}
