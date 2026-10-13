import {detectAddress} from './address.js';
import {finite,chainName} from './analytics.js';
const same=(a,b)=>{const x=detectAddress(a),y=detectAddress(b);return !!x&&!!y&&x.family===y.family&&(x.family==='evm'?x.address.toLowerCase()===y.address.toLowerCase():x.address===y.address);};
const quantity=r=>{const n=finite(r.amount);if(n==null||n<0)return null;const exact=typeof r.amountText==='string'&&/^\d+(?:\.\d+)?$/.test(r.amountText)&&r.amountText.length<=100?r.amountText:Number(n).toLocaleString('en-US',{maximumSignificantDigits:12});return exact+(r.asset?' '+r.asset:'');};
export function explainTransaction(r,{wallets=[],privateMode=false}={}){
 const details=[],q=quantity(r),what=q??'an amount not provided by the source',kind=r.kind??r.type;
 if(privateMode)return{summary:(r.status==='success'?'Completed':r.status==='error'?'Failed':r.status==='denied'?'Denied':'Pending')+' '+(r.type==='deposit'?'incoming transfer':r.type==='swap'?'asset exchange':'activity')+'. Amount and identity are hidden.',details:['Private mode hides amounts, identifiers, saved names and personal notes.']};
 let summary;
 if(r.status==='error'){summary='This '+(r.type==='swap'?'swap':'request')+' was reported as failed.';details.push('This record does not confirm a completed payment.');if(r.errorReason)details.push('Reported reason: '+r.errorReason);}
 else if(r.status==='denied'){summary='This request was denied.';details.push('A denied request does not confirm that funds moved.');}
 else if(r.status!=='success'){summary='This request is still pending'+(r.status==='pending_approval'?' your approval':'')+'.';details.push('Do not treat it as a completed payment.');}
 else if(kind==='wallet_sign'){summary='PayBox reports a completed wallet-signing request.';details.push('A signature alone does not prove a transfer.');}
 else if(r.type==='swap'){summary=r.source==='On-chain'?'Your wallet recorded an exchange or multi-asset movement'+(q?' involving '+q:'')+'.':'PayBox reports this swap as successful.';if(r.source==='On-chain')details.push('Balance changes are not proof of a specific trade; this classification is a heuristic.');if(r.direction)details.push('This row represents the '+(r.direction==='out'?'outgoing':'incoming')+' asset leg, not a separate purchase.');}
 else if(wallets.some(w=>same(w.address,r.wallet))&&wallets.some(w=>same(w.address,r.counterparty))){summary='You moved '+what+' between your connected wallets.';details.push('Moving funds between your own wallets is not a purchase.');}
 else if(r.type==='deposit'){summary='You received '+what+'.';}
 else if(r.type==='payment'||r.type==='transfer'){summary=r.source==='On-chain'?'Your wallet sent '+what+'.':'The source reports a completed payment of '+what+'.';if(r.source==='On-chain')details.push('An outgoing transfer is not automatically a purchase.');}
 else {summary='The source reports a completed '+(kind==='request'?'wallet interaction':String(kind).replaceAll('_',' '))+'.';}
 if(r.contactName)details.push('Your saved name for the counterparty is '+r.contactName+(r.contactHandle?' (@'+r.contactHandle+')':'')+'. This is a manual label, not verified identity.');else if(r.type==='deposit')details.push('No verified sender X identity is available in this record.');
 if(r.network)details.push('Network: '+chainName(r.network)+'.');
 if(finite(r.amountUsd)==null)details.push('The historical USD value was not provided.');else details.push('Reported historical value: $'+Number(r.amountUsd).toFixed(2)+'.');
 if(finite(r.feeAmount)!=null&&r.feeAsset)details.push('Reported network fee: '+Number(r.feeAmount).toLocaleString('en-US',{maximumSignificantDigits:12})+' '+r.feeAsset+'.'+(r.status==='error'?' A failed transaction can still incur a fee.':''));
 else if(finite(r.feeUsd)!=null)details.push('Reported fee value: $'+Number(r.feeUsd).toFixed(2)+'.');else details.push('The network fee was not provided; this record does not identify the fee payer.');
 if(r.source==='On-chain')details.push('On-chain data does not identify the originating AI tool or plugin.');else if(r.source==='This connection')details.push('This request belongs to this dashboard’s PayBox connection.');else if(r.identityEvidence||r.source==='X handle')details.push('Sender and app labels in demo or imported data are supplied claims, not independently verified.');
 return{summary,details};
}
