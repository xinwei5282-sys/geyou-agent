import type {AgentProfile} from './agentTypes';
import {validateAgentDates} from './agentAge';
import {calculateAgentBazi} from './agentModel';
export function validateAuspiciousProfile(profile:AgentProfile){
 if(!profile.name.trim())throw Error('请填写或选择逝者姓名');
 const missing=[!profile.birthDate&&'出生日期',!profile.birthTime&&'出生时间',!profile.deathDate&&'逝世日期'].filter(Boolean);
 if(missing.length)throw Error(`请补充${missing.join('、')}。安葬择吉需要根据逝者的出生时间推算。`);
 validateAgentDates(profile);
 const chart=calculateAgentBazi({...profile,birthplace:'北京时间（UTC+8）'});
 if(!chart.ready)throw Error(chart.reason);
 if(profile.deathDate<chart.solarDate)throw Error('逝世日期不能早于出生日期');
}
