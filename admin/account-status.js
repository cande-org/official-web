export const isRetained = item => item?.account_status === 'deleted';
export const ownerKey = item => item.archive_id ?? item.user_id ?? item.id;
export const ownerLabel = item => isRetained(item) ? '보관용 키' : '회원 UID';
export function accountBadge(item) {
 const span=document.createElement('span');span.className=isRetained(item)?'content-state retained-state':'helper';
 span.textContent=isRetained(item)?'탈퇴 회원':item.is_guest?'게스트':'회원';return span;
}
