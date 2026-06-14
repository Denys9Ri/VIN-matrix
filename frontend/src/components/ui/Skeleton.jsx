import React from 'react';import{cn}from'./utils';
export default function Skeleton({className='',rows=1}){if(rows>1)return <div className="space-y-3">{Array.from({length:rows}).map((_,i)=><div key={i} className={cn('h-12 animate-pulse rounded-2xl bg-slate-200',className)}/>)}</div>;return <div className={cn('animate-pulse rounded-2xl bg-slate-200',className||'h-4 w-full')}/>}
