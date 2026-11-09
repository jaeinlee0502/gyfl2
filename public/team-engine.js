const MAX_PEOPLE=200;
const fail=message=>{throw Error(message)};
const random=()=>{const word=new Uint32Array(1);globalThis.crypto.getRandomValues(word);return word[0]/4294967296};
function shuffle(list,rng){const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
export function parseTeamNames(text){
 const names=String(text).split(/[\n,]+/).map(n=>n.trim().normalize('NFC')).filter(Boolean);
 if(names.length<2)fail('학생을 두 명 이상 입력해 주세요.');if(names.length>MAX_PEOPLE)fail('학생은 200명까지 입력할 수 있어요.');
 if(names.some(n=>n.length>40))fail('이름은 40자 이내로 입력해 주세요.');
 if(new Set(names).size!==names.length)fail('같은 이름이 있어요. 번호를 붙여 서로 구분해 주세요. 예: 1번 김민지, 12번 김민지');
 return names;
}
function excludeTeamNumbers(numbers,excluded){
 const available=new Set(numbers),omitted=new Set();
 for(const token of String(excluded).split(/[\s,]+/).filter(Boolean)){
  const match=token.match(/^(\d+)(?:-(\d+))?$/);if(!match)fail('제외 번호는 3, 7-9처럼 입력해 주세요.');
  const start=Number(match[1]),end=Number(match[2]||match[1]);
  if(start<1||end>Math.max(...numbers)||end<start)fail('제외 번호가 학생 수 범위를 벗어나거나 순서가 잘못됐어요.');
  for(let n=start;n<=end;n++){if(!available.has(n))fail(n+'번은 실제 명단에 없는 번호예요. 제외 번호를 확인해 주세요.');omitted.add(n)}
 }
 const selected=numbers.filter(n=>!omitted.has(n));if(selected.length<2)fail('제외 번호를 빼고 두 명 이상이 남아야 해요.');return selected;
}
export function numberedTeamNames(total,excluded=''){
 total=Number(total);if(!Number.isInteger(total)||total<2||total>MAX_PEOPLE)fail('총 학생 수를 2~200명으로 입력해 주세요.');
 return excludeTeamNumbers(Array.from({length:total},(_,i)=>i+1),excluded).map(n=>n+'번');
}
export function schoolTeamRoster(femaleCount,maleCount,excluded=''){
 if(String(femaleCount).trim()===''||String(maleCount).trim()==='')fail('여학생 수와 남학생 수를 각각 입력해 주세요. 없는 경우 0을 입력하세요.');
 femaleCount=Number(femaleCount);maleCount=Number(maleCount);
 if(!Number.isInteger(femaleCount)||femaleCount<0||femaleCount>30)fail('여학생 수는 0~30명으로 입력해 주세요. 번호는 1번부터 시작합니다.');
 if(!Number.isInteger(maleCount)||maleCount<0||maleCount>20)fail('남학생 수는 0~20명으로 입력해 주세요. 번호는 31번부터 시작합니다.');
 if(femaleCount+maleCount<2)fail('여학생과 남학생을 합쳐 두 명 이상이어야 해요.');
 const numbers=[...Array.from({length:femaleCount},(_,i)=>i+1),...Array.from({length:maleCount},(_,i)=>i+31)];
 const selected=excludeTeamNumbers(numbers,excluded),names=selected.map(n=>n+'번');
 return {names,genders:Object.fromEntries(selected.map(n=>[n+'번',n<=30?'female':'male']))};
}

export function makeTeams({names,method='count',amount=6,balance=false,skills={},rules=[],genderBalance=false,genders={}},rng=random){
 if(!Array.isArray(names))fail('명단을 먼저 입력해 주세요.');
 names=parseTeamNames(names.join('\n'));
 if(!['count','size'].includes(method))fail('팀 수 또는 팀당 인원 기준을 선택해 주세요.');
 amount=Number(amount);if(!Number.isInteger(amount)||amount<1||amount>names.length)fail('팀 수 또는 팀당 인원을 참여 학생 수 안에서 정해 주세요.');
 const teamCount=method==='count'?amount:Math.ceil(names.length/amount);
 const capacities=Array.from({length:teamCount},(_,i)=>Math.floor(names.length/teamCount)+(i<names.length%teamCount?1:0));
 const people=names.map(name=>{
  const skill=balance?Number(Object.hasOwn(skills,name)?skills[name]:5):5;
  if(!Number.isInteger(skill)||skill<1||skill>10)fail('능력치는 1~10 사이의 정수로 입력해 주세요.');
  const gender=Object.hasOwn(genders,name)?genders[name]:null;
  if(genderBalance&&!['female','male'].includes(gender))fail('성별 균형을 사용하려면 학교 번호 방식으로 명단을 입력해 주세요.');
  return {name,skill,gender};
 });
 const femaleTotal=people.filter(p=>p.gender==='female').length,maleTotal=people.filter(p=>p.gender==='male').length;
 const femaleMin=Math.floor(femaleTotal/teamCount),femaleMax=Math.ceil(femaleTotal/teamCount),maleMin=Math.floor(maleTotal/teamCount),maleMax=Math.ceil(maleTotal/teamCount);
 const byName=new Map(people.map((p,i)=>[p.name,i]));
 if(!Array.isArray(rules)||rules.length>50)fail('묶음·분리 조건은 50개까지 설정할 수 있어요.');
 for(const rule of rules){
  if(!['together','apart'].includes(rule.type)||!Array.isArray(rule.members)||new Set(rule.members).size<2||new Set(rule.members).size!==rule.members.length)fail('각 묶음·분리 조건에는 서로 다른 학생을 두 명 이상 골라 주세요.');
  for(const member of rule.members)if(!byName.has(member))fail('조건에 있는 '+member+' 학생이 명단에 없어요. 해당 조건을 지우거나 명단을 수정해 주세요.');
  if(rule.type==='apart'&&rule.members.length>teamCount)fail('분리할 학생 '+rule.members.length+'명을 나누려면 팀이 '+rule.members.length+'개 이상 필요해요.');
 }
 const parent=people.map((_,i)=>i);
 const root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
 for(const rule of rules.filter(r=>r.type==='together')){
  const first=byName.get(rule.members[0]);for(const member of rule.members)parent[root(byName.get(member))]=root(first);
 }
 const components=new Map();people.forEach((p,i)=>{const key=root(i);if(!components.has(key))components.set(key,[]);components.get(key).push(p)});
 const units=Array.from(components.values(),(members,id)=>({id,members,skill:members.reduce((n,p)=>n+p.skill,0),female:members.filter(p=>p.gender==='female').length,male:members.filter(p=>p.gender==='male').length,neighbors:new Set()}));
 const unitOf=new Map();for(const unit of units)for(const p of unit.members)unitOf.set(p.name,unit.id);
 for(const rule of rules.filter(r=>r.type==='apart'))for(const a of rule.members)for(const b of rule.members){
  if(a===b)continue;const i=unitOf.get(a),j=unitOf.get(b);
  if(i===j)fail(a+' 학생과 '+b+' 학생이 묶음·분리 조건에 동시에 들어 있어요. 조건을 조정해 주세요.');
  units[i].neighbors.add(j);
 }
 if(units.some(u=>u.members.length>Math.max(...capacities)))fail('함께 묶은 학생 수가 한 팀 인원보다 많아요. 팀 수를 줄이거나 묶음 조건을 조정해 주세요.');
 if(genderBalance&&units.some(u=>u.female>femaleMax||u.male>maleMax))fail('묶음 조건의 여학생 또는 남학생 수가 성별 균형 인원을 넘어요. 묶음을 줄이거나 성별 균형을 꺼 주세요.');
 const totalSkill=people.reduce((n,p)=>n+p.skill,0),target=totalSkill/names.length;
 let best=null,bestCost=Infinity,hitLimit=false;
 const maxNodes=12000,attempts=balance?(names.length>80?5:10):1;
 for(let attempt=0;attempt<attempts;attempt++){
  const caps=shuffle(capacities,rng),teams=caps.map(()=>[]),counts=caps.map(()=>0),sums=caps.map(()=>0),females=caps.map(()=>0),males=caps.map(()=>0),assignment=Array(units.length).fill(-1);
  let nodes=0,limited=false;
  const genderAllowed=(t,f,m,count)=>!genderBalance||(f>=0&&m>=0&&f<=femaleMax&&m<=maleMax&&Math.max(0,femaleMin-f)+Math.max(0,maleMin-m)<=caps[t]-count);
  const allowed=(unit,t)=>counts[t]+unit.members.length<=caps[t]&&genderAllowed(t,females[t]+unit.female,males[t]+unit.male,counts[t]+unit.members.length)&&![...unit.neighbors].some(n=>assignment[n]===t);
  function search(remaining){
   if(!remaining.length)return true;if(++nodes>maxNodes){limited=true;return false}
   if(genderBalance){
    const femaleLeft=remaining.reduce((n,u)=>n+u.female,0),maleLeft=remaining.reduce((n,u)=>n+u.male,0);
    let needFemale=0,needMale=0,roomFemale=0,roomMale=0;
    for(let t=0;t<caps.length;t++){
     const slots=caps[t]-counts[t],fNeed=Math.max(0,femaleMin-females[t]),mNeed=Math.max(0,maleMin-males[t]);
     needFemale+=fNeed;needMale+=mNeed;
     roomFemale+=Math.min(femaleMax-females[t],slots-mNeed);roomMale+=Math.min(maleMax-males[t],slots-fNeed);
    }
    if(femaleLeft<needFemale||maleLeft<needMale||femaleLeft>roomFemale||maleLeft>roomMale)return false;
   }
   let pick,choices;
   for(const unit of remaining){
    const opts=caps.map((_,i)=>i).filter(t=>allowed(unit,t));if(!opts.length)return false;
    if(!pick||opts.length<choices.length||opts.length===choices.length&&(unit.members.length>pick.members.length||unit.members.length===pick.members.length&&unit.neighbors.size>pick.neighbors.size)){pick=unit;choices=opts}
   }
   choices=shuffle(choices,rng);
   if(balance)choices.sort((a,b)=>(sums[a]+pick.skill)/caps[a]-(sums[b]+pick.skill)/caps[b]);
   const rest=remaining.filter(u=>u!==pick),emptySizes=new Set();
   for(const t of choices){
    if(!counts[t]){if(emptySizes.has(caps[t]))continue;emptySizes.add(caps[t])}
    assignment[pick.id]=t;counts[t]+=pick.members.length;sums[t]+=pick.skill;females[t]+=pick.female;males[t]+=pick.male;teams[t].push(pick);
    if(search(rest))return true;
    teams[t].pop();counts[t]-=pick.members.length;sums[t]-=pick.skill;females[t]-=pick.female;males[t]-=pick.male;assignment[pick.id]=-1;
    if(limited)return false;
   }
   return false;
  }
  // Order affects unconstrained ties; keep every run random while respecting constraints.
  const order=shuffle(units,rng);if(balance)order.sort((a,b)=>b.skill/b.members.length-a.skill/a.members.length);
  if(!search(order)){hitLimit ||= limited;if(!limited&&!best)break;continue}
  if(balance){
   for(let pass=0;pass<6;pass++){
    let improved=false;
    for(let a=0;a<teams.length;a++)for(let b=a+1;b<teams.length;b++)for(let i=0;i<teams[a].length;i++)for(let j=0;j<teams[b].length;j++){
     const x=teams[a][i],y=teams[b][j];if(x.members.length!==y.members.length)continue;
     if(teams[b].some(u=>u!==y&&x.neighbors.has(u.id))||teams[a].some(u=>u!==x&&y.neighbors.has(u.id)))continue;
     const femaleDelta=y.female-x.female,maleDelta=y.male-x.male;
     if(!genderAllowed(a,females[a]+femaleDelta,males[a]+maleDelta,counts[a])||!genderAllowed(b,females[b]-femaleDelta,males[b]-maleDelta,counts[b]))continue;
     const delta=y.skill-x.skill;
     const before=(sums[a]-target*caps[a])**2+(sums[b]-target*caps[b])**2;
     const after=(sums[a]+delta-target*caps[a])**2+(sums[b]-delta-target*caps[b])**2;
     if(after+1e-9<before){teams[a][i]=y;teams[b][j]=x;sums[a]+=delta;sums[b]-=delta;females[a]+=femaleDelta;females[b]-=femaleDelta;males[a]+=maleDelta;males[b]-=maleDelta;improved=true}
    }
    if(!improved)break;
   }
  }
  const cost=sums.reduce((n,sum,t)=>n+(sum-target*caps[t])**2,0);
  if(!best||cost<bestCost){bestCost=cost;best=teams.map((team,i)=>({name:(i+1)+'팀',members:shuffle(team.flatMap(u=>u.members),rng),skill:sums[i],female:females[i],male:males[i]}))}
  if(!balance||cost<1e-9)break;
 }
 if(!best&&genderBalance)fail(hitLimit?'조건이 복잡해 성별 균형 배정을 찾지 못했어요. 조건이나 팀 수를 조정해 다시 시도해 주세요.':'성별 균형과 묶음·분리 조건을 동시에 만족할 수 없어요. 조건이나 팀 수를 조정하거나 성별 균형을 꺼 주세요.');
 if(!best)fail(hitLimit?'조건이 복잡해 배정을 찾지 못했어요. 묶음·분리 조건을 줄이거나 팀 수를 바꿔 다시 시도해 주세요.':'현재 팀 수와 인원으로 묶음·분리 조건을 모두 만족할 수 없어요. 조건이나 팀 수를 조정해 주세요.');
 return {teams:best,count:names.length,balance,genderBalance,hasGenders:femaleTotal+maleTotal===names.length,method,amount,ruleCount:rules.length};
}
