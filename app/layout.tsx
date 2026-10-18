import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Weekend, please. — Cebu Flight Finder',description:'Find a little more weekend. Compare verified round-trip fares for two from Cebu, Thursday or Friday to Monday.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
