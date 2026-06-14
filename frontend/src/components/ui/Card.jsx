import React from 'react';import{cn}from'./utils';
const variants={default:'bg-white border-slate-200',interactive:'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md cursor-pointer',metric:'bg-white border-slate-200',warning:'bg-amber-50 border-amber-200',danger:'bg-rose-50 border-rose-200',success:'bg-emerald-50 border-emerald-200'};
const pads={none:'p-0',sm:'p-4',md:'p-5',lg:'p-6'};
export default function Card({variant='default',padding='md',className='',children,...props}){return <div className={cn('rounded-3xl border shadow-sm transition',variants[variant],pads[padding],className)} {...props}>{children}</div>}
