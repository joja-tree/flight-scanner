import {configured,db} from '@/lib/server/admin';
import {referenceDestinations} from '@/lib/reference';
import {failure} from '@/lib/server/http';
export async function GET(){try{if(!configured())return Response.json({destinations:referenceDestinations,reference:true,registryComplete:false});const [routes,registry]=await Promise.all([db().collection('destinations').orderBy('name').limit(100).get(),db().doc('system/registry').get()]);return Response.json({destinations:routes.docs.map(d=>d.data()),reference:false,registryComplete:registry.data()?.complete===true},{headers:{'Cache-Control':'public, s-maxage=60'}});}catch(e){return failure(e);}}
