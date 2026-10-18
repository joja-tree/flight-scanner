'use client';
import * as D from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import type {ReactNode} from 'react';
export function Dialog({open,onOpenChange,title,description,children}:{open:boolean;onOpenChange:(v:boolean)=>void;title:string;description:string;children:ReactNode}){return <D.Root open={open} onOpenChange={onOpenChange}><D.Portal><D.Overlay className="dialog-overlay"/><D.Content className="dialog-content"><D.Title className="dialog-title">{title}</D.Title><D.Description className="muted">{description}</D.Description><D.Close className="dialog-close" aria-label="Close dialog"><X size={20}/></D.Close>{children}</D.Content></D.Portal></D.Root>;}
