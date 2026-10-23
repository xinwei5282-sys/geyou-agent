declare module 'lunar-javascript' {
 interface EightChar{setSect(value:number):void;getYear():string;getMonth():string;getDay():string;getTime():string;getYearWuXing():string;getMonthWuXing():string;getDayWuXing():string;getTimeWuXing():string;}
 interface LunarDate{getDayYi():string[];getDayJi():string[];getTimeYi():string[];getTimeJi():string[];getDayZhi():string;getTimeZhi():string;getDayInGanZhi():string;getTimeInGanZhi():string;getEightChar():EightChar;getSolar():SolarDate;}
 interface SolarDate{getLunar():LunarDate;toYmd():string;}
 export const Solar:{fromYmdHms(y:number,m:number,d:number,h:number,minute:number,s:number):SolarDate};
 export const Lunar:{fromYmdHms(y:number,m:number,d:number,h:number,minute:number,s:number):LunarDate};
}
