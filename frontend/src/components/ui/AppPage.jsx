import React from 'react';import{cn}from'./utils';
export default function AppPage({children,className=''}){return <main className={cn('mx-auto w-full max-w-[1600px] p-3 md:p-8',className)}>{children}</main>}
