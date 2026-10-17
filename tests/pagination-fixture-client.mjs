// Browser-only fake API adapter: paginated notice responses from each suite's synthetic records.
export function pagedFixtureClient(client){
 if(client.__pagedFixture)return client;client.__pagedFixture=true;const invoke=client.functions.invoke;
 client.functions.invoke=async(name,options)=>{
  const b=options?.body;
  if(name==='admin-access'&&b?.action==='history'){const result=await invoke(name,{method:'GET'});if(result.error)return result;const items=result.data.history??[];return{data:{items:items.slice((b.page-1)*20,b.page*20),total:items.length,page:b.page}};}
  if(name==='admin-announcements'&&b?.action==='list'){
   const result=await invoke(name,{method:'GET'});if(result.error)return result;
   let items=(b.kind==='push'?result.data.campaigns:result.data.announcements)??[];
   items=items.filter(x=>(!b.query||(x.title+' '+x.body).toLowerCase().includes(b.query.toLowerCase()))&&(b.kind==='push'||b.filter==='all'||!!x.published_at===(b.filter==='published')));
   const total=items.length,page=Math.max(1,Math.min(b.page,Math.max(1,Math.ceil(total/b.size))));return{data:{items:items.slice((page-1)*b.size,page*b.size),total,page,pages:Math.max(1,Math.ceil(total/b.size))}};
  }
  return invoke(name,options);
 };return client;
}
