export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export type Limits={publicRefresh:boolean;daily:number;cooldownMs:number;pending:number};
export function limits():Limits{
 const read=(key:string,fallback:number,max:number)=>{const v=Number(process.env[key]??fallback);if(!Number.isInteger(v)||v<1||v>max)throw new Error(`Invalid ${key}`);return v;};
 return {publicRefresh:process.env.PUBLIC_REFRESH_ENABLED==='true',daily:read('DAILY_SEARCH_LIMIT',30,500),cooldownMs:read('USER_COOLDOWN_MINUTES',60,1440)*60000,pending:read('MAX_PENDING_JOBS',200,200)};
}
export function authorizeRefresh(owner:boolean,scope:string,enabled:boolean){if(!owner&&scope==='year')throw new HttpError(403,'Only the owner can start a full-year scan');if(!owner&&!enabled)throw new HttpError(403,'Public refresh is disabled until the server pilot passes');}
export function canClaim(j:{status:string;leaseUntil:number},now:number){return j.status==='queued'||j.status==='running'&&j.leaseUntil<=now;}
export function dailyKey(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,10);}
