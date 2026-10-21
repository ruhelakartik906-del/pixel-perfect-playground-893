export function LeadsBanner({status=false}:{status?:boolean}) {
  return <section className="leads-banner mb-6 rounded-lg border px-5 py-4"><h1 className="text-2xl font-bold">{status?'Lead Status':'Leads'}</h1><p className="mt-1 text-sm text-muted-foreground">{status?'Lead pipeline stages':'Customer enquiries and assigned prospects'}</p></section>;
}