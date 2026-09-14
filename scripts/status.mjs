const DAY = 86400000;
export function campaignStatus(c, now = new Date(), newDays = 7, endingSoonDays = 7) {
  const today = new Date(now.toLocaleString('en-US',{timeZone:'Asia/Tokyo'}));
  today.setHours(0,0,0,0);
  const start = c.startDate ? new Date(`${c.startDate}T00:00:00+09:00`) : null;
  const end = c.endDate ? new Date(`${c.endDate}T23:59:59+09:00`) : null;
  const first = c.firstSeenAt ? new Date(c.firstSeenAt) : null;
  const isNew = first ? ((now-first)/DAY <= newDays) : false;
  if (start && start > today) return {state:'upcoming', isNew, endingSoon:false};
  if (end && end < today) return {state:'ended', isNew, endingSoon:false};
  const endingSoon = end ? ((end-today)/DAY <= endingSoonDays) : false;
  return {state:'active', isNew, endingSoon};
}
