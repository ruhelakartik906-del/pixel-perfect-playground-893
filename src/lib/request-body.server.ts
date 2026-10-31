export async function boundedBody(request:Request,maxBytes:number):Promise<string>{
 if(Number(request.headers.get('content-length'))>maxBytes)throw new Error('Body too large');
 const reader=request.body?.getReader();if(!reader)return '';let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Body too large');}chunks.push(item.value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(all);
}