import { useContext } from 'react';import { ToastContext } from './ToastProvider';
export default function useToast(){return useContext(ToastContext)||{success:console.log,error:console.error,warning:console.warn,info:console.log,toast:console.log}}
