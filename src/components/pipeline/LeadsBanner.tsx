export function LeadsBanner({status=false}:{status?:boolean}) {
  return <section className="leads-banner mb-6 border"><h1 className="text-2xl font-bold">{status?'Lead Status':'Leads'}</h1><p className="mt-1 text-sm text-muted-foreground">{status?'Configure pipeline columns for the Leads board.':'Customer enquiries and assigned prospects'}</p></section>;
}