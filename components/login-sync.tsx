"use client";
import { useEffect,useRef } from 'react';import { syncLoginStreak } from '@/app/actions';
export function LoginSync(){const called=useRef(false);useEffect(()=>{if(called.current)return;called.current=true;syncLoginStreak().catch(()=>{});},[]);return null;}
