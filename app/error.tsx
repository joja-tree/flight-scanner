'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="container"><h1>Something didn’t load.</h1><p>Your saved fares are unchanged.</p><button className="button button-primary" onClick={reset}>Try again</button></main>;}
