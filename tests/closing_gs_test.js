const fs=require('fs'),a=require('assert');
// --- fake Slides table
function cellObj(txt){let t=txt+'\n';let style={font:'Lato',size:20,bold:true,color:'#1F2A44'},align='CENTER';
 const tr={asString:()=>t,setText(x){t=x+'\n';style={font:'Arial',size:14,bold:false,color:'#000000'};align='START';return tr;},
  getTextStyle:()=>({getFontFamily:()=>style.font,getFontSize:()=>style.size,isBold:()=>style.bold,
   getForegroundColor:()=>({asRgbColor:()=>({asHexString:()=>style.color})}),
   setFontFamily:v=>style.font=v,setFontSize:v=>style.size=v,setBold:v=>style.bold=v,setForegroundColor:v=>style.color=v}),
  getParagraphStyle:()=>({getParagraphAlignment:()=>align,setParagraphAlignment:v=>align=v}),_s:()=>style,_a:()=>align};
 return {getText:()=>tr};}
function mkTable(){const g=[['CLOSING','MON','WED','THURS','FRI'],['Effort',' ',' ',' ',' '],['Performance',' ',' ',' ',' '],['Attitude',' ',' ',' ',' ']].map(r=>r.map(cellObj));
 return {getNumRows:()=>4,getNumColumns:()=>5,getCell:(r,c)=>g[r][c],g};}
const tables={};
const PET={SHAPE:'S',TABLE:'T'};
const slides=['1st','3rd','4th','6th','7th'].map(b=>{const tb=mkTable();tables[b]=tb;
 return {getPageElements:()=>[{getPageElementType:()=>'S',asShape:()=>({getText:()=>({asString:()=>b+' Block Agenda\n'})})},{getPageElementType:()=>'T',asTable:()=>tb}]};});
global.SlidesApp={PageElementType:PET,openById:()=>({getSlides:()=>slides})};
// --- fake sheet
let rows=[];
const sh={getLastRow:()=>rows.length,getRange:(r,c,nr,nc)=>({setValues(v){v.forEach((line,i)=>{rows[r-1+i]=line.slice();});return this;},setFontWeight(){return this;},
  getDisplayValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(0,nc).map(String))}),deleteRow:i=>rows.splice(i-1,1),setFrozenRows(){}};
global.SpreadsheetApp={openById:()=>({getSheetByName:()=>rows.length?sh:null,insertSheet:()=>sh})};
const props={};global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})};
global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
global.ContentService={MimeType:{JSON:'j'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})};
global.Session={getScriptTimeZone:()=>'America/New_York'};
global.Utilities={formatDate:()=>'2026-11-09',getUuid:()=>'abcd-efgh-ijkl-mnop-qrst-uvwx'};
global.Logger={log(){}};
let trig=[];global.ScriptApp={getProjectTriggers:()=>trig,deleteTrigger(){},WeekDay:{MONDAY:'MON'},getService:()=>({getUrl:()=>'https://script.google.com/macros/s/X/exec'}),
 newTrigger:f=>({timeBased:()=>({onWeekDay:()=>({atHour:()=>({create(){trig.push(f);}})})})})};
eval(fs.readFileSync('require('path').join(__dirname,'..','apps-script','ClosingScores.gs')','utf8'));
setupClosingScores(); const K=props.closingKey; a.ok(K&&K.length===20); a.deepEqual(trig,['clearClosingScores']);
a.equal(doGet({parameter:{a:'get',block:'1st',k:'nope'}}).ok,false);
let r=doGet({parameter:{a:'get',block:'1st',k:K}}); a.deepEqual(r.days,['MON','WED','THURS','FRI']); a.deepEqual(r.rows,['Effort','Performance','Attitude']); a.equal(r.values[0][0],'');
r=doGet({parameter:{a:'set',block:'3rd',k:K,row:'Effort',day:'MON',v:'3'}}); a.ok(r.ok,r.error); a.equal(r.values[0][0],'3');
const c=tables['3rd'].g[1][1].getText(); a.equal(c._s().font,'Lato'); a.equal(c._s().size,20); a.equal(c._a(),'CENTER');
a.equal(rows.length,2); a.deepEqual(rows[1].slice(0,5),['2026-11-09','3rd','MON','Effort',3]);
doGet({parameter:{a:'set',block:'3rd',k:K,row:'Effort',day:'MON',v:'2'}}); a.equal(rows.length,2); a.equal(rows[1][4],2);   // correction replaces
doGet({parameter:{a:'set',block:'3rd',k:K,row:'attitude',day:'mon',v:'1'}}); a.equal(rows.length,3);
a.equal(doGet({parameter:{a:'set',block:'3rd',k:K,row:'Effort',day:'MON',v:'5'}}).ok,false);
a.equal(doGet({parameter:{a:'set',block:'3rd',k:K,row:'Effort',day:'TUES',v:'2'}}).error.includes('No "TUES" column'),true);
a.equal(doGet({parameter:{a:'set',block:'2nd',k:K,row:'Effort',day:'MON',v:'2'}}).ok,false);
doGet({parameter:{a:'set',block:'3rd',k:K,row:'Attitude',day:'MON',v:''}}); a.equal(rows.length,2);   // cleared box removes log row
clearClosingScores(); a.equal(doGet({parameter:{a:'get',block:'3rd',k:K}}).values[0][0],''); a.equal(tables['3rd'].g[1][0].getText().asString(),'Effort\n');
console.log('ClosingScores.gs checks ok');
