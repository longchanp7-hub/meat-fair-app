const DAY=86400000;
export function jstDate(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function campaignStatus(c,now=new Date(),newDays=7,endingSoonDays=7){
  const today=jstDate(now), first=Date.parse(c.firstSeenAt||'');
  const age=(now.getTime()-first)/DAY;
  const isNew=Number.isFinite(age)&&age>=0&&age<=newDays;
  if(['ended_official','ended_by_date','stale_unverified'].includes(c.lifecycleStatus))return{state:'ended',isNew:false,endingSoon:false};
  if(c.endDate&&c.endDate<today)return{state:'ended',isNew:false,endingSoon:false};
  if(c.startDate&&c.startDate>today)return{state:'upcoming',isNew,endingSoon:false};
  const left=c.endDate?(Date.parse(c.endDate+'T23:59:59+09:00')-now.getTime())/DAY:Infinity;
  return{state:'active',isNew,endingSoon:left>=0&&left<=endingSoonDays};
}
