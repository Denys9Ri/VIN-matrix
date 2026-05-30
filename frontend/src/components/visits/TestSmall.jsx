import { useEffect } from 'react';

export default function TestSmall(){
  useEffect(()=>{
    const observer = new MutationObserver(()=>{});
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  },[]);
  return null;
}
