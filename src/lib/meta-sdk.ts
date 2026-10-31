export function loadMetaSdk(appId:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(window.FB){window.FB.init({appId,autoLogAppEvents:false,xfbml:false,version:'v21.0'});resolve();return;}
  window.fbAsyncInit=()=>{window.FB.init({appId,autoLogAppEvents:false,xfbml:false,version:'v21.0'});resolve();};
  const script=document.createElement('script');script.src='https://connect.facebook.net/en_US/sdk.js';script.async=true;script.onerror=()=>reject(new Error('Meta sign-in could not load'));document.body.appendChild(script);
 });
}