import { mergeObservation, type Destination, type Observation } from './domain';
export const referenceDestinations: Destination[] = [
  {code:'BCD',name:'Bacolod',country:'Philippines',kind:'domestic',directStatus:'verified',verifiedAt:'2026-10-17T15:20:00Z',source:'https://www.cebupacificair.com/en-PH/'},
  ...[{code:'MPH',name:'Boracay (Caticlan)'},{code:'ILO',name:'Iloilo'},{code:'MNL',name:'Manila'}].map(d=>({...d,country:'Philippines',kind:'domestic' as const,directStatus:'verified' as const,verifiedAt:'2026-10-17T15:20:00Z',source:'https://www.cebupacificair.com/en-PH/'})),
];
// Historical observation from the visible booking summary in this chat. Never a live quote.
export const referenceObservation: Observation = {
 destination:'BCD',departure:'2027-03-05',returnDate:'2027-03-08',status:'verified',checkedAt:'2026-10-17T15:20:00Z',indicativeBaseFare:null,
 note:'Historical reference checked on 17 October 2026. Time rounded to the collection session; not refreshed. GO Basic, no paid extras.', evidence:'Manual visible booking-summary verification; original screenshot retained with project deliverables.',
 quote:{total:799352,currency:'PHP',adults:2,verifiedInSummary:true,travelTax:'not-applicable',
 outbound:{flight:'DG 6460',from:'CEB',to:'BCD',date:'2027-03-05',departure:'17:20',arrival:'18:20',arrivalDate:'2027-03-05',amountPerAdult:203088,baggage:'1 hand-carry item, max 7 kg'},
 inbound:{flight:'DG 6461',from:'BCD',to:'CEB',date:'2027-03-08',departure:'18:40',arrival:'19:30',arrivalDate:'2027-03-08',amountPerAdult:196588,baggage:'1 hand-carry item, max 7 kg'}}
};
export const referenceFares=[mergeObservation(undefined,referenceObservation)];
